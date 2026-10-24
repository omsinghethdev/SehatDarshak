import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { verifyAccessToken } from '../src/utils/accessToken.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { bearer, request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('auth');

const app = createApp();
const validRegistration = {
  name: 'Test Patient',
  identifier: 'test.patient',
  password: 'test-password-123',
  preferredLanguage: 'hi',
};

const register = (body) => request(app, { method: 'POST', path: '/api/auth/register', body });
const login = (body) => request(app, { method: 'POST', path: '/api/auth/login', body });
const me = (headers) => request(app, { path: '/api/auth/me', headers });

function assertNoSecrets(response, ...secrets) {
  assert.doesNotMatch(response.rawBody, /passwordHash|scrypt\$/);
  for (const secret of secrets) {
    assert.equal(response.rawBody.includes(secret), false);
  }
}

describe('auth routes', { skip: databaseUnavailable }, () => {
  before(() => User.init());
  beforeEach(() => User.deleteMany({}));
  after(dropTestDatabase);

  describe('POST /api/auth/register', () => {
    test('creates a patient, signs them in, and returns only safe user data', async () => {
      const response = await register(validRegistration);

      assert.equal(response.status, 201);
      assert.deepEqual(Object.keys(response.body.data).sort(), ['accessToken', 'user']);
      assert.deepEqual(response.body.data.user, {
        id: response.body.data.user.id,
        name: 'Test Patient',
        role: 'patient',
        preferredLanguage: 'hi',
      });
      assertNoSecrets(response, validRegistration.password);

      const claims = verifyAccessToken(response.body.data.accessToken);
      assert.equal(claims.sub, response.body.data.user.id);
      assert.equal(claims.role, 'patient');

      const stored = await User.findById(response.body.data.user.id).select('+passwordHash').lean();
      assert.equal(stored.identifier, 'test.patient');
      assert.notEqual(stored.passwordHash, validRegistration.password);
      assert.match(stored.passwordHash, /^scrypt\$/);
    });

    test('the returned token works for GET /api/auth/me', async () => {
      const { body } = await register(validRegistration);
      const response = await me(bearer(body.data.accessToken));

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: { user: body.data.user } });
    });

    test('preferredLanguage is optional', async () => {
      const { preferredLanguage: _omitted, ...withoutLanguage } = validRegistration;
      const response = await register(withoutLanguage);

      assert.equal(response.status, 201);
      assert.equal('preferredLanguage' in response.body.data.user, false);
    });

    test('rejects duplicate usernames, including case variants, with 409', async () => {
      assert.equal((await register(validRegistration)).status, 201);

      for (const identifier of ['test.patient', 'Test.Patient', '  TEST.PATIENT ']) {
        const response = await register({ ...validRegistration, identifier });
        assert.equal(response.status, 409);
        assert.equal(response.body.error.code, 'CONFLICT');
      }
      assert.equal(await User.countDocuments(), 1);
    });

    test('concurrent duplicate registrations create only one user', async () => {
      const responses = await Promise.all([register(validRegistration), register(validRegistration)]);

      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      assert.equal(await User.countDocuments(), 1);
    });

    test('rejects attempts to set role, department, or IDs', async () => {
      for (const extra of [
        { role: 'admin' },
        { role: 'staff', departmentId: '507f1f77bcf86cd799439011' },
        { id: 'user_demo_01' },
        { patientId: 'user_demo_01' },
      ]) {
        const response = await register({ ...validRegistration, ...extra });
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'VALIDATION_ERROR');
      }
      assert.equal(await User.countDocuments(), 0);
    });

    test('rejects invalid input with field details', async () => {
      const cases = [
        [{ ...validRegistration, password: 'short' }, 'password'],
        [{ ...validRegistration, password: undefined }, 'password'],
        [{ ...validRegistration, password: 12345678 }, 'password'],
        [{ ...validRegistration, password: 'x'.repeat(129) }, 'password'],
        [{ ...validRegistration, identifier: '' }, 'identifier'],
        [{ ...validRegistration, identifier: 'ab' }, 'identifier'],
        [{ ...validRegistration, identifier: 'has spaces' }, 'identifier'],
        [{ ...validRegistration, identifier: { $gt: '' } }, 'identifier'],
        [{ ...validRegistration, name: '   ' }, 'name'],
        [{ ...validRegistration, preferredLanguage: 'xx' }, 'preferredLanguage'],
      ];

      for (const [body, field] of cases) {
        const response = await register(body);
        assert.equal(response.status, 400, field);
        assert.equal(response.body.error.code, 'VALIDATION_ERROR');
        assert.ok(response.body.error.details.some((detail) => detail.field === field), field);
      }

      const arrayBody = await register([validRegistration]);
      assert.equal(arrayBody.status, 400);
      assert.equal(await User.countDocuments(), 0);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(() => register(validRegistration));

    test('returns a signed JWT and safe user data', async () => {
      const response = await login({ identifier: 'test.patient', password: validRegistration.password });

      assert.equal(response.status, 200);
      assert.equal(response.body.data.user.role, 'patient');
      assert.equal(response.body.data.user.name, 'Test Patient');
      assert.equal(verifyAccessToken(response.body.data.accessToken).sub, response.body.data.user.id);
      assertNoSecrets(response, validRegistration.password);
    });

    test('usernames are matched case-insensitively', async () => {
      const response = await login({ identifier: 'Test.Patient', password: validRegistration.password });
      assert.equal(response.status, 200);
    });

    test('wrong password and unknown username return the same generic 401', async () => {
      const wrongPassword = await login({ identifier: 'test.patient', password: 'wrong-password' });
      const unknownUser = await login({ identifier: 'nobody.here', password: validRegistration.password });

      for (const response of [wrongPassword, unknownUser]) {
        assert.equal(response.status, 401);
        assert.deepEqual(response.body, {
          error: { code: 'UNAUTHORIZED', message: 'Invalid username or password' },
        });
      }
    });

    test('rejects missing or non-string credentials with 400', async () => {
      for (const body of [
        {},
        { identifier: 'test.patient' },
        { password: validRegistration.password },
        { identifier: { $ne: null }, password: validRegistration.password },
        { identifier: 'test.patient', password: { $ne: null } },
      ]) {
        const response = await login(body);
        assert.equal(response.status, 400);
        assert.equal(response.body.error.code, 'VALIDATION_ERROR');
      }
    });
  });

  describe('GET /api/auth/me', () => {
    test('rejects missing and invalid tokens', async () => {
      for (const headers of [{}, bearer('invalid.jwt.value')]) {
        const response = await me(headers);
        assert.equal(response.status, 401);
        assert.equal(response.body.error.code, 'UNAUTHORIZED');
      }
    });

    test('rejects a valid token once the user has been deleted', async () => {
      const { body } = await register(validRegistration);
      await User.deleteMany({});

      const response = await me(bearer(body.data.accessToken));
      assert.equal(response.status, 401);
    });
  });
});

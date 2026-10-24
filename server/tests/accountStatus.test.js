import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { OPD, authHeaders, createUser, seedHospital } from './helpers/fixtures.js';
import { bearer, request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('account_status');
const app = createApp();
const password = 'test-password-123';

const login = (identifier, pw = password) => request(app, { method: 'POST', path: '/api/auth/login', body: { identifier, password: pw } });
const me = (headers) => request(app, { path: '/api/auth/me', headers });

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

describe('account status, credentials, and sign-in limits', { skip: databaseUnavailable }, () => {
  let admin;

  before(async () => {
    await seedHospital();
    admin = await createUser({ role: 'admin' });
  });

  after(async () => {
    await dropTestDatabase();
  });

  test('a deactivated staff account is rejected at login (after the password) and on every request', async () => {
    const staff = await createUser({ role: 'staff', departmentId: OPD, identifier: 'status.staff', password });
    const session = (await login('status.staff')).body.data.accessToken;
    assert.equal((await me(bearer(session))).status, 200);

    const deactivate = await request(app, {
      method: 'PATCH', path: `/api/admin/staff/${staff._id}`, headers: authHeaders(admin), body: { isActive: false },
    });
    assert.equal(deactivate.status, 200, deactivate.rawBody);

    // Existing session ends immediately.
    assertError(await me(bearer(session)), 401, 'UNAUTHORIZED');
    assertError(await request(app, { path: `/api/queues/${OPD}`, headers: bearer(session) }), 401, 'UNAUTHORIZED');

    // Correct password → 403 with the deactivation message; wrong password → the generic 401,
    // so account status is not revealed without the password.
    const correct = await login('status.staff');
    assertError(correct, 403, 'FORBIDDEN');
    assert.match(correct.body.error.message, /deactivated/);
    const wrong = await login('status.staff', 'wrong-password');
    assertError(wrong, 401, 'UNAUTHORIZED');
    assert.doesNotMatch(wrong.body.error.message, /deactivated/);

    // Reactivation restores access.
    await request(app, { method: 'PATCH', path: `/api/admin/staff/${staff._id}`, headers: authHeaders(admin), body: { isActive: true } });
    assert.equal((await login('status.staff')).status, 200);
  });

  test('accounts created before isActive existed are treated as active', async () => {
    const legacy = await createUser({ role: 'staff', departmentId: OPD, identifier: 'legacy.staff', password });
    await User.updateOne({ _id: legacy._id }, { $unset: { isActive: '' } });
    assert.equal((await login('legacy.staff')).status, 200);
    assert.equal((await me(authHeaders(legacy))).status, 200);
  });

  test('an admin password reset issues a one-time temporary password and ends existing sessions', async () => {
    const staff = await createUser({ role: 'staff', departmentId: OPD, identifier: 'reset.staff', password });
    const oldSession = (await login('reset.staff')).body.data.accessToken;
    // Make the old token clearly older than the reset (JWT iat has one-second precision).
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const reset = await request(app, {
      method: 'POST', path: `/api/admin/staff/${staff._id}/password-reset`, headers: authHeaders(admin), body: {},
    });
    assert.equal(reset.status, 200, reset.rawBody);
    assert.equal(reset.body.data.mustChangePassword, true);
    const { temporaryPassword } = reset.body.data;
    assert.ok(temporaryPassword.length >= 16);

    assertError(await me(bearer(oldSession)), 401, 'UNAUTHORIZED');
    assertError(await login('reset.staff'), 401, 'UNAUTHORIZED');

    const signIn = await login('reset.staff', temporaryPassword);
    assert.equal(signIn.status, 200, signIn.rawBody);
    assert.equal(signIn.body.data.user.mustChangePassword, true);

    // The temporary password is never stored in plain text or in the audit trail.
    const stored = await User.findById(staff._id).select('+passwordHash +auditTrail').lean();
    assert.ok(!JSON.stringify(stored).includes(temporaryPassword));
    assert.equal(stored.auditTrail.at(-1).action, 'staff_password_reset');
    assert.equal(stored.auditTrail.at(-1).changes, undefined);

    // Choosing a new password clears the flag and returns a working token.
    const change = await request(app, {
      method: 'POST',
      path: '/api/auth/change-password',
      headers: bearer(signIn.body.data.accessToken),
      body: { currentPassword: temporaryPassword, newPassword: 'a-new-password-456' },
    });
    assert.equal(change.status, 200, change.rawBody);
    assert.equal(change.body.data.user.mustChangePassword, undefined);
    assert.equal((await me(bearer(change.body.data.accessToken))).status, 200);
    assert.equal((await login('reset.staff', 'a-new-password-456')).status, 200);
  });

  test('change-password validates the current password and the new password', async () => {
    const patient = await createUser({ role: 'patient', identifier: 'change.patient', password });
    const headers = authHeaders(patient);
    const post = (body, h = headers) => request(app, { method: 'POST', path: '/api/auth/change-password', headers: h, body });

    assertError(await post({ currentPassword: password, newPassword: 'a-new-password-456' }, {}), 401, 'UNAUTHORIZED');
    assertError(await post({ currentPassword: 'wrong-password', newPassword: 'a-new-password-456' }), 400, 'VALIDATION_ERROR');
    assertError(await post({ currentPassword: password, newPassword: 'short' }), 400, 'VALIDATION_ERROR');
    assertError(await post({ currentPassword: password, newPassword: password }), 400, 'VALIDATION_ERROR');
    assertError(await post({ currentPassword: password, newPassword: 'a-new-password-456', role: 'admin' }), 400, 'VALIDATION_ERROR');

    const ok = await post({ currentPassword: password, newPassword: 'a-new-password-456' });
    assert.equal(ok.status, 200, ok.rawBody);
    assert.equal(ok.body.data.user.role, 'patient');
  });

  test('repeated wrong passwords for one username are limited with 429, other usernames are not affected', async () => {
    await createUser({ role: 'patient', identifier: 'limited.patient', password });
    await createUser({ role: 'patient', identifier: 'other.patient', password });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      assertError(await login('limited.patient', 'wrong-password'), 401, 'UNAUTHORIZED');
    }
    const blocked = await login('limited.patient');
    assertError(blocked, 429, 'TOO_MANY_REQUESTS');
    assert.equal((await login('other.patient')).status, 200);
  });
});

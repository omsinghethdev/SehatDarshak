import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { test } from 'node:test';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { AuthConfigurationError, getAuthConfig } from '../src/config/auth.js';
import { authorizeRoles, createAuthenticate } from '../src/middleware/authenticate.js';
import { signAccessToken } from '../src/utils/accessToken.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { bearer, request } from './helpers/http.js';

const testSecret = 'test-only-secret-that-is-at-least-32-characters';
process.env.AUTH_SECRET = testSecret;

const users = {
  patient1: { _id: 'patient1', name: 'Test Patient', role: 'patient' },
  staff1: { _id: 'staff1', name: 'Test Staff', role: 'staff' },
  admin1: { _id: 'admin1', name: 'Test Admin', role: 'admin' },
};

// Protected test routes use a stubbed user lookup so these tests need no database.
function createProtectedApp() {
  const authenticate = createAuthenticate({ loadUser: async (id) => users[id] ?? null });

  return createApp({
    registerRoutes(app) {
      app.get('/api/test/any', authenticate, (req, res) => {
        res.json({ data: { role: req.user.role } });
      });
      app.get('/api/test/staff', authenticate, authorizeRoles('staff', 'admin'), (req, res) => {
        res.json({ data: { role: req.user.role } });
      });
      app.get('/api/test/admin', authenticate, authorizeRoles('admin'), (req, res) => {
        res.json({ data: { role: req.user.role } });
      });
    },
  });
}

const tokenFor = (userId) => signAccessToken({ id: userId, role: users[userId].role });

function assertUnauthorized(response) {
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHORIZED');
}

test('requests without an Authorization header are rejected', async () => {
  assertUnauthorized(await request(createProtectedApp(), { path: '/api/test/any' }));
});

test('non-Bearer and malformed Authorization headers are rejected', async () => {
  const app = createProtectedApp();
  const token = tokenFor('patient1');

  for (const authorization of [`Basic ${token}`, 'Bearer', `Bearer ${token} extra`, 'not-a-token']) {
    assertUnauthorized(await request(app, { path: '/api/test/any', headers: { authorization } }));
  }
});

test('tokens that are tampered, signed with another key, expired, or unsigned are rejected', async () => {
  const app = createProtectedApp();
  const validToken = tokenFor('patient1');
  const tampered = `${validToken.slice(0, -2)}xx`;
  const wrongKey = jwt.sign({ role: 'admin' }, 'another-secret-that-is-at-least-32-chars', {
    subject: 'admin1',
  });
  const expired = jwt.sign({ role: 'patient' }, testSecret, { subject: 'patient1', expiresIn: -10 });
  const unsigned = jwt.sign({ role: 'admin' }, null, { subject: 'admin1', algorithm: 'none' });

  for (const token of [tampered, wrongKey, expired, unsigned, 'garbage']) {
    assertUnauthorized(await request(app, { path: '/api/test/any', headers: bearer(token) }));
  }
});

test('tokens for users that no longer exist are rejected', async () => {
  const token = signAccessToken({ id: 'deleted-user', role: 'admin' });
  assertUnauthorized(await request(createProtectedApp(), { path: '/api/test/any', headers: bearer(token) }));
});

test('valid tokens reach protected routes with the user loaded from storage', async () => {
  const response = await request(createProtectedApp(), {
    path: '/api/test/any',
    headers: bearer(tokenFor('patient1')),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { data: { role: 'patient' } });
});

test('role authorization uses the stored role, not the token role claim', async () => {
  const forgedRoleToken = signAccessToken({ id: 'patient1', role: 'admin' });
  const response = await request(createProtectedApp(), {
    path: '/api/test/admin',
    headers: bearer(forgedRoleToken),
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, 'FORBIDDEN');
});

test('role authorization allows permitted roles and forbids others', async () => {
  const app = createProtectedApp();
  const cases = [
    ['patient1', '/api/test/staff', 403],
    ['staff1', '/api/test/staff', 200],
    ['admin1', '/api/test/staff', 200],
    ['staff1', '/api/test/admin', 403],
    ['admin1', '/api/test/admin', 200],
  ];

  for (const [userId, path, expectedStatus] of cases) {
    const response = await request(app, { path, headers: bearer(tokenFor(userId)) });
    assert.equal(response.status, expectedStatus, `${userId} -> ${path}`);
  }
});

test('GET /api/auth/me requires a Bearer token', async () => {
  assertUnauthorized(await request(createApp(), { path: '/api/auth/me' }));
});

test('auth configuration requires a sufficiently long secret', () => {
  assert.throws(() => getAuthConfig({ secret: '' }), AuthConfigurationError);
  assert.throws(() => getAuthConfig({ secret: 'too-short' }), /at least 32 characters/);
  assert.throws(() => getAuthConfig({ secret: 'replace-with-a-long-random-secret' }), /example value/);
  assert.equal(getAuthConfig({ secret: testSecret }).expiresIn, '1h');
});

test('auth configuration rejects invalid token lifetimes at startup instead of at login', () => {
  for (const expiresIn of ['abc', '3600', '0h', '1.5h', '-1h', '1 h', '1hour']) {
    assert.throws(() => getAuthConfig({ secret: testSecret, expiresIn }), /AUTH_TOKEN_EXPIRES_IN/, expiresIn);
  }
  for (const expiresIn of ['30s', '15m', '1h', '7d']) {
    assert.equal(getAuthConfig({ secret: testSecret, expiresIn }).expiresIn, expiresIn);
    assert.ok(signAccessToken({ id: 'patient1', role: 'patient' }, getAuthConfig({ secret: testSecret, expiresIn })));
  }
});

test('password hashing uses a salted hash and verifies correctly', async () => {
  const first = await hashPassword('correct horse battery');
  const second = await hashPassword('correct horse battery');

  assert.notEqual(first, second);
  assert.doesNotMatch(first, /correct horse battery/);
  assert.equal(await verifyPassword('correct horse battery', first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
  assert.equal(await verifyPassword('anything', 'not-a-valid-hash'), false);
});

test('new password hashes use the OWASP-equivalent scrypt cost N=2^14, r=8, p=5', async () => {
  const [algorithm, N, r, p] = (await hashPassword('correct horse battery')).split('$');

  assert.deepEqual([algorithm, N, r, p], ['scrypt', '16384', '8', '5']);
});

test('hashes stored with the previous cost parameters still verify', async () => {
  const salt = randomBytes(16);
  const hash = scryptSync('legacy password', salt, 64, { N: 16384, r: 8, p: 1 });
  const legacyHash = ['scrypt', 16384, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$');

  assert.equal(await verifyPassword('legacy password', legacyHash), true);
  assert.equal(await verifyPassword('wrong password', legacyHash), false);
});

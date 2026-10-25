import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { createInitialAdmin, readBootstrapAdmin } from '../src/bootstrap/createInitialAdmin.js';
import { ProxyConfigurationError, getTrustProxy } from '../src/config/proxy.js';
import { startupFailureMessage } from '../src/server.js';
import { User } from '../src/modules/users/user.model.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';

// Test-only placeholder password; never a real credential.
const testPassword = 'bootstrap-test-pass';

describe('TRUST_PROXY', () => {
  test('unset, empty, or 0 trusts no proxy; a hop count is used as is', () => {
    assert.equal(getTrustProxy({ value: undefined }), false);
    assert.equal(getTrustProxy({ value: '  ' }), false);
    assert.equal(getTrustProxy({ value: '0' }), false);
    assert.equal(getTrustProxy({ value: '1' }), 1);
    assert.equal(getTrustProxy({ value: ' 2 ' }), 2);
  });

  test('anything else is a startup configuration error with a clear message', () => {
    for (const value of ['true', '*', '1.5', '-1', 'loopback', '999']) {
      assert.throws(() => getTrustProxy({ value }), ProxyConfigurationError, value);
    }
    const error = (() => {
      try {
        getTrustProxy({ value: 'true' });
      } catch (caught) {
        return caught;
      }
    })();
    assert.match(startupFailureMessage(error, 5000), /TRUST_PROXY must be a whole number/);
  });

  async function clientIpSeen(trustProxy, forwardedFor) {
    const previous = process.env.TRUST_PROXY;
    if (trustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = trustProxy;
    const app = createApp({ registerRoutes: (instance) => instance.get('/ip', (request, response) => response.json({ ip: request.ip })) });
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;

    const server = await new Promise((resolve) => {
      const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
    });
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/ip`, { headers: { 'X-Forwarded-For': forwardedFor } });
      return (await response.json()).ip;
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  test('without TRUST_PROXY a client cannot choose its address with X-Forwarded-For', async () => {
    assert.match(await clientIpSeen(undefined, '203.0.113.9'), /127\.0\.0\.1/);
  });

  test('with TRUST_PROXY=1 the address added by the proxy is used, not one the client sent', async () => {
    // The client sent "198.51.100.1"; the proxy appended the real peer "203.0.113.9".
    assert.equal(await clientIpSeen('1', '198.51.100.1, 203.0.113.9'), '203.0.113.9');
  });
});

describe('initial administrator bootstrap — settings', () => {
  test('username and password are required', () => {
    const { account, problems } = readBootstrapAdmin({});
    assert.equal(account, null);
    assert.deepEqual(problems, ['BOOTSTRAP_ADMIN_USERNAME is required', 'BOOTSTRAP_ADMIN_PASSWORD is required']);
  });

  test('the public registration rules apply, and problems name the variable but never its value', () => {
    const { account, problems } = readBootstrapAdmin({ BOOTSTRAP_ADMIN_USERNAME: 'Bad Name!', BOOTSTRAP_ADMIN_PASSWORD: 'short' });
    assert.equal(account, null);
    assert.ok(problems.some((problem) => problem.startsWith('BOOTSTRAP_ADMIN_USERNAME:')));
    assert.ok(problems.some((problem) => problem.startsWith('BOOTSTRAP_ADMIN_PASSWORD:')));
    assert.ok(problems.every((problem) => !problem.includes('Bad Name!')));
  });

  test('valid settings give the account, with a default display name', () => {
    const { account, problems } = readBootstrapAdmin({ BOOTSTRAP_ADMIN_USERNAME: 'hospital.admin', BOOTSTRAP_ADMIN_PASSWORD: testPassword });
    assert.deepEqual(problems, []);
    assert.deepEqual(account, { name: 'Administrator', identifier: 'hospital.admin', password: testPassword });
  });
});

const databaseUnavailable = await connectTestDatabase('bootstrap');

describe('initial administrator bootstrap — database', { skip: databaseUnavailable }, () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  after(async () => {
    await dropTestDatabase();
  });

  test('creates the first admin with a hashed password', async () => {
    assert.equal(await createInitialAdmin({ name: 'Administrator', identifier: 'hospital.admin', password: testPassword }), 'created');
    const admin = await User.findOne({ identifier: 'hospital.admin' }).select('+passwordHash').lean();
    assert.equal(admin.role, 'admin');
    assert.notEqual(admin.passwordHash, testPassword);
  });

  test('running it again changes nothing, even with a different password', async () => {
    await createInitialAdmin({ name: 'Administrator', identifier: 'hospital.admin', password: testPassword });
    const before = await User.findOne({ identifier: 'hospital.admin' }).select('+passwordHash').lean();
    assert.equal(await createInitialAdmin({ name: 'Other', identifier: 'hospital.admin', password: 'another-password' }), 'adminExists');
    const afterRun = await User.findOne({ identifier: 'hospital.admin' }).select('+passwordHash').lean();
    assert.equal(afterRun.passwordHash, before.passwordHash);
    assert.equal(afterRun.name, 'Administrator');
  });

  test('never adds a second admin once any admin exists', async () => {
    await User.create({ name: 'Existing', identifier: 'existing.admin', passwordHash: 'x', role: 'admin' });
    assert.equal(await createInitialAdmin({ name: 'New', identifier: 'new.admin', password: testPassword }), 'adminExists');
    assert.equal(await User.countDocuments({ role: 'admin' }), 1);
  });

  test('never converts an existing patient or staff account into an admin', async () => {
    await User.create({ name: 'Patient', identifier: 'hospital.admin', passwordHash: 'x', role: 'patient' });
    assert.equal(await createInitialAdmin({ name: 'Administrator', identifier: 'hospital.admin', password: testPassword }), 'usernameTaken');
    const user = await User.findOne({ identifier: 'hospital.admin' }).lean();
    assert.equal(user.role, 'patient');
    assert.equal(await User.countDocuments({ role: 'admin' }), 0);
  });
});

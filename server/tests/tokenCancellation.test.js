import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { QueueToken } from '../src/modules/tokens/queueToken.model.js';
import { TokenCounter } from '../src/modules/tokens/tokenCounter.model.js';
import { User } from '../src/modules/users/user.model.js';
import { demoDepartments, demoFloors, demoRooms } from '../src/seed/demoData.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { signAccessToken } from '../src/utils/accessToken.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { bearer, request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('token_cancel');
const app = createApp();

const OPD = 'dept_demo_opd';
const tokenKeys = ['departmentId', 'displayNumber', 'estimateLabel', 'estimatedWaitMinutes', 'id', 'patientsAhead', 'status'];
const users = {};
const headersFor = (name) => bearer(signAccessToken({ id: users[name]._id, role: users[name].role }));

const book = (name, departmentId = OPD) =>
  request(app, { method: 'POST', path: '/api/queue-tokens', headers: headersFor(name), body: { departmentId } });
const cancel = (name, tokenId, body = {}) =>
  request(app, {
    method: 'POST',
    path: `/api/queue-tokens/${tokenId}/cancel`,
    headers: name ? headersFor(name) : {},
    ...(body === undefined ? {} : { body }),
  });
const callNext = (name, departmentId = OPD) =>
  request(app, { method: 'POST', path: `/api/queues/${departmentId}/call-next`, headers: headersFor(name), body: {} });
const patchStatus = (name, tokenId, status) =>
  request(app, { method: 'PATCH', path: `/api/queue-tokens/${tokenId}/status`, headers: headersFor(name), body: { status } });
const statusOf = async (tokenId) => (await QueueToken.findById(tokenId).lean()).status;
const setStatus = (tokenId, status) => QueueToken.updateOne({ _id: tokenId }, { $set: { status } });

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

async function bookId(name, departmentId = OPD) {
  const response = await book(name, departmentId);
  assert.equal(response.status, 201, response.rawBody);
  return response.body.data.id;
}

describe('POST /api/queue-tokens/:tokenId/cancel', { skip: databaseUnavailable }, () => {
  before(async () => {
    await seedDemoData({ floors: demoFloors, departments: demoDepartments, rooms: demoRooms });
    for (const [name, fields] of [
      ['patientA', { role: 'patient' }],
      ['patientB', { role: 'patient' }],
      ['staffOpd', { role: 'staff', departmentId: OPD }],
      ['admin', { role: 'admin' }],
    ]) {
      users[name] = await User.create({ name, identifier: name.toLowerCase(), passwordHash: 'not-used-in-these-tests', ...fields });
    }
    await QueueToken.init();
  });
  beforeEach(() => Promise.all([QueueToken.deleteMany({}), TokenCounter.deleteMany({})]));
  after(dropTestDatabase);

  test('a patient cancels their own waiting token', async () => {
    const tokenId = await bookId('patientA');

    const response = await cancel('patientA', tokenId);

    assert.equal(response.status, 200, response.rawBody);
    assert.deepEqual(Object.keys(response.body.data).sort(), tokenKeys);
    assert.equal(response.body.data.id, tokenId);
    assert.equal(response.body.data.status, 'cancelled');
    assert.doesNotMatch(response.rawBody, /patientId/);
    assert.equal(await statusOf(tokenId), 'cancelled');

    const active = await request(app, { path: '/api/patients/me/queue-tokens/active', headers: headersFor('patientA') });
    assert.deepEqual(active.body.data, []);
    const read = await request(app, { path: `/api/queue-tokens/${tokenId}`, headers: headersFor('patientA') });
    assert.equal(read.body.data.status, 'cancelled');
  });

  test('a request without a body is accepted; any body field is rejected', async () => {
    const tokenId = await bookId('patientA');
    for (const body of [{ patientId: String(users.patientB._id) }, { status: 'completed' }, { tokenId }]) {
      assertError(await cancel('patientA', tokenId, body), 400, 'VALIDATION_ERROR');
    }
    assert.equal(await statusOf(tokenId), 'waiting');

    assert.equal((await cancel('patientA', tokenId, undefined)).status, 200);
  });

  test("another patient cannot cancel or learn about someone else's token", async () => {
    const tokenId = await bookId('patientA');

    const response = await cancel('patientB', tokenId);

    assertError(response, 404, 'NOT_FOUND');
    assert.doesNotMatch(response.rawBody, /OPD-|waiting|displayNumber/);
    assert.equal(await statusOf(tokenId), 'waiting');
  });

  test('unknown and malformed token IDs are rejected', async () => {
    assertError(await cancel('patientA', 'token_000000000000000000000000'), 404, 'NOT_FOUND');
    // Percent-encoded so the request line is valid; the server decodes it to "bad!id".
  assertError(await cancel('patientA', 'bad%21id'), 400, 'VALIDATION_ERROR');
  });

  test('unauthenticated and invalid-token requests are rejected', async () => {
    const tokenId = await bookId('patientA');

    assertError(await cancel(null, tokenId), 401, 'UNAUTHORIZED');
    const invalid = await request(app, {
      method: 'POST',
      path: `/api/queue-tokens/${tokenId}/cancel`,
      headers: bearer('invalid.jwt.value'),
      body: {},
    });
    assertError(invalid, 401, 'UNAUTHORIZED');
    assert.equal(await statusOf(tokenId), 'waiting');
  });

  test('staff and admins cannot use the patient endpoint; their queue operations are unchanged', async () => {
    const first = await bookId('patientA');
    const second = await bookId('patientB');

    assertError(await cancel('staffOpd', first), 403, 'FORBIDDEN');
    assertError(await cancel('admin', first), 403, 'FORBIDDEN');
    assert.equal(await statusOf(first), 'waiting');

    const called = await callNext('staffOpd');
    assert.equal(called.status, 200, called.rawBody);
    assert.equal(called.body.data.id, first);
    assert.equal((await patchStatus('staffOpd', first, 'in_consultation')).status, 200);
    assert.equal((await patchStatus('admin', second, 'cancelled')).status, 200);
    assert.equal(await statusOf(second), 'cancelled');
  });

  for (const status of ['called', 'in_consultation', 'completed', 'skipped', 'cancelled']) {
    test(`a ${status} token cannot be cancelled by its patient`, async () => {
      const tokenId = await bookId('patientA');
      await setStatus(tokenId, status);

      const response = await cancel('patientA', tokenId);

      assertError(response, 409, 'CONFLICT');
      assert.match(response.body.error.message, new RegExp(status));
      assert.equal(await statusOf(tokenId), status);
    });
  }

  test('repeating the request after a successful cancel is a safe 409', async () => {
    const tokenId = await bookId('patientA');
    assert.equal((await cancel('patientA', tokenId)).status, 200);

    assertError(await cancel('patientA', tokenId), 409, 'CONFLICT');
    assert.equal(await statusOf(tokenId), 'cancelled');
  });

  test('concurrent cancel requests succeed exactly once', async () => {
    const tokenId = await bookId('patientA');

    const responses = await Promise.all(Array.from({ length: 10 }, () => cancel('patientA', tokenId)));

    assert.equal(responses.filter((response) => response.status === 200).length, 1);
    assert.ok(responses.every((response) => response.status === 200 || response.body.error.code === 'CONFLICT'));
    assert.equal(await statusOf(tokenId), 'cancelled');
  });

  test('cancel racing call-next never produces an invalid state', async () => {
    const outcomes = { cancelled: 0, called: 0 };

    for (let round = 0; round < 15; round += 1) {
      await Promise.all([QueueToken.deleteMany({}), TokenCounter.deleteMany({})]);
      const tokenId = await bookId('patientA');

      const [cancelResponse, callResponse] = await Promise.all([cancel('patientA', tokenId), callNext('staffOpd')]);
      const final = await statusOf(tokenId);

      // Exactly one side wins, and the stored status is the winner's.
      assert.equal([cancelResponse.status, callResponse.status].filter((code) => code === 200).length, 1, `round ${round}`);
      if (cancelResponse.status === 200) {
        assertError(callResponse, 409, 'CONFLICT');
        assert.equal(final, 'cancelled');
      } else {
        assertError(cancelResponse, 409, 'CONFLICT');
        assert.equal(final, 'called');
      }
      outcomes[final] += 1;
    }

    assert.equal(outcomes.cancelled + outcomes.called, 15);
  });

  test('cancel racing a staff status change never overwrites it', async () => {
    for (let round = 0; round < 10; round += 1) {
      await Promise.all([QueueToken.deleteMany({}), TokenCounter.deleteMany({})]);
      const tokenId = await bookId('patientA');

      const [patientCancel, staffCancel] = await Promise.all([
        cancel('patientA', tokenId),
        patchStatus('staffOpd', tokenId, 'cancelled'),
      ]);

      assert.equal([patientCancel.status, staffCancel.status].filter((code) => code === 200).length, 1, `round ${round}`);
      assert.equal(await statusOf(tokenId), 'cancelled');
    }
  });

  test('after cancelling, the patient can book the same department again', async () => {
    const first = await bookId('patientA');
    assert.equal((await cancel('patientA', first)).status, 200);

    const again = await book('patientA');

    assert.equal(again.status, 201, again.rawBody);
    assert.notEqual(again.body.data.id, first);
    assert.equal(again.body.data.status, 'waiting');
    assert.equal(await QueueToken.countDocuments({ patientId: users.patientA._id, status: 'waiting' }), 1);
    // The one-active-token rule still applies to the new token.
    assertError(await book('patientA'), 409, 'CONFLICT');
  });

  test('a cancelled token no longer counts as a patient ahead of others', async () => {
    const first = await bookId('patientA');
    const second = await bookId('patientB');
    const before = await request(app, { path: `/api/queue-tokens/${second}/status`, headers: headersFor('patientB') });
    assert.equal(before.body.data.patientsAhead, 1);

    await cancel('patientA', first);

    const after = await request(app, { path: `/api/queue-tokens/${second}/status`, headers: headersFor('patientB') });
    assert.equal(after.body.data.patientsAhead, 0);
  });
});

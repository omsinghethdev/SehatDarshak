import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { QueueToken, statusTransitions, tokenStatuses } from '../src/modules/tokens/queueToken.model.js';
import { User } from '../src/modules/users/user.model.js';
import { demoDepartments, demoFloors, demoRooms } from '../src/seed/demoData.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { signAccessToken } from '../src/utils/accessToken.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { bearer, request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('queue_operations');
const app = createApp();

const OPD = 'dept_demo_opd';
const CARDIO = 'dept_test_cardio';
const tokenKeys = ['departmentId', 'displayNumber', 'estimateLabel', 'estimatedWaitMinutes', 'id', 'patientsAhead', 'status'];

const users = {};
const headersFor = (name) => (name ? bearer(signAccessToken({ id: users[name]._id, role: users[name].role })) : {});

const listQueue = (name, departmentId, query = '') => request(app, {
  path: `/api/queues/${departmentId}${query}`,
  headers: headersFor(name),
});
const callNext = (name, departmentId, body = {}) => request(app, {
  method: 'POST',
  path: `/api/queues/${departmentId}/call-next`,
  headers: headersFor(name),
  body,
});
const patchStatus = (name, tokenId, body) => request(app, {
  method: 'PATCH',
  path: `/api/queue-tokens/${tokenId}/status`,
  headers: headersFor(name),
  body,
});

// Inserts tokens directly with distinct fictional patients so tests control the queue state.
let nextSequence = 1;
async function insertToken({ status = 'waiting', departmentId = OPD, patientId = new mongoose.Types.ObjectId() } = {}) {
  const sequence = nextSequence;
  nextSequence += 1;
  const prefix = departmentId === OPD ? 'OPD' : 'CARD';
  const token = await QueueToken.create({
    displayNumber: `${prefix}-${String(sequence).padStart(3, '0')}`,
    sequence,
    patientId,
    departmentId,
    status,
  });
  return token.toObject();
}

const statusOf = async (tokenId) => (await QueueToken.findById(tokenId).lean()).status;

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

describe('queue operations', { skip: databaseUnavailable }, () => {
  before(async () => {
    await seedDemoData({
      floors: demoFloors,
      departments: [
        ...demoDepartments,
        { _id: CARDIO, name: 'Test Cardiology', code: 'CARD', roomIds: [] },
        { _id: 'dept_test_closed', name: 'Closed Department', code: 'CLSD', roomIds: [], isActive: false },
      ],
      rooms: demoRooms,
    });

    for (const [name, fields] of [
      ['patient', { role: 'patient' }],
      ['staffOpd', { role: 'staff', departmentId: OPD }],
      ['staffCardio', { role: 'staff', departmentId: CARDIO }],
      ['staffUnassigned', { role: 'staff' }],
      ['admin', { role: 'admin' }],
    ]) {
      users[name] = await User.create({ name, identifier: name.toLowerCase(), passwordHash: 'unused', ...fields });
    }
    await QueueToken.init();
  });
  beforeEach(async () => {
    await QueueToken.deleteMany({});
    nextSequence = 1;
  });
  after(dropTestDatabase);

  describe('GET /api/queues/:departmentId', () => {
    test('lists active tokens of the department in queue order with live positions', async () => {
      const done = await insertToken({ status: 'completed' });
      const inConsultation = await insertToken({ status: 'in_consultation' });
      const called = await insertToken({ status: 'called' });
      const waiting1 = await insertToken();
      await insertToken({ status: 'cancelled' });
      const waiting2 = await insertToken();
      await insertToken({ departmentId: CARDIO });

      const response = await listQueue('staffOpd', OPD);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.meta, { page: 1, limit: 20, total: 4 });
      assert.deepEqual(
        response.body.data.map((token) => [token.id, token.status, token.patientsAhead]),
        [
          [inConsultation._id, 'in_consultation', 0],
          [called._id, 'called', 0],
          [waiting1._id, 'waiting', 0],
          [waiting2._id, 'waiting', 1],
        ],
      );
      assert.equal(response.body.data.some((token) => token.id === done._id), false);
      for (const token of response.body.data) {
        assert.deepEqual(Object.keys(token).sort(), tokenKeys);
        assert.equal(token.estimateLabel, 'Simulated estimate');
      }
    });

    test('does not expose patient information', async () => {
      const patientId = new mongoose.Types.ObjectId();
      await insertToken({ patientId });

      const response = await listQueue('admin', OPD);

      assert.equal(response.rawBody.includes(String(patientId)), false);
      assert.doesNotMatch(response.rawBody, /patientId|sequence|identifier|name/);
    });

    test('paginates and keeps patientsAhead continuous across pages', async () => {
      await insertToken({ status: 'called' });
      for (let index = 0; index < 5; index += 1) {
        await insertToken();
      }

      const page1 = await listQueue('staffOpd', OPD, '?page=1&limit=3');
      const page2 = await listQueue('staffOpd', OPD, '?page=2&limit=3');
      const page3 = await listQueue('staffOpd', OPD, '?page=3&limit=3');

      assert.deepEqual(page1.body.meta, { page: 1, limit: 3, total: 6 });
      assert.deepEqual(page1.body.data.map((token) => token.patientsAhead), [0, 0, 1]);
      assert.deepEqual(page2.body.data.map((token) => token.patientsAhead), [2, 3, 4]);
      assert.deepEqual(page2.body.data.map((token) => token.estimatedWaitMinutes), [10, 15, 20]);
      assert.deepEqual(page3.body.data, []);
      assertError(await listQueue('staffOpd', OPD, '?limit=101'), 400, 'VALIDATION_ERROR');
      assertError(await listQueue('staffOpd', OPD, '?page=0'), 400, 'VALIDATION_ERROR');
    });

    test('enforces role and department permissions', async () => {
      assertError(await listQueue(null, OPD), 401, 'UNAUTHORIZED');
      assertError(await listQueue('patient', OPD), 403, 'FORBIDDEN');
      assertError(await listQueue('staffCardio', OPD), 403, 'FORBIDDEN');
      assertError(await listQueue('staffUnassigned', OPD), 403, 'FORBIDDEN');
      assert.equal((await listQueue('staffCardio', CARDIO)).status, 200);
      assert.equal((await listQueue('admin', CARDIO)).status, 200);
    });

    test('rejects malformed, unknown, and inactive departments', async () => {
      assertError(await listQueue('admin', 'bad%24id'), 400, 'VALIDATION_ERROR');
      assertError(await listQueue('admin', 'dept_missing'), 404, 'NOT_FOUND');
      assertError(await listQueue('admin', 'dept_test_closed'), 404, 'NOT_FOUND');
    });
  });

  describe('POST /api/queues/:departmentId/call-next', () => {
    test('calls the earliest waiting token in the department', async () => {
      await insertToken({ departmentId: CARDIO });
      const first = await insertToken();
      const second = await insertToken();

      const response = await callNext('staffOpd', OPD);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: { id: first._id, displayNumber: first.displayNumber, status: 'called' } });
      const stored = await QueueToken.findById(first._id).lean();
      assert.equal(stored.status, 'called');
      assert.ok(stored.calledAt instanceof Date);
      assert.equal(await statusOf(second._id), 'waiting');
    });

    test('works without a request body and rejects unexpected fields', async () => {
      await insertToken();
      const noBody = await request(app, {
        method: 'POST',
        path: `/api/queues/${OPD}/call-next`,
        headers: headersFor('staffOpd'),
      });
      assert.equal(noBody.status, 200);

      await QueueToken.updateMany({ status: 'called' }, { $set: { status: 'in_consultation' } });
      await insertToken();
      assertError(await callNext('staffOpd', OPD, { tokenId: 'token_x' }), 400, 'VALIDATION_ERROR');
    });

    test('returns the documented 409 while a token is already called', async () => {
      const called = await insertToken({ status: 'called' });
      const waiting = await insertToken();

      const response = await callNext('staffOpd', OPD);

      assertError(response, 409, 'CONFLICT');
      assert.match(response.body.error.message, /in_consultation, skipped, or cancelled/);
      assert.equal(await statusOf(called._id), 'called');
      assert.equal(await statusOf(waiting._id), 'waiting');
    });

    test('a token in consultation does not block calling the next one', async () => {
      await insertToken({ status: 'in_consultation' });
      const waiting = await insertToken();

      const response = await callNext('admin', OPD);

      assert.equal(response.status, 200);
      assert.equal(response.body.data.id, waiting._id);
    });

    test('a called token in another department does not block this one', async () => {
      await insertToken({ status: 'called', departmentId: CARDIO });
      await insertToken();

      assert.equal((await callNext('staffOpd', OPD)).status, 200);
    });

    test('returns 409 when nobody is waiting', async () => {
      await insertToken({ status: 'completed' });
      const response = await callNext('staffOpd', OPD);

      assertError(response, 409, 'CONFLICT');
      assert.match(response.body.error.message, /no waiting tokens/);
    });

    test('enforces role and department permissions', async () => {
      const waiting = await insertToken();

      assertError(await callNext(null, OPD), 401, 'UNAUTHORIZED');
      assertError(await callNext('patient', OPD), 403, 'FORBIDDEN');
      assertError(await callNext('staffCardio', OPD), 403, 'FORBIDDEN');
      assertError(await callNext('staffUnassigned', OPD), 403, 'FORBIDDEN');
      assertError(await callNext('admin', 'dept_missing'), 404, 'NOT_FOUND');
      assert.equal(await statusOf(waiting._id), 'waiting');
    });

    test('concurrent call-next requests call exactly one token', async () => {
      const waiting = [];
      for (let index = 0; index < 5; index += 1) {
        waiting.push(await insertToken());
      }

      const responses = await Promise.all(
        Array.from({ length: 10 }, (_, index) => callNext(index % 2 ? 'admin' : 'staffOpd', OPD)),
      );
      const statuses = responses.map((response) => response.status);

      assert.equal(statuses.filter((status) => status === 200).length, 1, statuses.join(','));
      assert.equal(statuses.filter((status) => status === 409).length, 9, statuses.join(','));
      assert.equal(await QueueToken.countDocuments({ departmentId: OPD, status: 'called' }), 1);
      assert.equal(await statusOf(waiting[0]._id), 'called');
    });

    test('repeated call-next rounds never call the same token twice', async () => {
      const waiting = [];
      for (let index = 0; index < 4; index += 1) {
        waiting.push(await insertToken());
      }

      const calledIds = [];
      for (let round = 0; round < 4; round += 1) {
        const responses = await Promise.all([callNext('staffOpd', OPD), callNext('admin', OPD), callNext('staffOpd', OPD)]);
        const winners = responses.filter((response) => response.status === 200);
        assert.equal(winners.length, 1, `round ${round}`);
        calledIds.push(winners[0].body.data.id);
        assert.equal((await patchStatus('staffOpd', winners[0].body.data.id, { status: 'in_consultation' })).status, 200);
      }

      assert.deepEqual(calledIds, waiting.map((token) => token._id));
    });

    test('the database index rejects a second called token even without the API pre-check', async () => {
      await insertToken({ status: 'called' });
      await assert.rejects(() => insertToken({ status: 'called' }), /one_called_token_per_department/);
      await insertToken({ status: 'called', departmentId: CARDIO });
    });
  });

  describe('PATCH /api/queue-tokens/:tokenId/status', () => {
    const validTransitions = Object.entries(statusTransitions)
      .flatMap(([from, targets]) => targets.map((to) => [from, to]));
    const invalidTransitions = tokenStatuses
      .flatMap((from) => tokenStatuses.map((to) => [from, to]))
      .filter(([from, to]) => !statusTransitions[from].includes(to));

    test('the transition table matches the API contract', () => {
      assert.deepEqual(validTransitions, [
        ['waiting', 'cancelled'],
        ['called', 'in_consultation'],
        ['called', 'skipped'],
        ['called', 'cancelled'],
        ['in_consultation', 'completed'],
        ['in_consultation', 'cancelled'],
      ]);
    });

    test('applies every documented transition', async () => {
      for (const [from, to] of validTransitions) {
        const token = await insertToken({ status: from });
        const response = await patchStatus('staffOpd', token._id, { status: to });

        assert.equal(response.status, 200, `${from} -> ${to}: ${response.rawBody}`);
        assert.deepEqual(response.body, { data: { id: token._id, status: to } });
        assert.equal(await statusOf(token._id), to);
        await QueueToken.deleteOne({ _id: token._id });
      }
    });

    test('records completion time when a consultation completes', async () => {
      const token = await insertToken({ status: 'in_consultation' });
      await patchStatus('admin', token._id, { status: 'completed' });

      assert.ok((await QueueToken.findById(token._id).lean()).completedAt instanceof Date);
    });

    test('rejects every other transition with 409 and leaves the token unchanged', async () => {
      for (const [from, to] of invalidTransitions) {
        const token = await insertToken({ status: from });
        const response = await patchStatus('staffOpd', token._id, { status: to });

        assertError(response, 409, 'CONFLICT');
        assert.equal(await statusOf(token._id), from, `${from} -> ${to}`);
        await QueueToken.deleteOne({ _id: token._id });
      }
    });

    test('waiting tokens can only be called through call-next', async () => {
      const token = await insertToken();
      const response = await patchStatus('staffOpd', token._id, { status: 'called' });

      assertError(response, 409, 'CONFLICT');
      assert.match(response.body.error.message, /call-next/);
    });

    test('rejects unknown statuses and malformed bodies with 400', async () => {
      const token = await insertToken({ status: 'called' });

      for (const body of [{}, { status: 'resolved' }, { status: 'CALLED' }, { status: 1 }, { status: 'skipped', patientId: 'x' }, ['skipped']]) {
        assertError(await patchStatus('staffOpd', token._id, body), 400, 'VALIDATION_ERROR');
      }
      assertError(await patchStatus('staffOpd', 'bad%24id', { status: 'skipped' }), 400, 'VALIDATION_ERROR');
      assert.equal(await statusOf(token._id), 'called');
    });

    test('patients cannot change statuses, even on their own token', async () => {
      const token = await insertToken({ status: 'called', patientId: users.patient._id });

      assertError(await patchStatus('patient', token._id, { status: 'cancelled' }), 403, 'FORBIDDEN');
      assertError(await patchStatus(null, token._id, { status: 'cancelled' }), 401, 'UNAUTHORIZED');
      assert.equal(await statusOf(token._id), 'called');
    });

    test('staff can only update tokens in their assigned department', async () => {
      const token = await insertToken({ status: 'called' });

      assertError(await patchStatus('staffCardio', token._id, { status: 'skipped' }), 404, 'NOT_FOUND');
      assertError(await patchStatus('staffUnassigned', token._id, { status: 'skipped' }), 404, 'NOT_FOUND');
      assertError(await patchStatus('admin', 'token_missing', { status: 'skipped' }), 404, 'NOT_FOUND');
      assert.equal(await statusOf(token._id), 'called');
      assert.equal((await patchStatus('admin', token._id, { status: 'skipped' })).status, 200);
    });

    test('concurrent conflicting updates apply exactly one transition', async () => {
      // Neither in_consultation -> skipped nor skipped -> in_consultation is valid,
      // so exactly one of these requests can ever succeed.
      for (let round = 0; round < 5; round += 1) {
        const token = await insertToken({ status: 'called' });

        const responses = await Promise.all([
          patchStatus('staffOpd', token._id, { status: 'in_consultation' }),
          patchStatus('admin', token._id, { status: 'skipped' }),
          patchStatus('staffOpd', token._id, { status: 'skipped' }),
          patchStatus('admin', token._id, { status: 'in_consultation' }),
        ]);
        const winners = responses.filter((response) => response.status === 200);

        assert.equal(winners.length, 1, responses.map((response) => response.status).join(','));
        assert.ok(responses.every((response) => [200, 409].includes(response.status)));
        assert.equal(await statusOf(token._id), winners[0].body.data.status);
        await QueueToken.deleteOne({ _id: token._id });
      }
    });

    test('concurrent updates that form a valid chain are applied in order', async () => {
      // called -> in_consultation -> cancelled is a valid path, so both may succeed;
      // every success is validated against the status current at that moment.
      const token = await insertToken({ status: 'called' });

      const responses = await Promise.all([
        patchStatus('staffOpd', token._id, { status: 'in_consultation' }),
        patchStatus('admin', token._id, { status: 'cancelled' }),
      ]);
      const applied = responses.filter((response) => response.status === 200).map((response) => response.body.data.status);
      const finalStatus = await statusOf(token._id);

      assert.ok(applied.length >= 1);
      assert.equal(finalStatus, applied.includes('cancelled') ? 'cancelled' : 'in_consultation');
    });

    test('freed called slot can be refilled by call-next after skip', async () => {
      const called = await insertToken({ status: 'called' });
      const waiting = await insertToken();

      assertError(await callNext('staffOpd', OPD), 409, 'CONFLICT');
      assert.equal((await patchStatus('staffOpd', called._id, { status: 'skipped' })).status, 200);
      const response = await callNext('staffOpd', OPD);

      assert.equal(response.status, 200);
      assert.equal(response.body.data.id, waiting._id);
    });
  });
});

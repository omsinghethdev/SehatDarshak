import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { AssistanceRequest } from '../src/modules/assistance/assistanceRequest.model.js';
import { QueueToken } from '../src/modules/tokens/queueToken.model.js';
import { User } from '../src/modules/users/user.model.js';
import { demoDepartments, demoFloors, demoRooms } from '../src/seed/demoData.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { signAccessToken } from '../src/utils/accessToken.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { bearer, request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('dashboard');
const app = createApp();

const OPD = 'dept_demo_opd';
const CARDIO = 'dept_test_cardio';
const CLOSED = 'dept_test_closed';
const path = '/api/dashboard/statistics';

const users = {};
const headersFor = (name) => (name ? bearer(signAccessToken({ id: users[name]._id, role: users[name].role })) : {});
const getStatistics = (name = 'admin') => request(app, { path, headers: headersFor(name) });

let sequence = 0;
const patientIds = [];
async function insertTokens(departmentId, status, count) {
  const prefix = { [OPD]: 'OPD', [CARDIO]: 'CARD', [CLOSED]: 'CLSD' }[departmentId];
  for (let index = 0; index < count; index += 1) {
    sequence += 1;
    const patientId = new mongoose.Types.ObjectId();
    patientIds.push(String(patientId));
    await QueueToken.create({
      displayNumber: `${prefix}-${String(sequence).padStart(3, '0')}`,
      sequence,
      patientId,
      departmentId,
      status,
    });
  }
}

async function insertRequests(departmentId, status, count) {
  for (let index = 0; index < count; index += 1) {
    await AssistanceRequest.create({
      patientId: users.patient._id,
      departmentId,
      location: 'Private location text',
      message: 'Private message text',
      status,
    });
  }
}

const zeroQueue = {
  waiting: 0,
  called: 0,
  in_consultation: 0,
  active: 0,
  currentCalledDisplayNumber: null,
  estimatedWaitMinutes: 0,
  estimateLabel: 'Simulated estimate',
};

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

describe('GET /api/dashboard/statistics', { skip: databaseUnavailable }, () => {
  before(async () => {
    await seedDemoData({
      floors: demoFloors,
      departments: [
        ...demoDepartments,
        { _id: CARDIO, name: 'Test Cardiology', code: 'CARD', roomIds: [] },
        { _id: CLOSED, name: 'Closed Department', code: 'CLSD', roomIds: [], isActive: false },
      ],
      rooms: demoRooms,
    });

    for (const [name, fields] of [
      ['patient', { role: 'patient' }],
      ['staffOpd', { role: 'staff', departmentId: OPD }],
      ['admin', { role: 'admin' }],
    ]) {
      users[name] = await User.create({ name, identifier: name.toLowerCase(), passwordHash: 'unused-hash', ...fields });
    }
    await QueueToken.init();
  });
  beforeEach(async () => {
    await Promise.all([QueueToken.deleteMany({}), AssistanceRequest.deleteMany({})]);
    sequence = 0;
    patientIds.length = 0;
  });
  after(dropTestDatabase);

  test('returns zeroed statistics for an empty dataset', async () => {
    const response = await getStatistics();

    assert.equal(response.status, 200);
    const { generatedAt, ...statistics } = response.body.data;
    assert.equal(new Date(generatedAt).toISOString(), generatedAt);
    assert.deepEqual(statistics, {
      queueTokens: {
        total: 0,
        active: 0,
        byStatus: { waiting: 0, called: 0, in_consultation: 0, completed: 0, skipped: 0, cancelled: 0 },
      },
      assistanceRequests: { total: 0, byStatus: { open: 0, acknowledged: 0 } },
      departments: [
        { id: OPD, name: 'Demo OPD', code: 'OPD', queue: zeroQueue, openAssistanceRequests: 0 },
        { id: CARDIO, name: 'Test Cardiology', code: 'CARD', queue: zeroQueue, openAssistanceRequests: 0 },
      ],
    });
  });

  test('derives counts from stored tokens and assistance requests', async () => {
    await insertTokens(OPD, 'waiting', 3);
    await insertTokens(OPD, 'called', 1);
    await insertTokens(OPD, 'in_consultation', 1);
    await insertTokens(OPD, 'completed', 2);
    await insertTokens(OPD, 'skipped', 1);
    await insertTokens(OPD, 'cancelled', 1);
    await insertTokens(CARDIO, 'waiting', 1);
    await insertTokens(CARDIO, 'completed', 1);
    await insertTokens(CLOSED, 'waiting', 1);
    await insertRequests(OPD, 'open', 2);
    await insertRequests(OPD, 'acknowledged', 1);
    await insertRequests(CARDIO, 'open', 1);
    const calledDisplayNumber = (await QueueToken.findOne({ status: 'called' }).lean()).displayNumber;

    const { data } = (await getStatistics()).body;

    assert.deepEqual(data.queueTokens, {
      total: 12,
      active: 7,
      byStatus: { waiting: 5, called: 1, in_consultation: 1, completed: 3, skipped: 1, cancelled: 1 },
    });
    assert.deepEqual(data.assistanceRequests, { total: 4, byStatus: { open: 3, acknowledged: 1 } });
    assert.deepEqual(data.departments, [
      {
        id: OPD,
        name: 'Demo OPD',
        code: 'OPD',
        queue: {
          waiting: 3,
          called: 1,
          in_consultation: 1,
          active: 5,
          currentCalledDisplayNumber: calledDisplayNumber,
          estimatedWaitMinutes: 15,
          estimateLabel: 'Simulated estimate',
        },
        openAssistanceRequests: 2,
      },
      {
        id: CARDIO,
        name: 'Test Cardiology',
        code: 'CARD',
        queue: { ...zeroQueue, waiting: 1, active: 1, estimatedWaitMinutes: 5 },
        openAssistanceRequests: 1,
      },
    ]);
  });

  test('reflects changes on the next request', async () => {
    await insertTokens(OPD, 'waiting', 2);
    assert.equal((await getStatistics()).body.data.departments[0].queue.waiting, 2);

    await QueueToken.updateOne({ departmentId: OPD, status: 'waiting' }, { $set: { status: 'called' } });
    const queue = (await getStatistics()).body.data.departments[0].queue;

    assert.equal(queue.waiting, 1);
    assert.equal(queue.called, 1);
    assert.match(queue.currentCalledDisplayNumber, /^OPD-\d{3}$/);
  });

  test('does not expose patient identities, credentials, or request contents', async () => {
    await insertTokens(OPD, 'waiting', 2);
    await insertRequests(OPD, 'open', 1);

    const response = await getStatistics();

    for (const patientId of [...patientIds, String(users.patient._id)]) {
      assert.equal(response.rawBody.includes(patientId), false);
    }
    assert.doesNotMatch(
      response.rawBody,
      /patientId|identifier|password|unused-hash|Private location text|Private message text|token_|assist_/,
    );
  });

  test('only admins may read statistics', async () => {
    assertError(await getStatistics(null), 401, 'UNAUTHORIZED');
    assertError(await request(app, { path, headers: bearer('invalid.jwt.value') }), 401, 'UNAUTHORIZED');
    assertError(await getStatistics('patient'), 403, 'FORBIDDEN');
    assertError(await getStatistics('staffOpd'), 403, 'FORBIDDEN');
    assert.equal((await getStatistics('admin')).status, 200);
  });

  test('no write or management endpoints exist under /api/dashboard', async () => {
    for (const [method, routePath] of [
      ['POST', path],
      ['PUT', path],
      ['DELETE', path],
      ['GET', '/api/dashboard/departments'],
      ['POST', '/api/dashboard/staff'],
    ]) {
      const response = await request(app, { method, path: routePath, headers: headersFor('admin'), body: {} });
      assertError(response, 404, 'NOT_FOUND');
    }
  });

  test('database failures return a safe 500 without internal details', async () => {
    const originalAggregate = QueueToken.aggregate;
    QueueToken.aggregate = () => Promise.reject(new Error('Sensitive database failure detail'));

    try {
      const response = await getStatistics();

      assert.deepEqual(response.body, {
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      });
      assert.equal(response.status, 500);
      assert.doesNotMatch(response.rawBody, /Sensitive database failure detail/);
    } finally {
      QueueToken.aggregate = originalAggregate;
    }
  });
});

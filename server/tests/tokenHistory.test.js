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

const databaseUnavailable = await connectTestDatabase('token_history');
const app = createApp();

const OPD = 'dept_demo_opd';
// Direct inserts below do not need a seeded department; these IDs keep active tokens apart.
const MED = 'dept_test_other';
const HISTORY = '/api/patients/me/queue-tokens';
const historyKeys = ['calledAt', 'completedAt', 'departmentId', 'displayNumber', 'id', 'issuedAt', 'status'];
const users = {};
const headersFor = (name) => bearer(signAccessToken({ id: users[name]._id, role: users[name].role }));

const history = (name, query = '') =>
  request(app, { path: `${HISTORY}${query}`, headers: name ? headersFor(name) : {} });
const book = (name, departmentId = OPD) =>
  request(app, { method: 'POST', path: '/api/queue-tokens', headers: headersFor(name), body: { departmentId } });

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

// Inserts a token directly, with a chosen status and issue time, for deterministic history.
let sequence = 0;
async function insertToken(name, status, issuedAt, departmentId = OPD) {
  sequence += 1;
  const token = await QueueToken.create({
    displayNumber: `T-${String(sequence).padStart(3, '0')}`,
    sequence,
    patientId: users[name]._id,
    departmentId,
    status,
    issuedAt,
  });
  return token._id;
}

describe('GET /api/patients/me/queue-tokens (token history)', { skip: databaseUnavailable }, () => {
  before(async () => {
    await seedDemoData({ floors: demoFloors, departments: demoDepartments, rooms: demoRooms });
    for (const [name, fields] of [
      ['patientA', { role: 'patient' }],
      ['patientB', { role: 'patient' }],
      ['patientEmpty', { role: 'patient' }],
      ['staffOpd', { role: 'staff', departmentId: OPD }],
      ['admin', { role: 'admin' }],
    ]) {
      users[name] = await User.create({ name, identifier: name.toLowerCase(), passwordHash: 'not-used-in-these-tests', ...fields });
    }
    await QueueToken.init();
  });
  beforeEach(async () => {
    sequence = 0;
    await Promise.all([QueueToken.deleteMany({}), TokenCounter.deleteMany({})]);
  });
  after(dropTestDatabase);

  test("a patient sees their own finished tokens, newest first, in the patient-safe shape", async () => {
    const older = await insertToken('patientA', 'completed', new Date('2026-01-01T09:00:00Z'));
    const newer = await insertToken('patientA', 'cancelled', new Date('2026-01-02T09:00:00Z'), MED);

    const response = await history('patientA');

    assert.equal(response.status, 200, response.rawBody);
    assert.deepEqual(response.body.data.map((token) => token.id), [newer, older]);
    assert.deepEqual(response.body.meta, { page: 1, limit: 20, total: 2 });
    for (const token of response.body.data) {
      assert.deepEqual(Object.keys(token).sort(), historyKeys);
    }
    assert.deepEqual(response.body.data[0], {
      id: newer,
      displayNumber: 'T-002',
      departmentId: MED,
      status: 'cancelled',
      issuedAt: '2026-01-02T09:00:00.000Z',
      calledAt: null,
      completedAt: null,
    });
    assert.doesNotMatch(response.rawBody, /patientId|sequence|patientsAhead|estimate/);
  });

  test('timestamps come only from the real staff flow (call-next, then completion)', async () => {
    const booked = await book('patientA');
    const tokenId = booked.body.data.id;
    const staff = headersFor('staffOpd');
    assert.equal((await request(app, { method: 'POST', path: `/api/queues/${OPD}/call-next`, headers: staff, body: {} })).status, 200);
    for (const status of ['in_consultation', 'completed']) {
      const patched = await request(app, { method: 'PATCH', path: `/api/queue-tokens/${tokenId}/status`, headers: staff, body: { status } });
      assert.equal(patched.status, 200, patched.rawBody);
    }

    const [entry] = (await history('patientA')).body.data;

    assert.equal(entry.id, tokenId);
    assert.equal(entry.status, 'completed');
    for (const field of ['issuedAt', 'calledAt', 'completedAt']) {
      assert.ok(!Number.isNaN(Date.parse(entry[field])), `${field} is a timestamp`);
    }
    assert.ok(entry.issuedAt <= entry.calledAt && entry.calledAt <= entry.completedAt);
  });

  test("another patient's tokens are never included, even when a patient ID is supplied", async () => {
    await insertToken('patientA', 'completed', new Date('2026-01-01T09:00:00Z'));
    const bToken = await insertToken('patientB', 'skipped', new Date('2026-01-03T09:00:00Z'));

    for (const query of ['', `?patientId=${users.patientB._id}`, `?patientId=${users.patientB._id}&status=skipped`]) {
      const response = await history('patientA', query);
      assert.equal(response.status, 200, response.rawBody);
      assert.ok(response.body.data.every((token) => token.id !== bToken), query);
      assert.doesNotMatch(response.rawBody, new RegExp(bToken));
    }
    assert.deepEqual((await history('patientB')).body.data.map((token) => token.id), [bToken]);
  });

  test('unauthenticated and invalid-token requests are rejected; staff and admins are forbidden', async () => {
    assertError(await history(null), 401, 'UNAUTHORIZED');
    assertError(await request(app, { path: HISTORY, headers: bearer('invalid.jwt.value') }), 401, 'UNAUTHORIZED');
    assertError(await history('staffOpd'), 403, 'FORBIDDEN');
    assertError(await history('admin'), 403, 'FORBIDDEN');
  });

  test('only completed, skipped, and cancelled tokens are returned by default; status filters them', async () => {
    const day = (n) => new Date(`2026-02-0${n}T09:00:00Z`);
    const completed = await insertToken('patientA', 'completed', day(1));
    const skipped = await insertToken('patientA', 'skipped', day(2), MED);
    const cancelled = await insertToken('patientA', 'cancelled', day(3));
    // One token per active status, each in its own department (one-active-token rule).
    await insertToken('patientA', 'waiting', day(4), MED);
    await insertToken('patientA', 'in_consultation', day(5), 'dept_test_third');
    await insertToken('patientA', 'called', day(6), 'dept_test_fourth');

    const all = await history('patientA');
    assert.deepEqual(all.body.data.map((token) => token.id), [cancelled, skipped, completed]);
    assert.equal(all.body.meta.total, 3);

    for (const [status, id] of [['completed', completed], ['skipped', skipped], ['cancelled', cancelled]]) {
      const filtered = await history('patientA', `?status=${status}`);
      assert.equal(filtered.status, 200, filtered.rawBody);
      assert.deepEqual(filtered.body.data.map((token) => token.id), [id]);
      assert.equal(filtered.body.meta.total, 1);
    }
  });

  test('invalid status, page, and limit values are rejected with VALIDATION_ERROR', async () => {
    for (const query of [
      '?status=waiting',
      '?status=called',
      '?status=in_consultation',
      '?status=finished',
      '?status=completed&status=skipped',
      '?page=0',
      '?page=-1',
      '?page=abc',
      '?page=1.5',
      '?limit=0',
      '?limit=101',
      '?limit=ten',
      '?limit=1&limit=2',
    ]) {
      const response = await history('patientA', query);
      assertError(response, 400, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(response.body.error.details), query);
    }

    // Empty values mean "not supplied", as on every other list endpoint.
    const defaults = await history('patientA', '?status=&page=&limit=');
    assert.equal(defaults.status, 200, defaults.rawBody);
    assert.deepEqual(defaults.body.meta, { page: 1, limit: 20, total: 0 });
    assert.equal((await history('patientA', '?limit=100')).status, 200);
  });

  test('pagination is stable: pages never overlap or skip entries, even with equal timestamps', async () => {
    const sameTime = new Date('2026-03-01T09:00:00Z');
    const statuses = ['completed', 'skipped', 'cancelled'];
    for (let index = 0; index < 7; index += 1) {
      // Four tokens share one issue time, so only the _id tie-break orders them.
      const issuedAt = index < 4 ? sameTime : new Date(Date.UTC(2026, 2, 2 + index));
      await insertToken('patientA', statuses[index % 3], issuedAt);
    }

    const full = (await history('patientA', '?limit=100')).body.data.map((token) => token.id);
    assert.equal(full.length, 7);

    const paged = [];
    for (let page = 1; page <= 3; page += 1) {
      const response = await history('patientA', `?page=${page}&limit=3`);
      assert.equal(response.status, 200, response.rawBody);
      assert.deepEqual(response.body.meta, { page, limit: 3, total: 7 });
      paged.push(...response.body.data.map((token) => token.id));
    }
    assert.deepEqual(paged, full);
    assert.equal(new Set(paged).size, 7);

    // Repeating a request gives the same order.
    const again = (await history('patientA', '?limit=100')).body.data.map((token) => token.id);
    assert.deepEqual(again, full);

    const beyond = await history('patientA', '?page=4&limit=3');
    assert.equal(beyond.status, 200);
    assert.deepEqual(beyond.body, { data: [], meta: { page: 4, limit: 3, total: 7 } });
  });

  test('a patient without past tokens gets a valid empty response', async () => {
    await insertToken('patientA', 'completed', new Date('2026-01-01T09:00:00Z'));

    const response = await history('patientEmpty');

    assert.equal(response.status, 200, response.rawBody);
    assert.deepEqual(response.body, { data: [], meta: { page: 1, limit: 20, total: 0 } });
  });

  test('active tokens stay on the active-token endpoint and out of history', async () => {
    const booked = await book('patientA');
    assert.equal(booked.status, 201, booked.rawBody);

    const active = await request(app, { path: `${HISTORY}/active`, headers: headersFor('patientA') });
    assert.equal(active.status, 200);
    assert.deepEqual(active.body.data.map((token) => token.id), [booked.body.data.id]);
    assert.equal(active.body.data[0].status, 'waiting');

    assert.deepEqual((await history('patientA')).body.data, []);
  });

  test('booking and cancellation behave as before; reading history changes nothing', async () => {
    const first = (await book('patientA')).body.data.id;
    assertError(await book('patientA'), 409, 'CONFLICT');

    await history('patientA');
    assert.equal((await QueueToken.findById(first).lean()).status, 'waiting');

    const cancelled = await request(app, {
      method: 'POST',
      path: `/api/queue-tokens/${first}/cancel`,
      headers: headersFor('patientA'),
      body: {},
    });
    assert.equal(cancelled.status, 200, cancelled.rawBody);

    const afterCancel = await history('patientA');
    assert.deepEqual(afterCancel.body.data.map((token) => [token.id, token.status]), [[first, 'cancelled']]);

    const second = await book('patientA');
    assert.equal(second.status, 201, second.rawBody);
    assert.deepEqual((await history('patientA')).body.data.map((token) => token.id), [first]);
    assert.equal((await QueueToken.findById(second.body.data.id).lean()).status, 'waiting');
  });
});

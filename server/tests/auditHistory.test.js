import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { QueueToken } from '../src/modules/tokens/queueToken.model.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { MED, OPD, authHeaders, createUser, seedHospital } from './helpers/fixtures.js';
import { request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('audit_history');
const app = createApp();
const auditPath = '/api/admin/audit/queue-token-status-changes';

const callNext = (user, departmentId = OPD) => request(app, { method: 'POST', path: `/api/queues/${departmentId}/call-next`, headers: authHeaders(user), body: {} });
const setStatus = (user, tokenId, status) => request(app, { method: 'PATCH', path: `/api/queue-tokens/${tokenId}/status`, headers: authHeaders(user), body: { status } });
const readAudit = (user, query = '') => request(app, { path: `${auditPath}${query}`, headers: authHeaders(user) });
const historyOf = async (tokenId) => (await QueueToken.findById(tokenId).select('+statusHistory').lean()).statusHistory ?? [];

let sequence = 0;
async function insertWaiting(departmentId = OPD) {
  sequence += 1;
  const token = await QueueToken.create({
    displayNumber: `AUD-${String(sequence).padStart(3, '0')}`,
    sequence,
    patientId: new mongoose.Types.ObjectId(),
    departmentId,
    status: 'waiting',
  });
  return token._id;
}

describe('queue-token status audit history', { skip: databaseUnavailable }, () => {
  const users = {};

  before(async () => {
    await seedHospital();
    users.admin = await createUser({ role: 'admin' });
    users.staff = await createUser({ role: 'staff', departmentId: OPD });
    users.otherStaff = await createUser({ role: 'staff', departmentId: MED });
    users.patient = await createUser({ role: 'patient' });
  });

  beforeEach(async () => {
    await QueueToken.deleteMany({});
  });

  after(async () => {
    await dropTestDatabase();
  });

  test('call-next and each status update record one entry with actor, statuses, and action', async () => {
    const tokenId = await insertWaiting();
    assert.equal((await callNext(users.staff)).status, 200);
    assert.equal((await setStatus(users.staff, tokenId, 'in_consultation')).status, 200);
    assert.equal((await setStatus(users.admin, tokenId, 'completed')).status, 200);

    const history = await historyOf(tokenId);
    assert.deepEqual(
      history.map(({ fromStatus, toStatus, action, actorRole }) => ({ fromStatus, toStatus, action, actorRole })),
      [
        { fromStatus: 'waiting', toStatus: 'called', action: 'call_next', actorRole: 'staff' },
        { fromStatus: 'called', toStatus: 'in_consultation', action: 'status_update', actorRole: 'staff' },
        { fromStatus: 'in_consultation', toStatus: 'completed', action: 'status_update', actorRole: 'admin' },
      ],
    );
    assert.equal(String(history[0].actorId), String(users.staff._id));

    const audit = await readAudit(users.admin);
    assert.equal(audit.status, 200, audit.rawBody);
    assert.equal(audit.body.meta.total, 3);
    // Newest first, contract shape, no patient identity.
    assert.deepEqual(Object.keys(audit.body.data[0]).sort(), ['action', 'actor', 'departmentId', 'displayNumber', 'fromStatus', 'id', 'occurredAt', 'toStatus', 'tokenId']);
    assert.equal(audit.body.data[0].toStatus, 'completed');
    assert.deepEqual(audit.body.data[0].actor, { id: String(users.admin._id), role: 'admin' });
    assert.ok(!audit.rawBody.includes('patientId'));
  });

  test('rejected or failed changes write no entry', async () => {
    const tokenId = await insertWaiting();
    // Invalid transition, forbidden role, out-of-scope staff, invalid body.
    assert.equal((await setStatus(users.staff, tokenId, 'completed')).status, 409);
    assert.equal((await setStatus(users.patient, tokenId, 'cancelled')).status, 403);
    assert.equal((await setStatus(users.otherStaff, tokenId, 'cancelled')).status, 404);
    assert.equal((await setStatus(users.staff, tokenId, 'finished')).status, 400);
    // call-next in a department with nobody waiting, and with a token already called.
    assert.equal((await callNext(users.admin, MED)).status, 409);
    assert.equal((await callNext(users.staff)).status, 200);
    await insertWaiting();
    assert.equal((await callNext(users.staff)).status, 409);

    assert.equal((await historyOf(tokenId)).length, 1);
    assert.equal((await readAudit(users.admin)).body.meta.total, 1);
  });

  test('losing a concurrent compare-and-set writes no entry: exactly one change and one entry', async () => {
    const tokenId = await insertWaiting();
    await callNext(users.staff);
    const results = await Promise.all(
      ['in_consultation', 'skipped', 'cancelled', 'skipped', 'in_consultation'].map((status) => setStatus(users.staff, tokenId, status)),
    );
    assert.equal(results.filter((result) => result.status === 200).length, 1);
    const history = await historyOf(tokenId);
    assert.equal(history.length, 2);
    assert.equal(history[1].toStatus, (await QueueToken.findById(tokenId).lean()).status);
  });

  test('audit entries never appear in patient or staff token responses', async () => {
    const patient = await createUser({ role: 'patient' });
    const created = await request(app, { method: 'POST', path: '/api/queue-tokens', headers: authHeaders(patient), body: { departmentId: OPD } });
    await callNext(users.staff);
    for (const [user, path] of [
      [patient, `/api/queue-tokens/${created.body.data.id}`],
      [patient, '/api/patients/me/queue-tokens/active'],
      [users.staff, `/api/queue-tokens/${created.body.data.id}`],
      [users.staff, `/api/queues/${OPD}`],
    ]) {
      const response = await request(app, { path, headers: authHeaders(user) });
      assert.equal(response.status, 200, response.rawBody);
      assert.ok(!/statusHistory|actorId|visitId/.test(response.rawBody), `${path}: ${response.rawBody}`);
    }
  });

  test('filters, pagination, validation, and admin-only access', async () => {
    const opdToken = await insertWaiting(OPD);
    await insertWaiting(MED);
    await callNext(users.staff, OPD);
    await callNext(users.admin, MED);
    await setStatus(users.admin, opdToken, 'skipped');

    const ids = async (query) => (await readAudit(users.admin, query)).body.data.map((entry) => `${entry.departmentId}:${entry.toStatus}`);
    assert.deepEqual(await ids(`?departmentId=${MED}`), [`${MED}:called`]);
    assert.deepEqual(await ids(`?tokenId=${opdToken}`), [`${OPD}:skipped`, `${OPD}:called`]);
    assert.deepEqual(await ids(`?actorId=${users.staff._id}`), [`${OPD}:called`]);
    assert.deepEqual(await ids('?from=2000-01-01T00:00:00Z&to=2000-01-02T00:00:00Z'), []);
    assert.equal((await ids(`?from=${new Date(Date.now() - 60_000).toISOString()}`)).length, 3);

    const page = await readAudit(users.admin, '?limit=1&page=2');
    assert.deepEqual(page.body.meta, { page: 2, limit: 1, total: 3 });
    assert.equal(page.body.data.length, 1);

    for (const query of ['?from=yesterday', '?from=2026-03-02T00:00:00Z&to=2026-03-01T00:00:00Z', '?actorId=abc', '?tokenId=bad%20id!', '?limit=0']) {
      assert.equal((await readAudit(users.admin, query)).status, 400, query);
    }
    assert.equal((await request(app, { path: auditPath })).status, 401);
    assert.equal((await readAudit(users.patient)).status, 403);
    assert.equal((await readAudit(users.staff)).status, 403);
  });
});

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { AssistanceRequest } from '../src/modules/assistance/assistanceRequest.model.js';
import { User } from '../src/modules/users/user.model.js';
import { demoDepartments, demoFloors, demoRooms } from '../src/seed/demoData.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { signAccessToken } from '../src/utils/accessToken.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { bearer, request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('assistance');
const app = createApp();

const OPD = 'dept_demo_opd';
const CARDIO = 'dept_test_cardio';
const notice = 'Request sent to hospital staff; this is not guaranteed emergency medical response.';
const publicKeys = ['createdAt', 'id', 'notice', 'status'];
const staffKeys = ['createdAt', 'departmentId', 'id', 'location', 'message', 'notice', 'status'];
const validBody = {
  departmentId: OPD,
  location: 'Ground floor registration desk',
  message: 'Need help finding the OPD',
};

const users = {};
const headersFor = (name) => (name ? bearer(signAccessToken({ id: users[name]._id, role: users[name].role })) : {});

const create = (name, body = validBody) => request(app, {
  method: 'POST',
  path: '/api/assistance-requests',
  headers: headersFor(name),
  body,
});
const getAs = (name, path) => request(app, { path, headers: headersFor(name) });
const acknowledge = (name, requestId, body = {}) => request(app, {
  method: 'PATCH',
  path: `/api/assistance-requests/${requestId}/acknowledge`,
  headers: headersFor(name),
  body,
});

// Inserts requests directly with controlled creation times for ordering/pagination tests.
let clock = Date.parse('2026-10-24T10:00:00.000Z');
async function insertRequest({ patient = 'patientA', departmentId = OPD, status = 'open' } = {}) {
  clock += 60_000;
  const createdAt = new Date(clock);
  const [inserted] = await AssistanceRequest.insertMany([{
    patientId: users[patient]._id,
    departmentId,
    location: 'Test location',
    message: `Test message ${clock}`,
    status,
    createdAt,
    updatedAt: createdAt,
  }], { timestamps: false });
  return inserted.toObject();
}

const statusOf = async (requestId) => (await AssistanceRequest.findById(requestId).lean()).status;

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

describe('assistance requests', { skip: databaseUnavailable }, () => {
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
      ['patientA', { role: 'patient' }],
      ['patientB', { role: 'patient' }],
      ['staffOpd', { role: 'staff', departmentId: OPD }],
      ['staffCardio', { role: 'staff', departmentId: CARDIO }],
      ['staffUnassigned', { role: 'staff' }],
      ['admin', { role: 'admin' }],
    ]) {
      users[name] = await User.create({ name, identifier: name.toLowerCase(), passwordHash: 'unused', ...fields });
    }
  });
  beforeEach(() => AssistanceRequest.deleteMany({}));
  after(dropTestDatabase);

  describe('POST /api/assistance-requests', () => {
    test('creates an open request in the documented shape with the non-emergency notice', async () => {
      const response = await create('patientA');

      assert.equal(response.status, 201);
      assert.deepEqual(Object.keys(response.body.data).sort(), publicKeys);
      assert.match(response.body.data.id, /^assist_[a-f0-9]{24}$/);
      assert.equal(response.body.data.status, 'open');
      assert.equal(response.body.data.notice, notice);
      assert.equal(new Date(response.body.data.createdAt).toISOString(), response.body.data.createdAt);

      const stored = await AssistanceRequest.findById(response.body.data.id).lean();
      assert.equal(String(stored.patientId), String(users.patientA._id));
      assert.equal(stored.departmentId, OPD);
      assert.equal(stored.location, validBody.location);
      assert.equal(stored.message, validBody.message);
    });

    test('trims text fields', async () => {
      const response = await create('patientA', { ...validBody, location: '  Gate 2  ', message: '\n Help please \t' });
      const stored = await AssistanceRequest.findById(response.body.data.id).lean();

      assert.equal(stored.location, 'Gate 2');
      assert.equal(stored.message, 'Help please');
    });

    test('rejects invalid fields, client-supplied server fields, and unknown departments', async () => {
      const cases = [
        [{ ...validBody, departmentId: undefined }, 400, 'departmentId'],
        [{ ...validBody, departmentId: 'bad.id' }, 400, 'departmentId'],
        [{ ...validBody, location: '' }, 400, 'location'],
        [{ ...validBody, location: '   ' }, 400, 'location'],
        [{ ...validBody, location: 42 }, 400, 'location'],
        [{ ...validBody, message: undefined }, 400, 'message'],
        [{ ...validBody, message: 'x'.repeat(501) }, 400, 'message'],
        [{ ...validBody, location: 'x'.repeat(201) }, 400, 'location'],
        [{ ...validBody, status: 'acknowledged' }, 400, 'status'],
        [{ ...validBody, status: 'resolved' }, 400, 'status'],
        [{ ...validBody, patientId: String(users.patientB._id) }, 400, 'patientId'],
      ];

      for (const [body, status, field] of cases) {
        const response = await create('patientA', body);
        assertError(response, status, 'VALIDATION_ERROR');
        assert.equal(response.body.error.details[0].field, field, field);
      }

      assertError(await create('patientA', [validBody]), 400, 'VALIDATION_ERROR');
      assertError(await create('patientA', { ...validBody, departmentId: 'dept_missing' }), 404, 'NOT_FOUND');
      assertError(await create('patientA', { ...validBody, departmentId: 'dept_test_closed' }), 404, 'NOT_FOUND');
      assert.equal(await AssistanceRequest.countDocuments(), 0);
    });

    test('only authenticated patients may create requests', async () => {
      assertError(await create(null), 401, 'UNAUTHORIZED');
      for (const name of ['staffOpd', 'admin']) {
        assertError(await create(name), 403, 'FORBIDDEN');
      }
      assert.equal(await AssistanceRequest.countDocuments(), 0);
    });
  });

  describe('GET /api/assistance-requests/me', () => {
    test('lists only the caller\'s own requests, newest first, in the public shape', async () => {
      const older = await insertRequest({ patient: 'patientA' });
      await insertRequest({ patient: 'patientB' });
      const newer = await insertRequest({ patient: 'patientA', departmentId: CARDIO, status: 'acknowledged' });

      const response = await getAs('patientA', '/api/assistance-requests/me');

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.meta, { page: 1, limit: 20, total: 2 });
      assert.deepEqual(response.body.data, [
        { id: newer._id, status: 'acknowledged', createdAt: newer.createdAt.toISOString(), notice },
        { id: older._id, status: 'open', createdAt: older.createdAt.toISOString(), notice },
      ]);
      assert.doesNotMatch(response.rawBody, /patientId|acknowledgedBy|acknowledgedAt/);
    });

    test('paginates the caller\'s requests', async () => {
      const ids = [];
      for (let index = 0; index < 5; index += 1) {
        ids.unshift((await insertRequest())._id);
      }

      const page2 = await getAs('patientA', '/api/assistance-requests/me?page=2&limit=2');

      assert.deepEqual(page2.body.meta, { page: 2, limit: 2, total: 5 });
      assert.deepEqual(page2.body.data.map((item) => item.id), ids.slice(2, 4));
      assertError(await getAs('patientA', '/api/assistance-requests/me?limit=101'), 400, 'VALIDATION_ERROR');
    });

    test('returns an empty list when there are no requests and is patient-only', async () => {
      assert.deepEqual((await getAs('patientB', '/api/assistance-requests/me')).body, {
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      });
      assertError(await getAs(null, '/api/assistance-requests/me'), 401, 'UNAUTHORIZED');
      assertError(await getAs('staffOpd', '/api/assistance-requests/me'), 403, 'FORBIDDEN');
      assertError(await getAs('admin', '/api/assistance-requests/me'), 403, 'FORBIDDEN');
    });
  });

  describe('GET /api/assistance-requests', () => {
    test('staff see only their department; admins see all departments', async () => {
      const opdOpen = await insertRequest({ departmentId: OPD });
      const cardioOpen = await insertRequest({ departmentId: CARDIO, patient: 'patientB' });
      const opdAcknowledged = await insertRequest({ departmentId: OPD, status: 'acknowledged' });

      const staff = await getAs('staffOpd', '/api/assistance-requests');
      assert.equal(staff.status, 200);
      assert.deepEqual(staff.body.data.map((item) => item.id), [opdAcknowledged._id, opdOpen._id]);
      assert.deepEqual(staff.body.meta, { page: 1, limit: 20, total: 2 });
      for (const item of staff.body.data) {
        assert.deepEqual(Object.keys(item).sort(), staffKeys);
        assert.equal(item.notice, notice);
      }

      const admin = await getAs('admin', '/api/assistance-requests');
      assert.deepEqual(admin.body.data.map((item) => item.id), [opdAcknowledged._id, cardioOpen._id, opdOpen._id]);
    });

    test('filters by status and paginates', async () => {
      const open = [];
      for (let index = 0; index < 3; index += 1) {
        open.unshift((await insertRequest())._id);
      }
      await insertRequest({ status: 'acknowledged' });

      const openOnly = await getAs('staffOpd', '/api/assistance-requests?status=open&page=1&limit=2');
      assert.deepEqual(openOnly.body.meta, { page: 1, limit: 2, total: 3 });
      assert.deepEqual(openOnly.body.data.map((item) => item.id), open.slice(0, 2));

      const acknowledgedOnly = await getAs('staffOpd', '/api/assistance-requests?status=acknowledged');
      assert.equal(acknowledgedOnly.body.meta.total, 1);
      assert.equal(acknowledgedOnly.body.data[0].status, 'acknowledged');

      const emptyStatus = await getAs('staffOpd', '/api/assistance-requests?status=&page=&limit=');
      assert.equal(emptyStatus.body.meta.total, 4);
    });

    test('rejects undocumented status values', async () => {
      for (const status of ['resolved', 'closed', 'OPEN']) {
        const response = await getAs('admin', `/api/assistance-requests?status=${status}`);
        assertError(response, 400, 'VALIDATION_ERROR');
        assert.equal(response.body.error.details[0].field, 'status');
      }
    });

    test('enforces role permissions', async () => {
      assertError(await getAs(null, '/api/assistance-requests'), 401, 'UNAUTHORIZED');
      assertError(await getAs('patientA', '/api/assistance-requests'), 403, 'FORBIDDEN');
      assertError(await getAs('staffUnassigned', '/api/assistance-requests'), 403, 'FORBIDDEN');
    });

    test('does not expose patient or acknowledger identities', async () => {
      const item = await insertRequest();
      await acknowledge('staffOpd', item._id);

      const response = await getAs('admin', '/api/assistance-requests');
      assert.equal(response.rawBody.includes(String(users.patientA._id)), false);
      assert.equal(response.rawBody.includes(String(users.staffOpd._id)), false);
      assert.doesNotMatch(response.rawBody, /patientId|acknowledgedBy|acknowledgedAt/);
    });
  });

  describe('PATCH /api/assistance-requests/:requestId/acknowledge', () => {
    test('assigned staff acknowledge an open request', async () => {
      const item = await insertRequest();

      const response = await acknowledge('staffOpd', item._id);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: { id: item._id, status: 'acknowledged' } });
      const stored = await AssistanceRequest.findById(item._id).lean();
      assert.equal(stored.status, 'acknowledged');
      assert.equal(String(stored.acknowledgedBy), String(users.staffOpd._id));
      assert.ok(stored.acknowledgedAt instanceof Date);
    });

    test('admins can acknowledge requests in any department', async () => {
      const item = await insertRequest({ departmentId: CARDIO });
      assert.equal((await acknowledge('admin', item._id)).status, 200);
    });

    test('a second acknowledgement is rejected with 409 and keeps the original acknowledger', async () => {
      const item = await insertRequest();
      await acknowledge('staffOpd', item._id);

      const response = await acknowledge('admin', item._id);

      assertError(response, 409, 'CONFLICT');
      assert.equal(String((await AssistanceRequest.findById(item._id).lean()).acknowledgedBy), String(users.staffOpd._id));
    });

    test('concurrent acknowledgements succeed exactly once', async () => {
      const item = await insertRequest();

      const responses = await Promise.all(
        Array.from({ length: 6 }, (_, index) => acknowledge(index % 2 ? 'admin' : 'staffOpd', item._id)),
      );
      const statuses = responses.map((response) => response.status);

      assert.equal(statuses.filter((status) => status === 200).length, 1, statuses.join(','));
      assert.equal(statuses.filter((status) => status === 409).length, 5, statuses.join(','));
    });

    test('patients cannot acknowledge, even their own requests', async () => {
      const item = await insertRequest({ patient: 'patientA' });

      assertError(await acknowledge('patientA', item._id), 403, 'FORBIDDEN');
      assertError(await acknowledge(null, item._id), 401, 'UNAUTHORIZED');
      assert.equal(await statusOf(item._id), 'open');
    });

    test('staff cannot acknowledge requests outside their department', async () => {
      const item = await insertRequest({ departmentId: OPD });

      assertError(await acknowledge('staffCardio', item._id), 404, 'NOT_FOUND');
      assertError(await acknowledge('staffUnassigned', item._id), 404, 'NOT_FOUND');
      assert.equal(await statusOf(item._id), 'open');
    });

    test('rejects malformed IDs, missing requests, and request bodies with fields', async () => {
      const item = await insertRequest();

      assertError(await acknowledge('admin', 'bad%24id'), 400, 'VALIDATION_ERROR');
      assertError(await acknowledge('admin', 'assist_missing'), 404, 'NOT_FOUND');
      assertError(await acknowledge('admin', item._id, { status: 'resolved' }), 400, 'VALIDATION_ERROR');
      assert.equal(await statusOf(item._id), 'open');

      const noBody = await request(app, {
        method: 'PATCH',
        path: `/api/assistance-requests/${item._id}/acknowledge`,
        headers: headersFor('staffOpd'),
      });
      assert.equal(noBody.status, 200);
    });

    test('no other status-changing routes exist', async () => {
      const item = await insertRequest();

      for (const [method, path] of [
        ['PATCH', `/api/assistance-requests/${item._id}/resolve`],
        ['PATCH', `/api/assistance-requests/${item._id}`],
        ['DELETE', `/api/assistance-requests/${item._id}`],
      ]) {
        const response = await request(app, { method, path, headers: headersFor('admin'), body: {} });
        assertError(response, 404, 'NOT_FOUND');
      }
      assert.equal(await statusOf(item._id), 'open');
    });
  });

  test('stored statuses are limited to the documented lifecycle', async () => {
    await assert.rejects(
      () => AssistanceRequest.create({
        patientId: new mongoose.Types.ObjectId(),
        departmentId: OPD,
        location: 'x',
        message: 'y',
        status: 'resolved',
      }),
      /resolved/,
    );
  });
});

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

const databaseUnavailable = await connectTestDatabase('queue_tokens');
const app = createApp();

const tokenKeys = ['departmentId', 'displayNumber', 'estimateLabel', 'estimatedWaitMinutes', 'id', 'patientsAhead', 'status'];
const statusKeys = ['displayNumber', 'estimateLabel', 'estimatedWaitMinutes', 'id', 'patientsAhead', 'status'];

const users = {};
const headersFor = (name) => bearer(signAccessToken({ id: users[name]._id, role: users[name].role }));

const createToken = (userName, body) => request(app, {
  method: 'POST',
  path: '/api/queue-tokens',
  headers: headersFor(userName),
  body,
});
const getAs = (userName, path) => request(app, { path, headers: headersFor(userName) });

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

const setStatus = (tokenId, status) => QueueToken.updateOne({ _id: tokenId }, { $set: { status } });

describe('queue tokens', { skip: databaseUnavailable }, () => {
  before(async () => {
    await seedDemoData({
      floors: demoFloors,
      departments: [
        ...demoDepartments,
        { _id: 'dept_test_cardio', name: 'Test Cardiology', code: 'CARD', roomIds: [] },
        { _id: 'dept_test_closed', name: 'Closed Department', code: 'CLSD', roomIds: [], isActive: false },
      ],
      rooms: demoRooms,
    });

    const accounts = [
      ['patientA', { role: 'patient' }],
      ['patientB', { role: 'patient' }],
      ['patientC', { role: 'patient' }],
      ['staffOpd', { role: 'staff', departmentId: 'dept_demo_opd' }],
      ['staffCardio', { role: 'staff', departmentId: 'dept_test_cardio' }],
      ['staffUnassigned', { role: 'staff' }],
      ['admin', { role: 'admin' }],
    ];
    for (const [name, fields] of accounts) {
      users[name] = await User.create({
        name,
        identifier: name.toLowerCase(),
        passwordHash: 'not-used-in-these-tests',
        ...fields,
      });
    }
    await QueueToken.init();
  });
  beforeEach(() => Promise.all([QueueToken.deleteMany({}), TokenCounter.deleteMany({})]));
  after(dropTestDatabase);

  describe('POST /api/queue-tokens', () => {
    test('creates a waiting token for the authenticated patient', async () => {
      const response = await createToken('patientA', { departmentId: 'dept_demo_opd' });

      assert.equal(response.status, 201);
      const token = response.body.data;
      assert.deepEqual(Object.keys(token).sort(), tokenKeys);
      assert.match(token.id, /^token_[a-f0-9]{24}$/);
      assert.deepEqual({ ...token, id: undefined }, {
        id: undefined,
        displayNumber: 'OPD-001',
        departmentId: 'dept_demo_opd',
        status: 'waiting',
        patientsAhead: 0,
        estimatedWaitMinutes: 0,
        estimateLabel: 'Simulated estimate',
      });
      assert.doesNotMatch(response.rawBody, /patientId|sequence/);

      const stored = await QueueToken.findById(token.id).lean();
      assert.equal(String(stored.patientId), String(users.patientA._id));
      assert.equal(stored.patientsAheadSnapshot, 0);
      assert.ok(stored.issuedAt instanceof Date);
    });

    test('numbers tokens per department and reports simulated estimates', async () => {
      const first = await createToken('patientA', { departmentId: 'dept_demo_opd' });
      const second = await createToken('patientB', { departmentId: 'dept_demo_opd' });
      const otherDepartment = await createToken('patientC', { departmentId: 'dept_test_cardio' });

      assert.equal(first.body.data.displayNumber, 'OPD-001');
      assert.equal(second.body.data.displayNumber, 'OPD-002');
      assert.equal(second.body.data.patientsAhead, 1);
      assert.equal(second.body.data.estimatedWaitMinutes, 5);
      assert.equal(second.body.data.estimateLabel, 'Simulated estimate');
      assert.equal(otherDepartment.body.data.displayNumber, 'CARD-001');
      assert.equal(otherDepartment.body.data.patientsAhead, 0);
    });

    test('rejects a second active token in the same department with 409', async () => {
      const first = await createToken('patientA', { departmentId: 'dept_demo_opd' });

      for (const status of ['waiting', 'called', 'in_consultation']) {
        await setStatus(first.body.data.id, status);
        assertError(await createToken('patientA', { departmentId: 'dept_demo_opd' }), 409, 'CONFLICT');
      }
      assert.equal(await QueueToken.countDocuments(), 1);
    });

    test('allows active tokens in different departments', async () => {
      assert.equal((await createToken('patientA', { departmentId: 'dept_demo_opd' })).status, 201);
      assert.equal((await createToken('patientA', { departmentId: 'dept_test_cardio' })).status, 201);
    });

    test('allows a new token once the previous one is terminal', async () => {
      for (const status of ['completed', 'skipped', 'cancelled']) {
        const previous = await createToken('patientA', { departmentId: 'dept_demo_opd' });
        assert.equal(previous.status, 201, status);
        await setStatus(previous.body.data.id, status);
      }

      assert.equal((await createToken('patientA', { departmentId: 'dept_demo_opd' })).status, 201);
      assert.equal(await QueueToken.countDocuments({ status: 'waiting' }), 1);
    });

    test('concurrent requests from one patient create exactly one active token', async () => {
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => createToken('patientA', { departmentId: 'dept_demo_opd' })),
      );
      const statuses = responses.map((response) => response.status);

      assert.equal(statuses.filter((status) => status === 201).length, 1, statuses.join(','));
      assert.equal(statuses.filter((status) => status === 409).length, 9, statuses.join(','));
      assert.equal(await QueueToken.countDocuments({ patientId: users.patientA._id }), 1);
    });

    test('concurrent requests from different patients get unique display numbers', async () => {
      const responses = await Promise.all(
        ['patientA', 'patientB', 'patientC'].map((name) => createToken(name, { departmentId: 'dept_demo_opd' })),
      );

      assert.deepEqual(responses.map((response) => response.status), [201, 201, 201]);
      assert.deepEqual(
        responses.map((response) => response.body.data.displayNumber).sort(),
        ['OPD-001', 'OPD-002', 'OPD-003'],
      );
    });

    test('the database index rejects duplicate active tokens even without the API pre-check', async () => {
      const fields = { patientId: users.patientA._id, departmentId: 'dept_demo_opd', status: 'waiting' };
      await QueueToken.create({ ...fields, displayNumber: 'OPD-901', sequence: 901 });

      await assert.rejects(
        () => QueueToken.create({ ...fields, displayNumber: 'OPD-902', sequence: 902, status: 'called' }),
        /one_active_token_per_patient_department/,
      );
      await QueueToken.create({ ...fields, displayNumber: 'OPD-903', sequence: 903, status: 'completed' });
    });

    test('rejects missing, malformed, unknown, and inactive departments', async () => {
      assertError(await createToken('patientA', {}), 400, 'VALIDATION_ERROR');
      assertError(await createToken('patientA', { departmentId: '' }), 400, 'VALIDATION_ERROR');
      assertError(await createToken('patientA', { departmentId: 42 }), 400, 'VALIDATION_ERROR');
      assertError(await createToken('patientA', { departmentId: { $ne: null } }), 400, 'VALIDATION_ERROR');
      assertError(await createToken('patientA', { departmentId: 'bad.id' }), 400, 'VALIDATION_ERROR');
      assertError(await createToken('patientA', ['dept_demo_opd']), 400, 'VALIDATION_ERROR');
      assertError(await createToken('patientA', { departmentId: 'dept_missing' }), 404, 'NOT_FOUND');
      assertError(await createToken('patientA', { departmentId: 'dept_test_closed' }), 404, 'NOT_FOUND');
      assert.equal(await QueueToken.countDocuments(), 0);
    });

    test('rejects client-supplied patient, status, or display-number fields', async () => {
      for (const extra of [
        { patientId: String(users.patientB._id) },
        { status: 'in_consultation' },
        { displayNumber: 'OPD-999' },
      ]) {
        const response = await createToken('patientA', { departmentId: 'dept_demo_opd', ...extra });
        assertError(response, 400, 'VALIDATION_ERROR');
      }
      assert.equal(await QueueToken.countDocuments(), 0);
    });

    test('only authenticated patients may create tokens', async () => {
      const unauthenticated = await request(app, {
        method: 'POST',
        path: '/api/queue-tokens',
        body: { departmentId: 'dept_demo_opd' },
      });
      assertError(unauthenticated, 401, 'UNAUTHORIZED');

      for (const name of ['staffOpd', 'admin']) {
        assertError(await createToken(name, { departmentId: 'dept_demo_opd' }), 403, 'FORBIDDEN');
      }
      assert.equal(await QueueToken.countDocuments(), 0);
    });
  });

  describe('GET /api/queue-tokens/:tokenId and /status', () => {
    let tokenId;
    beforeEach(async () => {
      tokenId = (await createToken('patientA', { departmentId: 'dept_demo_opd' })).body.data.id;
    });

    test('the owner can read token details and patient-safe status', async () => {
      const details = await getAs('patientA', `/api/queue-tokens/${tokenId}`);
      assert.equal(details.status, 200);
      assert.deepEqual(Object.keys(details.body.data).sort(), tokenKeys);
      assert.equal(details.body.data.displayNumber, 'OPD-001');

      const status = await getAs('patientA', `/api/queue-tokens/${tokenId}/status`);
      assert.equal(status.status, 200);
      assert.deepEqual(status.body, {
        data: {
          id: tokenId,
          displayNumber: 'OPD-001',
          status: 'waiting',
          patientsAhead: 0,
          estimatedWaitMinutes: 0,
          estimateLabel: 'Simulated estimate',
        },
      });
      assert.deepEqual(Object.keys(status.body.data).sort(), statusKeys);
    });

    test('other patients get 404 without any token details', async () => {
      for (const path of [`/api/queue-tokens/${tokenId}`, `/api/queue-tokens/${tokenId}/status`]) {
        const response = await getAs('patientB', path);
        assert.deepEqual(response.body, { error: { code: 'NOT_FOUND', message: 'Queue token not found' } });
        assert.equal(response.status, 404);
      }
    });

    test('assigned-department staff and admins can read; other staff cannot', async () => {
      for (const name of ['staffOpd', 'admin']) {
        assert.equal((await getAs(name, `/api/queue-tokens/${tokenId}`)).status, 200, name);
        assert.equal((await getAs(name, `/api/queue-tokens/${tokenId}/status`)).status, 200, name);
      }
      for (const name of ['staffCardio', 'staffUnassigned']) {
        assertError(await getAs(name, `/api/queue-tokens/${tokenId}`), 404, 'NOT_FOUND');
        assertError(await getAs(name, `/api/queue-tokens/${tokenId}/status`), 404, 'NOT_FOUND');
      }
    });

    test('responses never expose the patient ID', async () => {
      for (const name of ['patientA', 'staffOpd', 'admin']) {
        const response = await getAs(name, `/api/queue-tokens/${tokenId}`);
        assert.equal(response.rawBody.includes(String(users.patientA._id)), false);
        assert.doesNotMatch(response.rawBody, /patientId/);
      }
    });

    test('status reflects live queue position as earlier tokens finish', async () => {
      const second = await createToken('patientB', { departmentId: 'dept_demo_opd' });
      const statusPath = `/api/queue-tokens/${second.body.data.id}/status`;

      let response = await getAs('patientB', statusPath);
      assert.equal(response.body.data.patientsAhead, 1);
      assert.equal(response.body.data.estimatedWaitMinutes, 5);

      await setStatus(tokenId, 'called');
      response = await getAs('patientB', statusPath);
      assert.equal(response.body.data.patientsAhead, 0);
      assert.equal(response.body.data.estimatedWaitMinutes, 0);
      assert.equal(response.body.data.estimateLabel, 'Simulated estimate');

      const called = await getAs('patientA', `/api/queue-tokens/${tokenId}/status`);
      assert.equal(called.body.data.status, 'called');
    });

    test('missing, malformed, and unauthenticated lookups are rejected', async () => {
      assertError(await getAs('patientA', '/api/queue-tokens/token_missing'), 404, 'NOT_FOUND');
      assertError(await getAs('patientA', '/api/queue-tokens/bad%24id/status'), 400, 'VALIDATION_ERROR');
      assertError(await request(app, { path: `/api/queue-tokens/${tokenId}` }), 401, 'UNAUTHORIZED');
      assertError(await request(app, { path: `/api/queue-tokens/${tokenId}/status` }), 401, 'UNAUTHORIZED');
    });
  });

  describe('GET /api/patients/me/queue-tokens/active', () => {
    const activePath = '/api/patients/me/queue-tokens/active';

    test('returns an empty list when the patient has no active tokens', async () => {
      const response = await getAs('patientA', activePath);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: [] });
    });

    test('lists only the caller\'s active tokens across departments', async () => {
      const opd = await createToken('patientA', { departmentId: 'dept_demo_opd' });
      const cardio = await createToken('patientA', { departmentId: 'dept_test_cardio' });
      await createToken('patientB', { departmentId: 'dept_demo_opd' });
      await setStatus(cardio.body.data.id, 'completed');
      const cardioAgain = await createToken('patientA', { departmentId: 'dept_test_cardio' });
      await setStatus(cardioAgain.body.data.id, 'in_consultation');

      const response = await getAs('patientA', activePath);

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data.map((token) => token.id), [opd.body.data.id, cardioAgain.body.data.id]);
      assert.deepEqual(response.body.data.map((token) => token.status), ['waiting', 'in_consultation']);
      for (const token of response.body.data) {
        assert.deepEqual(Object.keys(token).sort(), tokenKeys);
      }
    });

    test('is limited to authenticated patients', async () => {
      assertError(await request(app, { path: activePath }), 401, 'UNAUTHORIZED');
      assertError(await getAs('staffOpd', activePath), 403, 'FORBIDDEN');
      assertError(await getAs('admin', activePath), 403, 'FORBIDDEN');
    });
  });
});

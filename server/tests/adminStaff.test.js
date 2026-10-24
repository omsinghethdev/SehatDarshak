import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { QueueToken } from '../src/modules/tokens/queueToken.model.js';
import { User } from '../src/modules/users/user.model.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { CLOSED, MED, OPD, authHeaders, createUser, seedHospital } from './helpers/fixtures.js';
import { request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('admin_staff');
const app = createApp();

const call = (user, method, path, body) => request(app, { method, path, headers: authHeaders(user), body });

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

const doctorInput = {
  name: 'Dr. Test Rao',
  identifier: 'dr.test.rao',
  password: 'initial-password-1',
  departmentId: OPD,
  staffType: 'doctor',
  specialization: 'General Medicine',
  registrationNumber: 'TEST/REG-001',
  phone: '+91 90000 00000',
  email: 'Dr.Rao@Example.test',
};

describe('admin staff and doctor accounts', { skip: databaseUnavailable }, () => {
  const users = {};

  before(async () => {
    await seedHospital();
    users.admin = await createUser({ role: 'admin' });
    users.patient = await createUser({ role: 'patient' });
    users.staff = await createUser({ role: 'staff', departmentId: OPD });
    users.doctor = await createUser({ role: 'staff', departmentId: OPD, staffType: 'doctor' });
    users.inactiveAdmin = await createUser({ role: 'admin', isActive: false });
  });

  after(async () => {
    await dropTestDatabase();
  });

  test('every admin endpoint requires an active admin: 401 without a valid token, 403 for other roles', async () => {
    const someId = String(new mongoose.Types.ObjectId());
    const endpoints = [
      ['GET', '/api/admin/staff'],
      ['POST', '/api/admin/staff', doctorInput],
      ['GET', `/api/admin/staff/${someId}`],
      ['PATCH', `/api/admin/staff/${someId}`, { isActive: false }],
      ['POST', `/api/admin/staff/${someId}/password-reset`, {}],
      ['GET', '/api/admin/patients'],
      ['GET', `/api/admin/patients/${someId}`],
      ['GET', '/api/admin/visits'],
      ['GET', `/api/admin/visits/visit_20260101_${someId}`],
      ['PATCH', `/api/admin/visits/visit_20260101_${someId}`, { adminNote: 'x' }],
      ['GET', '/api/admin/wards'],
      ['POST', '/api/admin/wards', { name: 'Ward', code: 'W1' }],
      ['GET', '/api/admin/wards/ward_w1'],
      ['PATCH', '/api/admin/wards/ward_w1', { name: 'Ward' }],
      ['GET', '/api/admin/departments'],
      ['GET', `/api/admin/departments/${OPD}`],
      ['GET', '/api/admin/statistics'],
      ['GET', '/api/admin/audit/queue-token-status-changes'],
      ['GET', '/api/admin/audit/admin-actions'],
    ];

    for (const [method, path, body] of endpoints) {
      assertError(await request(app, { method, path, body }), 401, 'UNAUTHORIZED');
      assertError(await request(app, { method, path, body, headers: { authorization: 'Bearer not.a.jwt' } }), 401, 'UNAUTHORIZED');
      assertError(await call(users.inactiveAdmin, method, path, body), 401, 'UNAUTHORIZED');
      for (const role of ['patient', 'staff', 'doctor']) {
        const response = await call(users[role], method, path, body);
        assert.equal(response.status, 403, `${role} ${method} ${path}: ${response.rawBody}`);
      }
    }
    // Nothing was created by the rejected requests.
    assert.equal(await User.countDocuments({ identifier: doctorInput.identifier }), 0);
  });

  test('admin creates a doctor; role and isActive are server-controlled; no password data is returned', async () => {
    for (const forbidden of [{ role: 'admin' }, { isActive: false }, { passwordHash: 'x' }, { mustChangePassword: false }]) {
      assertError(await call(users.admin, 'POST', '/api/admin/staff', { ...doctorInput, ...forbidden }), 400, 'VALIDATION_ERROR');
    }

    const created = await call(users.admin, 'POST', '/api/admin/staff', doctorInput);
    assert.equal(created.status, 201, created.rawBody);
    const doctor = created.body.data;
    assert.equal(doctor.role, 'staff');
    assert.equal(doctor.staffType, 'doctor');
    assert.equal(doctor.isActive, true);
    assert.equal(doctor.departmentId, OPD);
    assert.equal(doctor.departmentName, 'Demo OPD');
    assert.equal(doctor.email, 'dr.rao@example.test');
    assert.equal(doctor.registrationNumber, 'TEST/REG-001');
    assert.ok(!/password|hash|auditTrail/i.test(Object.keys(doctor).join(',').replace('mustChangePassword', '')));

    const stored = await User.findById(doctor.id).select('+passwordHash').lean();
    assert.equal(stored.role, 'staff');
    assert.ok(stored.passwordHash.startsWith('scrypt$'));

    // The new doctor can sign in and has staff (department-scoped) access only.
    const login = await request(app, { method: 'POST', path: '/api/auth/login', body: { identifier: doctorInput.identifier, password: doctorInput.password } });
    assert.equal(login.status, 200, login.rawBody);
    assert.deepEqual(login.body.data.user, { id: doctor.id, name: doctorInput.name, role: 'staff', departmentId: OPD });
  });

  test('create validation: required fields, formats, doctor-only fields, duplicates, departments, wards', async () => {
    const base = { name: 'New Staff', identifier: 'new.staff.one', password: 'initial-password-1', departmentId: OPD };
    const cases = [
      [{ ...base, departmentId: undefined }, 'departmentId'],
      [{ ...base, name: '' }, 'name'],
      [{ ...base, identifier: 'X!' }, 'identifier'],
      [{ ...base, password: 'short' }, 'password'],
      [{ ...base, staffType: 'surgeon' }, 'staffType'],
      [{ ...base, email: 'not-an-email' }, 'email'],
      [{ ...base, phone: 'call me' }, 'phone'],
      [{ ...base, specialization: 'Cardiology' }, 'specialization'],
      [{ ...base, registrationNumber: 'R-1' }, 'registrationNumber'],
      [{ ...base, departmentId: 'bad id!' }, 'departmentId'],
    ];
    for (const [body, field] of cases) {
      const response = await call(users.admin, 'POST', '/api/admin/staff', body);
      assertError(response, 400, 'VALIDATION_ERROR');
      assert.ok(response.body.error.details.some((detail) => detail.field === field), `${field}: ${response.rawBody}`);
    }

    assertError(await call(users.admin, 'POST', '/api/admin/staff', { ...base, departmentId: 'dept_unknown' }), 404, 'NOT_FOUND');
    assertError(await call(users.admin, 'POST', '/api/admin/staff', { ...base, departmentId: CLOSED }), 404, 'NOT_FOUND');
    assertError(await call(users.admin, 'POST', '/api/admin/staff', { ...base, wardId: 'ward_unknown' }), 404, 'NOT_FOUND');

    assert.equal((await call(users.admin, 'POST', '/api/admin/staff', base)).status, 201);
    assertError(await call(users.admin, 'POST', '/api/admin/staff', base), 409, 'CONFLICT');
    assertError(await call(users.admin, 'POST', '/api/admin/staff', { ...base, identifier: 'NEW.STAFF.ONE' }), 409, 'CONFLICT');
    // Usernames are unique across all roles.
    const patient = await User.findById(users.patient._id).lean();
    assertError(await call(users.admin, 'POST', '/api/admin/staff', { ...base, identifier: patient.identifier }), 409, 'CONFLICT');
  });

  test('list filters by department, staff type, status, and search; paginates; sorts by name', async () => {
    const make = (name, fields) => createUser({ role: 'staff', name, ...fields });
    await make('Zeta Search Nurse', { departmentId: MED });
    await make('Alpha Search Doctor', { departmentId: MED, staffType: 'doctor', specialization: 'Paediatrics' });
    await make('Inactive Search Doctor', { departmentId: MED, staffType: 'doctor', isActive: false });
    const list = (query) => call(users.admin, 'GET', `/api/admin/staff${query}`);

    const med = await list(`?departmentId=${MED}`);
    assert.equal(med.status, 200);
    assert.deepEqual(med.body.data.map((item) => item.name), ['Alpha Search Doctor', 'Inactive Search Doctor', 'Zeta Search Nurse']);
    assert.equal(med.body.meta.total, 3);

    const doctors = await list(`?departmentId=${MED}&staffType=doctor&isActive=true`);
    assert.deepEqual(doctors.body.data.map((item) => item.name), ['Alpha Search Doctor']);
    const inactive = await list(`?departmentId=${MED}&isActive=false`);
    assert.deepEqual(inactive.body.data.map((item) => item.name), ['Inactive Search Doctor']);
    const general = await list(`?departmentId=${MED}&staffType=staff`);
    assert.deepEqual(general.body.data.map((item) => item.name), ['Zeta Search Nurse']);

    assert.deepEqual((await list('?q=paediat')).body.data.map((item) => item.name), ['Alpha Search Doctor']);
    assert.deepEqual((await list('?q=ZETA%20search')).body.data.map((item) => item.name), ['Zeta Search Nurse']);
    // Regex characters are matched literally (no error, no match-all).
    const regex = await list('?q=.*');
    assert.equal(regex.status, 200);
    assert.equal(regex.body.meta.total, 0);

    const page = await list(`?departmentId=${MED}&limit=2&page=2`);
    assert.deepEqual(page.body.data.map((item) => item.name), ['Zeta Search Nurse']);
    assert.deepEqual(page.body.meta, { page: 2, limit: 2, total: 3 });

    for (const query of ['?isActive=yes', '?staffType=nurse', '?limit=101', '?departmentId=bad!', `?q=${'x'.repeat(101)}`]) {
      assertError(await list(query), 400, 'VALIDATION_ERROR');
    }
    // Patients and admins never appear in the staff list.
    const all = await list('?limit=100');
    assert.ok(all.body.data.every((item) => item.role === 'staff'));
  });

  test('re-assignment takes effect immediately for queue access, and is audited', async () => {
    const mover = await createUser({ role: 'staff', departmentId: OPD });
    assert.equal((await call(mover, 'GET', `/api/queues/${OPD}`)).status, 200);
    assert.equal((await call(mover, 'GET', `/api/queues/${MED}`)).status, 403);

    const moved = await call(users.admin, 'PATCH', `/api/admin/staff/${mover._id}`, { departmentId: MED, staffType: 'doctor', designation: 'Consultant' });
    assert.equal(moved.status, 200, moved.rawBody);
    assert.equal(moved.body.data.departmentId, MED);
    assert.equal(moved.body.data.staffType, 'doctor');

    assert.equal((await call(mover, 'GET', `/api/queues/${OPD}`)).status, 403);
    assert.equal((await call(mover, 'GET', `/api/queues/${MED}`)).status, 200);

    const audit = await call(users.admin, 'GET', `/api/admin/audit/admin-actions?targetId=${mover._id}`);
    assert.equal(audit.status, 200, audit.rawBody);
    const actions = audit.body.data.map((entry) => entry.action).sort();
    assert.deepEqual(actions, ['staff_assignment_changed', 'staff_profile_updated']);
    const assignment = audit.body.data.find((entry) => entry.action === 'staff_assignment_changed');
    assert.deepEqual(
      assignment.changes.sort((a, b) => a.field.localeCompare(b.field)),
      [{ field: 'departmentId', from: OPD, to: MED }, { field: 'staffType', from: 'staff', to: 'doctor' }],
    );
    assert.deepEqual(assignment.actor, { id: String(users.admin._id), role: 'admin', name: users.admin.name });
    assert.equal(assignment.targetType, 'staff');
  });

  test('update rules: patients and admins are not found; null department rejected; contact values not audited', async () => {
    assertError(await call(users.admin, 'PATCH', `/api/admin/staff/${users.patient._id}`, { isActive: false }), 404, 'NOT_FOUND');
    assertError(await call(users.admin, 'PATCH', `/api/admin/staff/${users.admin._id}`, { isActive: false }), 404, 'NOT_FOUND');
    assertError(await call(users.admin, 'POST', `/api/admin/staff/${users.patient._id}/password-reset`, {}), 404, 'NOT_FOUND');
    assertError(await call(users.admin, 'GET', '/api/admin/staff/not-an-id'), 400, 'VALIDATION_ERROR');
    assert.equal((await User.findById(users.patient._id).lean()).isActive, true);

    const target = await createUser({ role: 'staff', departmentId: OPD });
    for (const body of [{}, { departmentId: null }, { role: 'admin' }, { isActive: 'false' }, { identifier: 'renamed' }]) {
      assertError(await call(users.admin, 'PATCH', `/api/admin/staff/${target._id}`, body), 400, 'VALIDATION_ERROR');
    }
    assertError(await call(users.admin, 'PATCH', `/api/admin/staff/${target._id}`, { specialization: 'X' }), 400, 'VALIDATION_ERROR');

    const phone = await call(users.admin, 'PATCH', `/api/admin/staff/${target._id}`, { phone: '+91 91111 11111' });
    assert.equal(phone.status, 200, phone.rawBody);
    const cleared = await call(users.admin, 'PATCH', `/api/admin/staff/${target._id}`, { phone: null });
    assert.equal(cleared.body.data.phone, undefined);

    const { auditTrail } = await User.findById(target._id).select('+auditTrail').lean();
    const contactEntries = auditTrail.filter((entry) => entry.changes?.some((change) => change.field === 'phone'));
    assert.equal(contactEntries.length, 2);
    for (const entry of contactEntries) {
      assert.deepEqual(entry.changes, [{ field: 'phone' }]);
    }
    assert.ok(!JSON.stringify(auditTrail).includes('91111'));

    // A no-op update changes nothing and writes no audit entry.
    const before = (await User.findById(target._id).select('+auditTrail').lean()).auditTrail.length;
    assert.equal((await call(users.admin, 'PATCH', `/api/admin/staff/${target._id}`, { departmentId: OPD })).status, 200);
    assert.equal((await User.findById(target._id).select('+auditTrail').lean()).auditTrail.length, before);
  });

  test('changing a doctor to general staff clears doctor-only details', async () => {
    const created = await call(users.admin, 'POST', '/api/admin/staff', {
      ...doctorInput, identifier: 'dr.type.change', email: undefined, phone: undefined,
    });
    const { id } = created.body.data;
    const changed = await call(users.admin, 'PATCH', `/api/admin/staff/${id}`, { staffType: 'staff' });
    assert.equal(changed.status, 200, changed.rawBody);
    assert.equal(changed.body.data.staffType, 'staff');
    assert.equal(changed.body.data.specialization, undefined);
    assert.equal(changed.body.data.registrationNumber, undefined);
  });

  test('deactivation keeps the account and its history (no hard delete) and is audited', async () => {
    const staff = await createUser({ role: 'staff', departmentId: OPD });
    await QueueToken.create({ displayNumber: 'OPD-901', sequence: 901, patientId: users.patient._id, departmentId: OPD, status: 'completed' });

    const response = await call(users.admin, 'PATCH', `/api/admin/staff/${staff._id}`, { isActive: false });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.isActive, false);
    assert.ok(await User.exists({ _id: staff._id }));
    assert.equal(await QueueToken.countDocuments({ displayNumber: 'OPD-901' }), 1);

    const audit = await call(users.admin, 'GET', `/api/admin/audit/admin-actions?targetId=${staff._id}&action=staff_deactivated`);
    assert.equal(audit.body.data.length, 1);
    assert.deepEqual(audit.body.data[0].changes, [{ field: 'isActive', from: true, to: false }]);
    assert.equal((await call(users.admin, 'DELETE', `/api/admin/staff/${staff._id}`)).status, 404);
  });

  test('concurrent conflicting updates apply exactly one change', async () => {
    const staff = await createUser({ role: 'staff', departmentId: OPD });
    const results = await Promise.all([
      call(users.admin, 'PATCH', `/api/admin/staff/${staff._id}`, { departmentId: MED }),
      call(users.admin, 'PATCH', `/api/admin/staff/${staff._id}`, { departmentId: MED }),
      call(users.admin, 'PATCH', `/api/admin/staff/${staff._id}`, { departmentId: MED }),
    ]);
    // Either 200 (applied, or found already applied) or 409 (lost the compare-and-set).
    assert.ok(results.every((result) => [200, 409].includes(result.status)), results.map((result) => result.rawBody).join('\n'));
    const { auditTrail } = await User.findById(staff._id).select('+auditTrail').lean();
    assert.equal(auditTrail?.filter((entry) => entry.action === 'staff_assignment_changed').length, 1);
  });
});

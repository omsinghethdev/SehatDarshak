import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { Ward } from '../src/modules/wards/ward.model.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { CLOSED, MED, OPD, authHeaders, createUser, seedHospital } from './helpers/fixtures.js';
import { request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('admin_wards');
const app = createApp();

const call = (user, method, path, body) => request(app, { method, path, headers: authHeaders(user), body });

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

describe('admin wards', { skip: databaseUnavailable }, () => {
  let admin;
  let patient;

  before(async () => {
    await seedHospital();
    admin = await createUser({ role: 'admin' });
    patient = await createUser({ role: 'patient' });
  });

  after(async () => {
    await dropTestDatabase();
  });

  test('create, read, list, and filter wards with department and floor names', async () => {
    const created = await call(admin, 'POST', '/api/admin/wards', {
      name: 'General Ward A', code: 'gw-a', departmentId: OPD, floorId: 'floor_ground', description: 'Fictional test ward',
    });
    assert.equal(created.status, 201, created.rawBody);
    assert.equal(created.body.data.id, 'ward_gw_a');
    assert.equal(created.body.data.code, 'GW-A');
    assert.equal(created.body.data.departmentName, 'Demo OPD');
    assert.equal(created.body.data.floorName, 'Ground Floor');
    assert.equal(created.body.data.isActive, true);

    await call(admin, 'POST', '/api/admin/wards', { name: 'Medicine Ward', code: 'MW', departmentId: MED });
    await call(admin, 'POST', '/api/admin/wards', { name: 'Standalone Ward', code: 'SW' });

    const all = await call(admin, 'GET', '/api/admin/wards');
    assert.deepEqual(all.body.data.map((ward) => ward.name), ['General Ward A', 'Medicine Ward', 'Standalone Ward']);
    const opd = await call(admin, 'GET', `/api/admin/wards?departmentId=${OPD}`);
    assert.deepEqual(opd.body.data.map((ward) => ward.code), ['GW-A']);

    const detail = await call(admin, 'GET', '/api/admin/wards/ward_gw_a');
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.visitsRecorded, 0);
    assertError(await call(admin, 'GET', '/api/admin/wards/ward_none'), 404, 'NOT_FOUND');
  });

  test('create validation, duplicate codes, and unknown or inactive references', async () => {
    for (const body of [
      { code: 'X1' },
      { name: 'No code' },
      { name: 'Bad code', code: 'has space' },
      { name: 'Too long', code: 'ABCDEFGHIJKLMNOPQ' },
      { name: 'Extra', code: 'EX', isActive: false },
      { name: 'Extra', code: 'EX', id: 'ward_custom' },
    ]) {
      assertError(await call(admin, 'POST', '/api/admin/wards', body), 400, 'VALIDATION_ERROR');
    }
    assertError(await call(admin, 'POST', '/api/admin/wards', { name: 'Dup', code: 'GW-A' }), 409, 'CONFLICT');
    assertError(await call(admin, 'POST', '/api/admin/wards', { name: 'Ref', code: 'R1', departmentId: CLOSED }), 404, 'NOT_FOUND');
    assertError(await call(admin, 'POST', '/api/admin/wards', { name: 'Ref', code: 'R2', floorId: 'floor_none' }), 404, 'NOT_FOUND');
  });

  test('update, deactivate (never delete), audit, and staff ward assignment', async () => {
    const renamed = await call(admin, 'PATCH', '/api/admin/wards/ward_sw', { name: 'Standalone Ward East', departmentId: MED });
    assert.equal(renamed.status, 200, renamed.rawBody);
    assert.equal(renamed.body.data.departmentName, 'Test Medicine');
    assertError(await call(admin, 'PATCH', '/api/admin/wards/ward_sw', { code: 'NEW' }), 400, 'VALIDATION_ERROR');
    assertError(await call(admin, 'PATCH', '/api/admin/wards/ward_sw', {}), 400, 'VALIDATION_ERROR');

    // Staff can be assigned to an active ward; assignment shows on the staff account and ward.
    const staff = await call(admin, 'POST', '/api/admin/staff', {
      name: 'Ward Nurse', identifier: 'ward.nurse', password: 'initial-password-1', departmentId: MED, wardId: 'ward_sw',
    });
    assert.equal(staff.status, 201, staff.rawBody);
    assert.equal(staff.body.data.wardName, 'Standalone Ward East');
    assert.deepEqual((await call(admin, 'GET', '/api/admin/wards/ward_sw')).body.data.activeAssignedStaff, { doctors: 0, staff: 1 });
    assert.deepEqual((await call(admin, 'GET', '/api/admin/staff?wardId=ward_sw')).body.data.map((item) => item.name), ['Ward Nurse']);

    const deactivated = await call(admin, 'PATCH', '/api/admin/wards/ward_sw', { isActive: false });
    assert.equal(deactivated.body.data.isActive, false);
    assert.ok(await Ward.exists({ _id: 'ward_sw' }));
    assert.equal((await call(admin, 'DELETE', '/api/admin/wards/ward_sw')).status, 404);
    // Inactive wards cannot receive new assignments, by update or by creation.
    const other = await createUser({ role: 'staff', departmentId: MED });
    assertError(await call(admin, 'PATCH', `/api/admin/staff/${other._id}`, { wardId: 'ward_sw' }), 404, 'NOT_FOUND');
    assertError(await call(admin, 'POST', '/api/admin/staff', {
      name: 'Late Nurse', identifier: 'late.nurse', password: 'initial-password-1', departmentId: MED, wardId: 'ward_sw',
    }), 404, 'NOT_FOUND');
    assert.deepEqual((await call(admin, 'GET', '/api/admin/wards?isActive=false')).body.data.map((ward) => ward.id), ['ward_sw']);

    const audit = await call(admin, 'GET', '/api/admin/audit/admin-actions?targetType=ward&targetId=ward_sw');
    assert.deepEqual(audit.body.data.map((entry) => entry.action), ['ward_deactivated', 'ward_updated', 'ward_created']);
    assert.equal(audit.body.data[0].targetName, 'Standalone Ward East');
    assert.deepEqual(
      audit.body.data[1].changes.sort((a, b) => a.field.localeCompare(b.field)),
      [{ field: 'departmentId', from: null, to: MED }, { field: 'name', from: 'Standalone Ward', to: 'Standalone Ward East' }],
    );
  });

  test('wards do not change the map, rooms, or public department endpoints', async () => {
    const floors = await call(patient, 'GET', '/api/map/floors');
    assert.equal(floors.status, 200);
    assert.deepEqual(floors.body.data.map((floor) => floor.id), ['floor_ground']);
    const floor = await call(patient, 'GET', '/api/map/floors/floor_ground');
    assert.deepEqual(floor.body.data.locations.map((location) => location.id), ['room_registration']);
    const departments = await call(patient, 'GET', '/api/departments');
    assert.deepEqual(departments.body.data.map((department) => department.id).sort(), [OPD, MED].sort());
    assert.ok(!floor.rawBody.includes('ward_'));
  });
});

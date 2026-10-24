import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { demoDepartments, demoFloors, demoRooms } from '../src/seed/demoData.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { signAccessToken } from '../src/utils/accessToken.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { bearer, request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('hospital');
const app = createApp();
let authHeaders;

const get = (path, headers = authHeaders) => request(app, { path, headers });

// Test-only records added alongside the canonical demo seed.
const extraFloors = [
  { _id: 'floor_first', displayName: 'First Floor', width: 800, height: 600, level: 1 },
  { _id: 'floor_closed', displayName: 'Closed Floor', width: 500, height: 500, level: 2, isActive: false },
  { _id: 'floor_empty', displayName: 'Empty Floor', width: 400, height: 300, level: 3 },
];
const extraDepartments = [
  { _id: 'dept_test_cardio', name: 'Test Cardiology', code: 'CARD', floor: 'floor_first', roomIds: ['room_cardio_1'] },
  {
    _id: 'dept_test_general',
    name: 'Test General Medicine',
    code: 'GEN',
    floor: 'floor_ground',
    roomIds: ['room_opd_1', 'room_opd_2'],
  },
  { _id: 'dept_test_closed', name: 'Closed Department', code: 'CLSD', isActive: false },
];
const extraRooms = [
  {
    _id: 'room_opd_1',
    name: 'OPD Room 1',
    roomNumber: 'G-01',
    floorId: 'floor_ground',
    type: 'consultation',
    departmentId: 'dept_test_general',
    mapPosition: { x: 300, y: 120, width: 120, height: 100 },
    isAccessible: true,
  },
  {
    _id: 'room_opd_2',
    name: 'OPD Room 2',
    floorId: 'floor_ground',
    type: 'consultation',
    departmentId: 'dept_test_general',
    mapPosition: { x: 440, y: 120, width: 120, height: 100 },
  },
  {
    _id: 'room_cardio_1',
    name: 'Cardiology Room 1',
    floorId: 'floor_first',
    type: 'consultation',
    departmentId: 'dept_test_cardio',
    mapPosition: { x: 50, y: 50, width: 100, height: 80 },
  },
  {
    _id: 'room_closed',
    name: 'Closed Room',
    floorId: 'floor_ground',
    type: 'facility',
    mapPosition: { x: 600, y: 400, width: 50, height: 50 },
    isActive: false,
  },
];

function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.body.error.code, code);
}

describe('hospital data routes', { skip: databaseUnavailable }, () => {
  before(async () => {
    // Seeding through seedDemoData also validates that the test fixtures are consistent.
    await seedDemoData({
      floors: [...demoFloors, ...extraFloors],
      departments: [...demoDepartments, ...extraDepartments],
      rooms: [...demoRooms, ...extraRooms],
    });

    const patient = await User.create({
      name: 'Test Patient',
      identifier: 'hospital.test.patient',
      passwordHash: 'not-used-in-these-tests',
      role: 'patient',
    });
    authHeaders = bearer(signAccessToken({ id: patient._id, role: patient.role }));
  });
  after(dropTestDatabase);

  test('every endpoint requires authentication', async () => {
    for (const path of [
      '/api/departments',
      '/api/departments/dept_demo_opd',
      '/api/rooms',
      '/api/rooms/room_registration',
      '/api/map/floors',
      '/api/map/floors/floor_ground',
    ]) {
      assertError(await get(path, {}), 401, 'UNAUTHORIZED');
      assertError(await get(path, bearer('invalid.jwt.value')), 401, 'UNAUTHORIZED');
    }
  });

  test('write methods are not exposed', async () => {
    for (const [method, path] of [
      ['POST', '/api/departments'],
      ['PATCH', '/api/departments/dept_demo_opd'],
      ['DELETE', '/api/rooms/room_registration'],
      ['PUT', '/api/map/floors/floor_ground'],
    ]) {
      const response = await request(app, { method, path, headers: authHeaders, body: {} });
      assertError(response, 404, 'NOT_FOUND');
    }
  });

  describe('departments', () => {
    test('GET /api/departments lists active departments sorted by name', async () => {
      const response = await get('/api/departments');

      assert.equal(response.status, 200);
      assert.deepEqual(
        response.body.data.map((department) => department.id),
        ['dept_demo_opd', 'dept_test_cardio', 'dept_test_general'],
      );
    });

    test('GET /api/departments/:departmentId returns the documented shape', async () => {
      const response = await get('/api/departments/dept_demo_opd');

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, {
        data: {
          id: 'dept_demo_opd',
          name: 'Demo OPD',
          code: 'OPD',
          floor: 'floor_ground',
          roomIds: ['room_registration'],
        },
      });
    });

    test('missing and inactive departments return 404', async () => {
      assertError(await get('/api/departments/dept_missing'), 404, 'NOT_FOUND');
      assertError(await get('/api/departments/dept_test_closed'), 404, 'NOT_FOUND');
    });

    test('invalid department IDs return 400', async () => {
      for (const id of ['bad%24id', 'bad.id', 'a'.repeat(65)]) {
        const response = await get(`/api/departments/${id}`);
        assertError(response, 400, 'VALIDATION_ERROR');
        assert.equal(response.body.error.details[0].field, 'departmentId');
      }
    });
  });

  describe('rooms', () => {
    test('GET /api/rooms lists active rooms with default pagination metadata', async () => {
      const response = await get('/api/rooms');

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.meta, { page: 1, limit: 20, total: 4 });
      assert.deepEqual(
        response.body.data.map((room) => room.id),
        ['room_cardio_1', 'room_opd_1', 'room_opd_2', 'room_registration'],
      );
    });

    test('room responses use the documented shape', async () => {
      const facility = await get('/api/rooms/room_registration');
      assert.equal(facility.status, 200);
      assert.deepEqual(facility.body, {
        data: {
          id: 'room_registration',
          name: 'Registration Desk',
          floorId: 'floor_ground',
          type: 'facility',
          mapPosition: { x: 80, y: 120, width: 180, height: 100 },
        },
      });

      const consultation = await get('/api/rooms/room_opd_1');
      assert.deepEqual(consultation.body.data, {
        id: 'room_opd_1',
        name: 'OPD Room 1',
        roomNumber: 'G-01',
        floorId: 'floor_ground',
        type: 'consultation',
        departmentId: 'dept_test_general',
        mapPosition: { x: 300, y: 120, width: 120, height: 100 },
        isAccessible: true,
      });
    });

    test('filters by floor and departmentId, alone or together', async () => {
      const cases = [
        ['?floor=floor_ground', ['room_opd_1', 'room_opd_2', 'room_registration']],
        ['?floor=floor_first', ['room_cardio_1']],
        ['?departmentId=dept_test_general', ['room_opd_1', 'room_opd_2']],
        ['?floor=floor_first&departmentId=dept_test_general', []],
        ['?floor=floor_unknown', []],
      ];

      for (const [query, expectedIds] of cases) {
        const response = await get(`/api/rooms${query}`);
        assert.equal(response.status, 200, query);
        assert.deepEqual(response.body.data.map((room) => room.id), expectedIds, query);
        assert.equal(response.body.meta.total, expectedIds.length, query);
      }
    });

    test('paginates without overlap and reports the total', async () => {
      const first = await get('/api/rooms?page=1&limit=2');
      const second = await get('/api/rooms?page=2&limit=2');
      const beyond = await get('/api/rooms?page=5&limit=2');

      assert.deepEqual(first.body.meta, { page: 1, limit: 2, total: 4 });
      assert.deepEqual(first.body.data.map((room) => room.id), ['room_cardio_1', 'room_opd_1']);
      assert.deepEqual(second.body.meta, { page: 2, limit: 2, total: 4 });
      assert.deepEqual(second.body.data.map((room) => room.id), ['room_opd_2', 'room_registration']);
      assert.equal(beyond.status, 200);
      assert.deepEqual(beyond.body.data, []);
    });

    test('invalid filters and pagination values return 400', async () => {
      const cases = [
        ['?page=0', 'page'],
        ['?page=-1', 'page'],
        ['?page=abc', 'page'],
        ['?page=1.5', 'page'],
        ['?limit=0', 'limit'],
        ['?limit=101', 'limit'],
        ['?floor=bad%24floor', 'floor'],
        ['?floor=a&floor=b', 'floor'],
        ['?departmentId=dept.bad', 'departmentId'],
      ];

      for (const [query, field] of cases) {
        const response = await get(`/api/rooms${query}`);
        assertError(response, 400, 'VALIDATION_ERROR');
        assert.equal(response.body.error.details[0].field, field, query);
      }
    });

    test('empty query values from the documented form are treated as omitted', async () => {
      const response = await get('/api/rooms?floor=&departmentId=&page=&limit=');

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.meta, { page: 1, limit: 20, total: 4 });
    });

    test('operator-style query keys are not parsed into database filters', async () => {
      // Express 5's simple query parser keeps "departmentId[$ne]" as an unrelated literal key.
      const response = await get('/api/rooms?departmentId[$ne]=x');

      assert.equal(response.status, 200);
      assert.equal(response.body.meta.total, 4);
    });

    test('missing, inactive, and invalid room IDs return 404 or 400', async () => {
      assertError(await get('/api/rooms/room_missing'), 404, 'NOT_FOUND');
      assertError(await get('/api/rooms/room_closed'), 404, 'NOT_FOUND');
      assertError(await get('/api/rooms/bad%24id'), 400, 'VALIDATION_ERROR');
    });
  });

  describe('floor map', () => {
    const floorKeys = ['coordinateOrigin', 'coordinateUnit', 'displayName', 'height', 'id', 'width'];
    const locationKeys = ['departmentId', 'displayName', 'height', 'id', 'roomType', 'width', 'x', 'y'];

    test('GET /api/map/floors lists active floors in level order with safe fields', async () => {
      const response = await get('/api/map/floors');

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data.map((floor) => floor.id), ['floor_ground', 'floor_first', 'floor_empty']);
      for (const floor of response.body.data) {
        assert.deepEqual(Object.keys(floor).sort(), floorKeys);
      }
      assert.deepEqual(response.body.data[0], {
        id: 'floor_ground',
        displayName: 'Ground Floor',
        width: 1000,
        height: 700,
        coordinateOrigin: 'top-left',
        coordinateUnit: 'map-unit',
      });
    });

    test('GET /api/map/floors/:floorId matches the documented map shape', async () => {
      const response = await get('/api/map/floors/floor_ground');

      assert.equal(response.status, 200);
      assert.deepEqual(Object.keys(response.body), ['data']);

      const { locations, ...floor } = response.body.data;
      assert.deepEqual(floor, {
        id: 'floor_ground',
        displayName: 'Ground Floor',
        width: 1000,
        height: 700,
        coordinateOrigin: 'top-left',
        coordinateUnit: 'map-unit',
      });
      assert.deepEqual(locations.map((location) => location.id), ['room_opd_1', 'room_opd_2', 'room_registration']);
      assert.deepEqual(locations.find((location) => location.id === 'room_registration'), {
        id: 'room_registration',
        displayName: 'Registration Desk',
        roomType: 'facility',
        departmentId: null,
        x: 80,
        y: 120,
        width: 180,
        height: 100,
      });
    });

    test('map locations expose only presentation/location metadata', async () => {
      const response = await get('/api/map/floors/floor_ground');

      for (const location of response.body.data.locations) {
        assert.deepEqual(Object.keys(location).sort(), locationKeys);
        for (const key of ['x', 'y', 'width', 'height']) {
          assert.equal(typeof location[key], 'number');
        }
      }
      assert.doesNotMatch(
        response.rawBody,
        /patient|token|queue|status|isActive|isAccessible|roomNumber|createdAt|updatedAt|__v/i,
      );
    });

    test('a floor without rooms returns an empty locations list', async () => {
      const response = await get('/api/map/floors/floor_empty');

      assert.equal(response.status, 200);
      assert.deepEqual(response.body.data.locations, []);
    });

    test('missing, inactive, and invalid floor IDs return 404 or 400', async () => {
      assertError(await get('/api/map/floors/floor_missing'), 404, 'NOT_FOUND');
      assertError(await get('/api/map/floors/floor_closed'), 404, 'NOT_FOUND');
      assertError(await get('/api/map/floors/bad%24id'), 400, 'VALIDATION_ERROR');
    });
  });
});

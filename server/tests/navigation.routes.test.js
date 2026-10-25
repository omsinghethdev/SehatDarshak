import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { Department } from '../src/modules/departments/department.model.js';
import { Room } from '../src/modules/rooms/room.model.js';
import { QueueToken } from '../src/modules/tokens/queueToken.model.js';
import { User } from '../src/modules/users/user.model.js';
import { devHospitalData } from '../src/seed/devDemoData.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { signAccessToken } from '../src/utils/accessToken.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { bearer, request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('navigation');
const app = createApp();
const users = {};
const headersFor = (name) => bearer(signAccessToken({ id: users[name]._id, role: users[name].role }));
const get = (path, name = 'patient') => request(app, { path, headers: name ? headersFor(name) : {} });
const routeUrl = (from, to, extra = '') => `/api/map/route?from=${from}&to=${to}${extra}`;

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

describe('indoor navigation API', { skip: databaseUnavailable }, () => {
  before(async () => {
    await seedDemoData(devHospitalData);
    users.patient = await User.create({ name: 'Nav Patient', identifier: 'nav_patient', passwordHash: 'not-used', role: 'patient' });
    users.staff = await User.create({ name: 'Nav Staff', identifier: 'nav_staff', passwordHash: 'not-used', role: 'staff', departmentId: 'dept_demo_opd' });
    await QueueToken.init();
  });
  after(dropTestDatabase);

  test('every navigation endpoint requires authentication; any signed-in role may use the map', async () => {
    for (const path of [
      '/api/map/floors/floor_ground/walkways',
      '/api/map/destinations',
      '/api/map/departments/dept_demo_card/destination',
      routeUrl('room_demo_entrance', 'room_demo_card_1'),
    ]) {
      assertError(await get(path, null), 401, 'UNAUTHORIZED');
      assert.equal((await get(path, 'staff')).status, 200, path);
    }
  });

  test('existing floor endpoints list the demo hospital without changing their shape', async () => {
    const floors = await get('/api/map/floors');
    assert.deepEqual(floors.body.data.map((floor) => floor.id), ['floor_ground', 'floor_demo_first', 'floor_demo_second']);
    const first = await get('/api/map/floors/floor_demo_first');
    assert.deepEqual(Object.keys(first.body.data).sort(), ['coordinateOrigin', 'coordinateUnit', 'displayName', 'height', 'id', 'locations', 'width']);
    assert.equal(first.body.data.locations.length, 9);
  });

  test('walkways: corridors, nodes, and edges of one floor', async () => {
    const response = await get('/api/map/floors/floor_ground/walkways');

    assert.equal(response.status, 200, response.rawBody);
    const { floorId, corridors, nodes, edges, transitions } = response.body.data;
    assert.equal(floorId, 'floor_ground');
    assert.deepEqual(corridors.map((corridor) => corridor.id), ['corridor_g_main', 'corridor_g_spine']);
    assert.equal(nodes.length, 25);
    const ids = new Set(nodes.map((node) => node.id));
    assert.ok(edges.every((edge) => ids.has(edge.from) && ids.has(edge.to)));
    assert.deepEqual(transitions.map((item) => item.kind).sort(), ['lift', 'stairs']);

    assertError(await get('/api/map/floors/floor_missing/walkways'), 404, 'NOT_FOUND');
    assertError(await get('/api/map/floors/bad%24id/walkways'), 400, 'VALIDATION_ERROR');
  });

  test('destinations: every navigable room, searchable by room or department', async () => {
    const all = await get('/api/map/destinations');
    assert.equal(all.status, 200);
    assert.equal(all.body.data.length, devHospitalData.rooms.length);
    assert.deepEqual(Object.keys(all.body.data[0]).sort(), ['departmentId', 'displayName', 'floorId', 'floorName', 'id', 'isEntrance', 'roomType', 'transition']);
    assert.doesNotMatch(all.rawBody, /patient|token|queue|isActive/i);

    const cardio = await get('/api/map/destinations?q=Cardio');
    assert.deepEqual(cardio.body.data.map((place) => place.id).sort(), ['room_demo_card_1', 'room_demo_card_ecg']);
    assert.deepEqual((await get('/api/map/destinations?q=')).body.data.length, all.body.data.length);
    assertError(await get(`/api/map/destinations?q=${'x'.repeat(61)}`), 400, 'VALIDATION_ERROR');
    assertError(await get('/api/map/destinations?q=a&q=b'), 400, 'VALIDATION_ERROR');
  });

  test('department destination: its own mapped room, null when none, 404 when unknown', async () => {
    const opd = await get('/api/map/departments/dept_demo_opd/destination');
    assert.equal(opd.status, 200);
    assert.equal(opd.body.data.destination.id, 'room_demo_opd_1');
    assert.deepEqual(opd.body.data.alternatives.map((place) => place.id), ['room_demo_opd_2']);

    await Department.create({ _id: 'dept_test_unmapped', name: 'Unmapped Clinic', code: 'UNM' });
    const unmapped = await get('/api/map/departments/dept_test_unmapped/destination');
    assert.deepEqual(unmapped.body.data, { departmentId: 'dept_test_unmapped', destination: null, alternatives: [] });

    assertError(await get('/api/map/departments/dept_missing/destination'), 404, 'NOT_FOUND');
    assertError(await get('/api/map/departments/bad%24id/destination'), 400, 'VALIDATION_ERROR');
  });

  test('route on one floor: graph path, distance, and instructions', async () => {
    const response = await get(routeUrl('room_demo_opd_1', 'room_demo_opd_2'));

    assert.equal(response.status, 200, response.rawBody);
    const route = response.body.data;
    assert.deepEqual(route.path, ['door_room_demo_opd_1', 'junction_g_380', 'junction_g_500', 'junction_g_560', 'door_room_demo_opd_2']);
    assert.equal(route.metres, 11);
    assert.deepEqual([route.from.id, route.to.id], ['room_demo_opd_1', 'room_demo_opd_2']);
    assert.deepEqual(route.steps.map((step) => step.kind), ['start', 'walk', 'arrive']);
    assert.equal(route.steps.at(-1).side, 'left');
  });

  test('route across floors: explicit stairs by default, the lift when stairs are avoided', async () => {
    const stairs = (await get(routeUrl('room_demo_entrance', 'room_demo_card_1'))).body.data;
    assert.deepEqual(stairs.floors.map((floor) => floor.id), ['floor_ground', 'floor_demo_first']);
    assert.deepEqual(stairs.segments.map((segment) => segment.floorId), ['floor_ground', 'floor_demo_first']);
    assert.deepEqual(stairs.steps.filter((s) => s.kind === 'stairs').map((s) => [s.floorId, s.toFloorId, s.direction]), [['floor_ground', 'floor_demo_first', 'up']]);
    assert.equal(stairs.avoidStairs, false);

    const lift = (await get(routeUrl('room_demo_entrance', 'room_demo_card_1', '&avoidStairs=true'))).body.data;
    assert.equal(lift.avoidStairs, true);
    assert.ok(lift.steps.some((step) => step.kind === 'lift'));
    assert.ok(!lift.path.some((id) => id.includes('stairs')));
    assert.ok(lift.estimatedSeconds > stairs.estimatedSeconds);
  });

  test('invalid route requests are rejected consistently', async () => {
    assertError(await get('/api/map/route?to=room_demo_opd_1'), 400, 'VALIDATION_ERROR');
    assertError(await get(routeUrl('bad%24id', 'room_demo_opd_1')), 400, 'VALIDATION_ERROR');
    assertError(await get(routeUrl('room_demo_opd_1', 'room_demo_opd_1')), 400, 'VALIDATION_ERROR');
    assertError(await get(routeUrl('room_demo_opd_1', 'room_demo_opd_2', '&avoidStairs=yes')), 400, 'VALIDATION_ERROR');
    assertError(await get(routeUrl('room_missing', 'room_demo_opd_1')), 404, 'NOT_FOUND');
  });

  test('a room off the walking graph, or closed lifts and stairs, give NO_ROUTE', async () => {
    await Room.create({ _id: 'room_test_store', name: 'Store Room', floorId: 'floor_ground', type: 'facility', mapPosition: { x: 740, y: 450, width: 100, height: 100 } });
    assertError(await get(routeUrl('room_demo_opd_1', 'room_test_store')), 404, 'NO_ROUTE');

    const connectors = ['room_demo_lift_g', 'room_demo_stairs_g'];
    await Room.updateMany({ _id: { $in: connectors } }, { $set: { isActive: false } });
    try {
      assertError(await get(routeUrl('room_demo_entrance', 'room_demo_card_1')), 404, 'NO_ROUTE');
      assert.equal((await get(routeUrl('room_demo_entrance', 'room_demo_pharmacy'))).status, 200);
    } finally {
      await Room.updateMany({ _id: { $in: connectors } }, { $set: { isActive: true } });
    }
    assert.equal((await get(routeUrl('room_demo_entrance', 'room_demo_card_1'))).status, 200);
  });

  test('booking a token, then navigating to its department; queue behaviour is unchanged', async () => {
    const booked = await request(app, { method: 'POST', path: '/api/queue-tokens', headers: headersFor('patient'), body: { departmentId: 'dept_demo_card' } });
    assert.equal(booked.status, 201, booked.rawBody);
    assert.equal(booked.body.data.status, 'waiting');
    assert.equal(booked.body.data.departmentId, 'dept_demo_card');

    const destination = (await get(`/api/map/departments/${booked.body.data.departmentId}/destination`)).body.data.destination;
    assert.equal(destination.id, 'room_demo_card_1');
    const route = await get(routeUrl('room_demo_entrance', destination.id));
    assert.equal(route.status, 200);
    assert.doesNotMatch(route.rawBody, /token|patient/i);

    const status = await get(`/api/queue-tokens/${booked.body.data.id}/status`);
    assert.equal(status.body.data.status, 'waiting');
    const again = await request(app, { method: 'POST', path: '/api/queue-tokens', headers: headersFor('patient'), body: { departmentId: 'dept_demo_card' } });
    assertError(again, 409, 'CONFLICT');
  });
});

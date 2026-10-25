import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEMO_HOSPITAL } from '../src/features/navigation/demoHospital.data.js';
import { departmentPlace, groupPlacesByFloor, searchDestinations } from '../src/features/navigation/destinationSearch.js';
import { buildNavigationGraph, findRoute, listNavigableLocations, resolveDepartmentDestination } from '../src/features/navigation/routeEngine.js';
import { describeStep, routeSummary } from '../src/features/navigation/routeInstructions.js';
import { clampViewBox, fitViewBox, routeFloorIds, routeOnFloor, zoomViewBox } from '../src/features/navigation/routeView.js';
import en from '../src/i18n/locales/en.js';
import hi from '../src/i18n/locales/hi.js';
import { directionsPath, isSafeId, tokenStatusPath } from '../src/routes/paths.js';

// A small translator over the real dictionaries (the app's translate.js also imports React).
function translator(dictionary, locale) {
  const plural = new Intl.PluralRules(locale);
  return (key, params = {}) => {
    let value = key.split('.').reduce((node, part) => node?.[part], dictionary);
    if (value && typeof value === 'object' && typeof params.count === 'number') {
      value = (params.count === 0 && value.zero) || value[plural.select(params.count)] || value.other;
    }
    assert.equal(typeof value, 'string', `missing translation ${key}`);
    return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
  };
}
const t = translator(en, 'en-IN');
const tHi = translator(hi, 'hi-IN');

// The client mock runs the same engine and data as the server (checked byte-for-byte there).
const graph = buildNavigationGraph(DEMO_HOSPITAL, {
  floors: DEMO_HOSPITAL.floors,
  rooms: DEMO_HOSPITAL.rooms.map((room) => ({ id: room.id, displayName: room.name, roomType: room.type, departmentId: room.departmentId, floorId: room.floorId })),
});
const places = listNavigableLocations(graph);
const departments = DEMO_HOSPITAL.departments;
const routeBetween = (from, to, avoidStairs = false) => findRoute(graph, { from, to, avoidStairs }).route;

describe('destination search and selection', () => {
  test('a department search offers the department, leading to its own mapped room', () => {
    const [first, ...rest] = searchDestinations({ places, departments, query: 'cardio' });

    assert.equal(first.kind, 'department');
    assert.equal(first.department.id, 'dept_demo_card');
    assert.equal(first.place.id, 'room_demo_card_1');
    assert.deepEqual(rest.map((result) => result.place.id).sort(), ['room_demo_card_1', 'room_demo_card_ecg']);
  });

  test('room names match, names starting with the query rank first, and results are limited', () => {
    const results = searchDestinations({ places, departments, query: 'wa' });
    assert.ok(results.length <= 8);
    assert.equal(results.find((result) => result.kind === 'place').place.displayName.toLowerCase().startsWith('wa'), true);
    assert.deepEqual(searchDestinations({ places, departments, query: '   ' }), []);
    assert.deepEqual(searchDestinations({ places, departments, query: 'helipad' }), []);
  });

  test("Demo OPD leads to a consultation room, never the canonical Registration Desk", () => {
    const placesById = new Map(places.map((place) => [place.id, place]));
    assert.equal(departmentPlace(departments[0], placesById).id, 'room_demo_opd_1');
    assert.equal(departmentPlace({ id: 'dept_x', roomIds: ['room_registration'] }, placesById), null);
  });

  test('starting points are every navigable place, grouped by floor in order, with the entrance marked', () => {
    const groups = groupPlacesByFloor(places);
    assert.deepEqual(groups.map((group) => group.floorName), ['Ground Floor', 'First Floor', 'Second Floor']);
    assert.equal(groups.reduce((sum, group) => sum + group.places.length, 0), DEMO_HOSPITAL.rooms.length);
    assert.deepEqual(places.filter((place) => place.isEntrance).map((place) => place.id), ['room_demo_entrance']);
  });
});

describe('route display', () => {
  const multiFloor = routeBetween('room_demo_entrance', 'room_demo_card_1');

  test('each floor shows only its own route segment, with start, destination, and stairs markers', () => {
    const ground = routeOnFloor(multiFloor, 'floor_ground');
    const first = routeOnFloor(multiFloor, 'floor_demo_first');
    const second = routeOnFloor(multiFloor, 'floor_demo_second');

    assert.equal(ground.lines.length, 1);
    assert.deepEqual(ground.start, { x: 500, y: 620 });
    assert.equal(ground.end, null);
    assert.deepEqual(ground.transitions.map(({ kind, role, floorId }) => [kind, role, floorId]), [['stairs', 'leave', 'floor_demo_first']]);

    assert.equal(first.start, null);
    assert.deepEqual(first.end, { x: 170, y: 260 });
    assert.deepEqual(first.transitions.map(({ kind, role, floorId }) => [kind, role, floorId]), [['stairs', 'arrive', 'floor_ground']]);

    assert.deepEqual(second, { lines: [], start: null, end: null, transitions: [] });
    assert.deepEqual([...routeFloorIds(multiFloor)].sort(), ['floor_demo_first', 'floor_ground']);
  });

  test('switching floors keeps the whole route: segments across floors add up to the route path', () => {
    const points = ['floor_ground', 'floor_demo_first'].flatMap((floorId) => routeOnFloor(multiFloor, floorId).lines.flat());
    assert.equal(points.length, multiFloor.path.length);
  });

  test('no route → nothing drawn', () => {
    assert.deepEqual(routeOnFloor(null, 'floor_ground'), { lines: [], start: null, end: null, transitions: [] });
  });

  test('the view fits a route or step within the floor, and zoom stays in bounds', () => {
    const floor = { width: 1000, height: 700 };
    const fitted = fitViewBox(floor, routeOnFloor(multiFloor, 'floor_ground').lines.flat());
    assert.ok(fitted.x >= 0 && fitted.y >= 0 && fitted.x + fitted.width <= 1000 && fitted.y + fitted.height <= 700);
    assert.ok(Math.abs(fitted.height / fitted.width - 0.7) < 1e-9);
    assert.deepEqual(fitViewBox(floor, []), { x: 0, y: 0, width: 1000, height: 700 });

    const zoomed = zoomViewBox(floor, { x: 0, y: 0, width: 1000, height: 700 }, 100);
    assert.equal(zoomed.width, 250);
    assert.deepEqual(zoomViewBox(floor, zoomed, 1 / 100), { x: 0, y: 0, width: 1000, height: 700 });
    assert.deepEqual(clampViewBox(floor, { x: 900, y: -50, width: 250, height: 175 }), { x: 750, y: 0, width: 250, height: 175 });
  });
});

describe('route instructions', () => {
  test('English sentences follow the route steps', () => {
    const route = routeBetween('room_demo_entrance', 'room_demo_card_1');
    assert.deepEqual(route.steps.map((step) => describeStep(step, route, t)), [
      'Start at Main Entrance (Ground Floor).',
      'Leave Main Entrance and walk about 17 m.',
      'Turn right and walk about 22 m.',
      'Take the stairs up to the First Floor. It is on your right.',
      'Leave the stairs, then turn left and walk about 39 m.',
      'Arrive at Cardiology Consultation Room. It is on your right.',
    ]);
    assert.deepEqual(routeSummary(route, t), { distance: 'About 86 m', time: 'about 2 min' });
  });

  test('the lift and going down are described; Hindi has every sentence too', () => {
    const route = routeBetween('room_demo_neu_1', 'room_demo_med_1', true);
    const english = route.steps.map((step) => describeStep(step, route, t));
    assert.ok(english.includes('Take the lift down to the Ground Floor. It is on your right.'), english.join('\n'));

    const hindi = route.steps.map((step) => describeStep(step, route, tHi));
    assert.ok(hindi.every((sentence) => sentence && !sentence.includes('{')), hindi.join('\n'));
    assert.ok(hindi.some((sentence) => sentence.includes('लिफ़्ट से नीचे Ground Floor पर जाएँ।')));
  });
});

describe('queue token → directions', () => {
  // The shape POST /api/queue-tokens returns (booking) and GET /api/queue-tokens/:id returns.
  const bookedToken = {
    id: 'token_3f9a2c1b0d4e5f6a7b8c9d0e',
    displayNumber: 'CAR-001',
    departmentId: 'dept_demo_card',
    status: 'waiting',
    patientsAhead: 0,
    estimatedWaitMinutes: 0,
    estimateLabel: 'Simulated estimate',
  };

  test("the destination comes from the token's departmentId and the link keeps the token", () => {
    const department = departments.find((item) => item.id === bookedToken.departmentId);
    const { destination } = resolveDepartmentDestination(graph, department);

    assert.equal(destination.id, 'room_demo_card_1');
    assert.equal(directionsPath({ to: destination.id, token: bookedToken.id }), `/navigation?to=room_demo_card_1&token=${bookedToken.id}`);
    // From the map, the patient returns to the same token's status page.
    assert.equal(tokenStatusPath(bookedToken.id), `/queue/tokens/${bookedToken.id}`);
  });

  test('a department without a mapped room has no destination, so no link is made', () => {
    const unmapped = resolveDepartmentDestination(graph, { id: 'dept_unmapped', roomIds: ['room_registration'] });
    assert.deepEqual(unmapped, { departmentId: 'dept_unmapped', destination: null, alternatives: [] });
  });

  test('unsafe values never reach a directions link', () => {
    assert.equal(directionsPath({ to: '../admin', token: 'x y' }), '/navigation');
    assert.equal(directionsPath({ to: 'room_demo_lab', avoidStairs: true }), '/navigation?to=room_demo_lab&stairs=avoid');
    assert.equal(isSafeId('token_ok-1'), true);
    assert.equal(isSafeId('a'.repeat(65)), false);
  });

  test('a route from the entrance to the booked department exists', () => {
    assert.ok(routeBetween('room_demo_entrance', 'room_demo_card_1').steps.length > 2);
  });
});

describe('locales', () => {
  test('English and Hindi have the same keys', () => {
    const keys = (node, prefix = '') =>
      Object.entries(node).flatMap(([key, value]) => (value && typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`]));
    assert.deepEqual(keys(hi).sort(), keys(en).sort());
  });
});

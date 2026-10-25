import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEMO_HOSPITAL } from '../src/modules/navigation/demoHospital.data.js';
import {
  buildNavigationGraph,
  findRoute,
  floorWalkways,
  listNavigableLocations,
  resolveDepartmentDestination,
  turnBetween,
} from '../src/modules/navigation/routeEngine.js';
import { devHospitalData } from '../src/seed/devDemoData.js';
import { findHospitalDataProblems } from '../src/seed/validateHospitalData.js';

const rooms = DEMO_HOSPITAL.rooms.map((room) => ({
  id: room.id,
  displayName: room.name,
  roomType: room.type,
  departmentId: room.departmentId,
  floorId: room.floorId,
}));
const build = (data = DEMO_HOSPITAL, options = {}) =>
  buildNavigationGraph(data, { floors: options.floors ?? DEMO_HOSPITAL.floors, rooms: options.rooms ?? rooms });
const graph = build();
const routeBetween = (from, to, avoidStairs = false) => findRoute(graph, { from, to, avoidStairs });
const nodesById = new Map(DEMO_HOSPITAL.nodes.map((node) => [node.id, node]));
const edgeKey = (a, b) => [a, b].sort().join('|');
const edgesByPair = new Map(DEMO_HOSPITAL.edges.map((edge) => [edgeKey(edge.from, edge.to), edge]));

describe('demo hospital dataset', () => {
  test('is fictional, labelled as such, and consistent with its floor plan', () => {
    assert.match(DEMO_HOSPITAL.name, /fictional/i);
    assert.deepEqual(findHospitalDataProblems(devHospitalData), []);
  });

  test('has the expected floors, departments, and facilities', () => {
    assert.deepEqual(DEMO_HOSPITAL.floors.map((floor) => floor.id), ['floor_ground', 'floor_demo_first', 'floor_demo_second']);
    assert.deepEqual(
      DEMO_HOSPITAL.departments.map((department) => department.code).sort(),
      ['CAR', 'MED', 'NEU', 'OPD', 'ORT', 'PED', 'RAD'],
    );
    const names = DEMO_HOSPITAL.rooms.map((room) => room.name);
    for (const name of ['Main Entrance', 'Registration Desk', 'Reception & Help Desk', 'Pharmacy', 'Main Waiting Area', 'Lift', 'Stairs', 'Accessible Washroom']) {
      assert.ok(names.includes(name), name);
    }
    for (const floor of DEMO_HOSPITAL.floors) {
      const onFloor = DEMO_HOSPITAL.rooms.filter((room) => room.floorId === floor.id).map((room) => room.name);
      assert.ok(onFloor.includes('Lift') && onFloor.includes('Stairs'), floor.id);
    }
  });

  test('every department resolves to one of its own rooms', () => {
    for (const department of DEMO_HOSPITAL.departments) {
      const { destination } = resolveDepartmentDestination(graph, department);
      assert.ok(destination, department.id);
      assert.equal(DEMO_HOSPITAL.rooms.find((room) => room.id === destination.id).departmentId, department.id);
    }
    // The canonical Registration Desk is listed first in Demo OPD's roomIds but is not an OPD room.
    assert.equal(resolveDepartmentDestination(graph, DEMO_HOSPITAL.departments[0]).destination.id, 'room_demo_opd_1');
  });
});

describe('graph validation catches misaligned data', () => {
  const variant = (change) => {
    const data = structuredClone(devHospitalData);
    change(data.navigationGraphs[0], data);
    return findHospitalDataProblems(data).join('\n');
  };

  test('a door off its room outline', () => {
    assert.match(variant((g) => (g.nodes.find((n) => n.id === 'door_room_demo_opd_1').y = 250)), /not on the outline/);
  });

  test('a corridor edge that leaves the drawn corridor', () => {
    assert.match(variant((g) => g.edges.push({ from: 'junction_g_170', to: 'junction_g_s385', kind: 'corridor' })), /leaves the drawn corridors/);
  });

  test('an implicit link between floors, or stairs that skip a floor', () => {
    assert.match(variant((g) => g.edges.push({ from: 'junction_g_170', to: 'junction_1_170', kind: 'corridor' })), /joins different floors/);
    assert.match(
      variant((g) => g.edges.push({ from: 'door_room_demo_stairs_g', to: 'door_room_demo_stairs_2', kind: 'stairs', metres: 16 })),
      /adjacent floors/,
    );
    assert.match(variant((g) => g.edges.push({ from: 'door_room_demo_opd_1', to: 'door_room_demo_card_1', kind: 'lift', seconds: 30 })), /must join two lift doors/);
  });

  test('a door passage through another room, a room without a door, and an unreachable door', () => {
    assert.match(variant((g) => g.edges.push({ from: 'door_room_demo_opd_1', to: 'junction_g_s385', kind: 'door' })), /passes through room "room_demo_med_1"/);
    assert.match(variant((g) => (g.nodes = g.nodes.filter((n) => n.id !== 'door_room_demo_lab'))), /room_demo_lab.*no door node/);
    assert.match(variant((g) => (g.edges = g.edges.filter((e) => e.to !== 'junction_g_740'))), /door_room_demo_pharmacy" cannot be reached/);
  });

  test('a floor reachable only by stairs', () => {
    assert.match(variant((g) => (g.edges = g.edges.filter((e) => e.kind !== 'lift'))), /can only be reached by stairs/);
  });
});

describe('route engine', () => {
  test('a same-floor route follows corridor edges and measures them', () => {
    const { route } = routeBetween('room_demo_opd_1', 'room_demo_opd_2');

    assert.deepEqual(route.path, ['door_room_demo_opd_1', 'junction_g_380', 'junction_g_500', 'junction_g_560', 'door_room_demo_opd_2']);
    // 20 + 120 + 60 + 20 map units at 0.05 m per unit.
    assert.equal(route.metres, 11);
    assert.equal(route.estimatedSeconds, 11);
    assert.equal(route.estimatedMinutes, 1);
    assert.deepEqual(route.floors, [{ id: 'floor_ground', displayName: 'Ground Floor' }]);
    assert.deepEqual(route.segments, [{ floorId: 'floor_ground', points: route.path.map((id) => ({ x: nodesById.get(id).x, y: nodesById.get(id).y })) }]);
  });

  test('every consecutive pair of route nodes is a dataset edge, and distance is their sum', () => {
    for (const [from, to, avoidStairs] of [
      ['room_demo_entrance', 'room_demo_card_1', false],
      ['room_demo_entrance', 'room_demo_ort_plaster', true],
      ['room_demo_neu_eeg', 'room_demo_pharmacy', false],
    ]) {
      const { route } = findRoute(graph, { from, to, avoidStairs });
      let metres = 0;
      for (let i = 1; i < route.path.length; i += 1) {
        const edge = edgesByPair.get(edgeKey(route.path[i - 1], route.path[i]));
        assert.ok(edge, `${route.path[i - 1]} → ${route.path[i]} is an edge`);
        const [a, b] = [nodesById.get(route.path[i - 1]), nodesById.get(route.path[i])];
        metres += edge.kind === 'lift' ? 0 : edge.kind === 'stairs' ? edge.metres : Math.hypot(b.x - a.x, b.y - a.y) * 0.05;
      }
      assert.equal(route.metres, Math.round(metres), `${from} → ${to}`);
    }
  });

  test('changing floor uses explicit stairs, or the lift when stairs are avoided', () => {
    const { route: stairs } = routeBetween('room_demo_entrance', 'room_demo_card_1');
    assert.ok(stairs.path.includes('door_room_demo_stairs_g') && stairs.path.includes('door_room_demo_stairs_1'));
    assert.deepEqual(stairs.floors.map((floor) => floor.id), ['floor_ground', 'floor_demo_first']);
    const climb = stairs.steps.find((step) => step.kind === 'stairs');
    assert.deepEqual([climb.floorId, climb.toFloorId, climb.direction], ['floor_ground', 'floor_demo_first', 'up']);

    const { route: lift } = routeBetween('room_demo_entrance', 'room_demo_card_1', true);
    assert.ok(!lift.path.some((id) => id.includes('stairs')));
    assert.deepEqual(lift.steps.filter((step) => step.kind === 'lift').map((step) => [step.toFloorId, step.direction]), [['floor_demo_first', 'up']]);

    const { route: down } = routeBetween('room_demo_neu_1', 'room_demo_med_1', true);
    assert.deepEqual(down.steps.filter((step) => step.kind === 'lift').map((step) => [step.floorId, step.toFloorId, step.direction]), [['floor_demo_second', 'floor_ground', 'down']]);
  });

  test('each walk, lift, and stairs step carries its time, adding up to the route estimate', () => {
    for (const avoidStairs of [false, true]) {
      const { route } = routeBetween('room_demo_entrance', 'room_demo_neu_1', avoidStairs);
      const timed = route.steps.filter((step) => ['walk', 'lift', 'stairs'].includes(step.kind));
      assert.ok(timed.every((step) => Number.isInteger(step.seconds) && step.seconds > 0));
      const total = timed.reduce((sum, step) => sum + step.seconds, 0);
      assert.ok(Math.abs(total - route.estimatedSeconds) <= timed.length, 'rounded step times add up to the route');
    }
    // The lift has no walking distance; its time is the lift edge's own value from the dataset.
    const { route: lift } = routeBetween('room_demo_entrance', 'room_demo_neu_1', true);
    const ride = lift.steps.find((step) => step.kind === 'lift');
    assert.equal(ride.metres, 0);
    assert.equal(ride.seconds, edgesByPair.get(edgeKey('door_room_demo_lift_g', 'door_room_demo_lift_2')).seconds);
  });

  test('consecutive flights of stairs become one instruction; the passed-through floor has no segment', () => {
    const { route: up } = routeBetween('room_demo_entrance', 'room_demo_ort_plaster');
    const climbs = up.steps.filter((step) => step.kind === 'stairs');
    assert.deepEqual(climbs.map((step) => [step.floorId, step.toFloorId, step.metres]), [['floor_ground', 'floor_demo_second', 16]]);
    assert.deepEqual(up.segments.map((segment) => segment.floorId), ['floor_ground', 'floor_demo_second']);
  });

  test('instructions follow the geometry of the edges walked', () => {
    // Out of OPD 1 (heading south), left along the corridor (east), OPD 2 is on the left (north).
    assert.deepEqual(
      routeBetween('room_demo_opd_1', 'room_demo_opd_2').route.steps.map(({ kind, turn, departFrom, side }) => ({ kind, turn, departFrom, side })),
      [
        { kind: 'start', turn: undefined, departFrom: undefined, side: undefined },
        { kind: 'walk', turn: 'left', departFrom: 'start', side: undefined },
        { kind: 'arrive', turn: undefined, departFrom: undefined, side: 'left' },
      ],
    );
    // Entrance: north up the spine, right (east) along the main corridor, stairs on the right;
    // upstairs: out of the stairwell (north), left (west), Cardiology on the right (north).
    assert.deepEqual(
      routeBetween('room_demo_entrance', 'room_demo_card_1').route.steps.map((step) => [step.kind, step.turn ?? step.side ?? null]),
      [['start', null], ['walk', 'depart'], ['walk', 'right'], ['stairs', 'right'], ['walk', 'left'], ['arrive', 'right']],
    );
    assert.equal(turnBetween({ x: 1, y: 0 }, { x: 0, y: 1 }), 'right');
    assert.equal(turnBetween({ x: 1, y: 0 }, { x: 0, y: -1 }), 'left');
    assert.equal(turnBetween({ x: 1, y: 0 }, { x: 1, y: 0.2 }), 'straight');
    assert.equal(turnBetween({ x: 1, y: 0 }, { x: -1, y: 0 }), 'back');
  });

  test('step points lie on the route and the steps add up to the total distance', () => {
    const { route: walk } = routeBetween('room_demo_entrance', 'room_demo_ort_plaster');
    const onRoute = new Set(walk.path.map((id) => `${nodesById.get(id).x},${nodesById.get(id).y}`));
    for (const step of walk.steps) for (const p of step.points) assert.ok(onRoute.has(`${p.x},${p.y}`));
    const stepMetres = walk.steps.reduce((sum, step) => sum + (step.metres ?? 0), 0);
    assert.ok(Math.abs(stepMetres - walk.metres) <= walk.steps.length, `${stepMetres} vs ${walk.metres}`);
  });

  test('floors are never joined without an explicit lift or stair edge', () => {
    const noLinks = build({ ...DEMO_HOSPITAL, edges: DEMO_HOSPITAL.edges.filter((edge) => edge.kind !== 'lift' && edge.kind !== 'stairs') });
    // The lift doors share coordinates on every floor, but that alone connects nothing.
    assert.deepEqual(findRoute(noLinks, { from: 'room_demo_lift_g', to: 'room_demo_lift_1' }), { error: 'no_route' });
    assert.ok(findRoute(noLinks, { from: 'room_demo_opd_1', to: 'room_demo_pharmacy' }).route);
  });

  test('disconnected, unknown, unmapped, and identical locations are reported, not guessed', () => {
    const noLift = build({ ...DEMO_HOSPITAL, edges: DEMO_HOSPITAL.edges.filter((edge) => edge.kind !== 'lift') });
    assert.deepEqual(findRoute(noLift, { from: 'room_demo_entrance', to: 'room_demo_card_1', avoidStairs: true }), { error: 'no_route' });
    assert.ok(findRoute(noLift, { from: 'room_demo_entrance', to: 'room_demo_card_1' }).route);

    assert.deepEqual(routeBetween('room_missing', 'room_demo_opd_1'), { error: 'unknown_location', field: 'from' });
    assert.deepEqual(routeBetween('room_demo_opd_1', 'room_missing'), { error: 'unknown_location', field: 'to' });
    assert.deepEqual(routeBetween('room_demo_opd_1', 'room_demo_opd_1'), { error: 'same_location', field: 'to' });

    const extra = build(DEMO_HOSPITAL, { rooms: [...rooms, { id: 'room_unmapped', displayName: 'Store', roomType: 'facility', departmentId: null, floorId: 'floor_ground' }] });
    assert.deepEqual(findRoute(extra, { from: 'room_demo_opd_1', to: 'room_unmapped' }), { error: 'not_navigable', field: 'to' });
  });

  test('inactive rooms and floors drop out of the graph', () => {
    const withoutLiftAndStairs = build(DEMO_HOSPITAL, { rooms: rooms.filter((room) => !/lift|stairs/.test(room.id)) });
    assert.deepEqual(findRoute(withoutLiftAndStairs, { from: 'room_demo_entrance', to: 'room_demo_card_1' }), { error: 'no_route' });

    const groundOnly = build(DEMO_HOSPITAL, { floors: DEMO_HOSPITAL.floors.slice(0, 1) });
    assert.deepEqual(findRoute(groundOnly, { from: 'room_demo_entrance', to: 'room_demo_card_1' }), { error: 'unknown_location', field: 'to' });
  });

  test('routes are deterministic', () => {
    assert.deepEqual(routeBetween('room_demo_neu_eeg', 'room_demo_lab'), routeBetween('room_demo_neu_eeg', 'room_demo_lab'));
  });

  test('navigable locations: all rooms, ordered by floor; search matches names and departments', () => {
    const all = listNavigableLocations(graph);
    assert.equal(all.length, DEMO_HOSPITAL.rooms.length);
    assert.deepEqual([...new Set(all.map((place) => place.floorId))], ['floor_ground', 'floor_demo_first', 'floor_demo_second']);
    assert.equal(all.find((place) => place.id === 'room_demo_entrance').isEntrance, true);
    assert.equal(all.find((place) => place.id === 'room_demo_lift_1').transition, 'lift');

    const cardio = listNavigableLocations(graph, { departments: DEMO_HOSPITAL.departments, query: 'cardio' });
    assert.deepEqual(cardio.map((place) => place.id).sort(), ['room_demo_card_1', 'room_demo_card_ecg']);
    assert.deepEqual(listNavigableLocations(graph, { departments: DEMO_HOSPITAL.departments, query: 'NEU' }).map((p) => p.id).sort(), ['room_demo_neu_1', 'room_demo_neu_eeg']);
    assert.deepEqual(listNavigableLocations(graph, { query: 'zzz' }), []);
  });

  test('walkways for a floor contain only that floor, and lift/stair links as transitions', () => {
    const walkways = floorWalkways(DEMO_HOSPITAL, graph, 'floor_demo_first');
    assert.ok(walkways.nodes.every((node) => node.id.includes('_1_') || nodesById.get(node.id).floorId === 'floor_demo_first'));
    assert.deepEqual(walkways.corridors.map((corridor) => corridor.id), ['corridor_1_main', 'corridor_1_spine']);
    assert.ok(walkways.edges.every((edge) => edge.kind === 'corridor' || edge.kind === 'door'));
    assert.deepEqual(
      walkways.transitions.map(({ nodeId, kind, floorIds }) => [nodeId, kind, floorIds]).sort(),
      [
        ['door_room_demo_lift_1', 'lift', ['floor_ground', 'floor_demo_second']],
        ['door_room_demo_stairs_1', 'stairs', ['floor_ground', 'floor_demo_second']],
      ],
    );
  });
});

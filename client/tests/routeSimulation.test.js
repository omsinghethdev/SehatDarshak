import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEMO_HOSPITAL } from '../src/features/navigation/demoHospital.data.js';
import { buildNavigationGraph, findRoute, listNavigableLocations, resolveDepartmentDestination } from '../src/features/navigation/routeEngine.js';
import { SIMULATION_CONFIG, buildSimulationTrack, createSimulationController, positionAt, resolveStartPlace } from '../src/features/navigation/routeSimulation.js';
import { directionsPath } from '../src/routes/paths.js';

// The client mock runs the same engine and data as the server (checked byte-for-byte there).
const graph = buildNavigationGraph(DEMO_HOSPITAL, {
  floors: DEMO_HOSPITAL.floors,
  rooms: DEMO_HOSPITAL.rooms.map((room) => ({ id: room.id, displayName: room.name, roomType: room.type, departmentId: room.departmentId, floorId: room.floorId })),
});
const places = listNavigableLocations(graph);
const routeBetween = (from, to, avoidStairs = false) => findRoute(graph, { from, to, avoidStairs }).route;

const ENTRANCE = 'room_demo_entrance';
const NEUROLOGY = 'room_demo_neu_1'; // Second Floor
const stairsRoute = routeBetween(ENTRANCE, NEUROLOGY);
const liftRoute = routeBetween(ENTRANCE, NEUROLOGY, true);
const groundRoute = routeBetween(ENTRANCE, 'room_demo_pharmacy');

// Animation frames and a clock that only move when the test says so.
function fakeFrames() {
  let now = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    request(callback) {
      const id = nextId++;
      pending.set(id, callback);
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
    now: () => now,
    get pendingCount() {
      return pending.size;
    },
    /** Advances the clock in frame-sized steps, running the frames that are due. */
    advance(ms, frameMs = 16) {
      const end = now + ms;
      while (now < end) {
        now = Math.min(end, now + frameMs);
        const due = [...pending.entries()];
        pending.clear();
        for (const [, callback] of due) callback(now);
      }
    },
  };
}

function fakeVisibility() {
  let hidden = false;
  const listeners = new Set();
  return {
    isHidden: () => hidden,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setHidden(value) {
      hidden = value;
      listeners.forEach((listener) => listener());
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

function controllerFor(route, options = {}) {
  const frames = fakeFrames();
  const visibility = fakeVisibility();
  const updates = [];
  const controller = createSimulationController({
    track: buildSimulationTrack(route),
    rate: 1,
    frames,
    visibility,
    onUpdate: (snapshot) => updates.push(snapshot),
    ...options,
  });
  return { controller, frames, visibility, updates };
}

// True if `point` lies on the segment a–b (within rounding).
function onSegment(point, a, b) {
  const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
  const within = Math.min(a.x, b.x) - 1e-6 <= point.x && point.x <= Math.max(a.x, b.x) + 1e-6 && Math.min(a.y, b.y) - 1e-6 <= point.y && point.y <= Math.max(a.y, b.y) + 1e-6;
  return Math.abs(cross) < 1e-6 && within;
}

describe('simulation track', () => {
  test('the track uses the route edges: distance matches the route and time comes from the steps', () => {
    const track = buildSimulationTrack(stairsRoute);
    assert.equal(track.totalMetres, stairsRoute.steps.reduce((sum, step) => sum + (step.metres ?? 0), 0));
    assert.ok(Math.abs(track.totalMetres - stairsRoute.metres) <= 2, 'rounded step distances add up to the route');

    const stairs = stairsRoute.steps.find((step) => step.kind === 'stairs');
    const piece = track.pieces.find((item) => item.kind === 'stairs');
    assert.equal(piece.endTime - piece.startTime, stairs.seconds, 'stairs take their own time from the route');
    const walk = track.pieces.find((item) => item.kind === 'walk');
    assert.equal(walk.endTime - walk.startTime, walk.metres / SIMULATION_CONFIG.walkingMetresPerSecond);
  });

  test('a lift (0 m in the dataset) still takes its own time, so the floor change is visible', () => {
    const lift = liftRoute.steps.find((step) => step.kind === 'lift');
    assert.equal(lift.metres, 0);
    assert.ok(lift.seconds > 0, 'the route now carries step seconds');
    const piece = buildSimulationTrack(liftRoute).pieces.find((item) => item.kind === 'lift');
    assert.equal(piece.endTime - piece.startTime, lift.seconds);
  });

  test('missing step values fall back to the documented demo scale', () => {
    const route = {
      steps: [
        { index: 0, kind: 'start', floorId: 'f1', points: [{ x: 0, y: 0 }] },
        { index: 1, kind: 'walk', floorId: 'f1', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] },
        { index: 2, kind: 'lift', floorId: 'f1', toFloorId: 'f2', direction: 'up', points: [{ x: 200, y: 0 }] },
        { index: 3, kind: 'arrive', floorId: 'f2', points: [{ x: 200, y: 0 }] },
      ],
    };
    const track = buildSimulationTrack(route);
    assert.equal(track.pieces[0].metres, 200 * SIMULATION_CONFIG.fallbackMetresPerMapUnit);
    assert.equal(track.pieces[1].endTime - track.pieces[1].startTime, SIMULATION_CONFIG.fallbackTransitionSeconds);
  });
});

describe('marker position', () => {
  test('the marker moves only along the ordered route edges of the current step', () => {
    const track = buildSimulationTrack(stairsRoute);
    let lastProgress = -1;
    let lastStep = 0;
    for (let time = 0; time <= track.totalSeconds; time += 0.5) {
      const position = positionAt(track, time);
      const step = stairsRoute.steps[position.stepIndex];
      assert.ok(position.stepIndex >= lastStep, 'steps never go backwards');
      assert.ok(position.progress >= lastProgress, 'progress never goes backwards');
      lastStep = position.stepIndex;
      lastProgress = position.progress;
      if (step.kind === 'walk' && !position.arrived) {
        assert.equal(position.floorId, step.floorId);
        const onRoute = step.points.slice(1).some((b, i) => onSegment(position.point, step.points[i], b));
        assert.ok(onRoute, `at ${time}s the marker is on an edge of step ${step.index}`);
      }
    }
  });

  test('instructions advance by distance: start, each walk, the stairs, then arrival', () => {
    const track = buildSimulationTrack(stairsRoute);
    const seen = [];
    for (let time = 0; time <= track.totalSeconds + 1; time += 0.25) {
      const { stepIndex } = positionAt(track, time);
      if (seen.at(-1) !== stepIndex) seen.push(stepIndex);
    }
    assert.deepEqual(seen, stairsRoute.steps.map((step) => step.index));
  });

  test('remaining distance and time count down to zero at arrival', () => {
    const track = buildSimulationTrack(stairsRoute);
    const half = positionAt(track, track.totalSeconds / 2);
    assert.ok(half.remainingMetres > 0 && half.remainingMetres < track.totalMetres);
    assert.equal(half.remainingSeconds, track.totalSeconds / 2);
    const end = positionAt(track, track.totalSeconds);
    assert.equal(end.arrived, true);
    assert.equal(end.remainingMetres, 0);
    assert.equal(end.stepIndex, stairsRoute.steps.at(-1).index);
    assert.deepEqual(end.point, stairsRoute.steps.at(-1).points[0]);
  });

  test('a floor change happens only through the stairs step, and continues on the new floor', () => {
    const track = buildSimulationTrack(stairsRoute);
    const piece = track.pieces.find((item) => item.kind === 'stairs');
    const during = positionAt(track, (piece.startTime + piece.endTime) / 2);
    assert.equal(during.floorId, 'floor_ground', 'still on the floor being left');
    assert.deepEqual(during.transition && [during.transition.kind, during.transition.toFloorId], ['stairs', 'floor_demo_second']);

    const after = positionAt(track, piece.endTime + 0.1);
    assert.equal(after.floorId, 'floor_demo_second');
    assert.equal(after.transition, null);
    // Arrives at the lift/stairs door on the new floor (same shaft), never somewhere else.
    const nextStep = stairsRoute.steps[piece.stepIndex + 1];
    assert.deepEqual(nextStep.points[0], piece.point);

    // Every floor the marker is on was reached by a lift or stairs step from the previous one.
    const floors = [];
    for (let time = 0; time <= track.totalSeconds; time += 0.5) {
      const { floorId } = positionAt(track, time);
      if (floors.at(-1) !== floorId) floors.push(floorId);
    }
    assert.deepEqual(floors, ['floor_ground', 'floor_demo_second']);
  });

  test('routes with several floor changes visit each floor in order', () => {
    const route = routeBetween(NEUROLOGY, 'room_demo_card_1', true); // Second → First by lift
    const back = routeBetween('room_demo_card_1', 'room_demo_pharmacy', true); // First → Ground
    for (const item of [route, back, liftRoute]) {
      const track = buildSimulationTrack(item);
      const floors = [];
      for (let time = 0; time <= track.totalSeconds; time += 0.5) {
        const { floorId } = positionAt(track, time);
        if (floors.at(-1) !== floorId) floors.push(floorId);
      }
      const expected = [item.steps[0].floorId, ...item.steps.filter((step) => step.toFloorId).map((step) => step.toFloorId)];
      assert.deepEqual(floors, expected);
    }
  });
});

describe('simulation controller', () => {
  test('start moves the marker by elapsed time × playback rate, not per frame', () => {
    const { controller, frames } = controllerFor(groundRoute, { rate: 2 });
    controller.start();
    frames.advance(1000, 16);
    const slow = controller.getSnapshot().position.time;

    const other = controllerFor(groundRoute, { rate: 2 });
    other.controller.start();
    other.frames.advance(1000, 100); // fewer, longer frames
    assert.ok(Math.abs(slow - 2) < 0.05, `about 2 simulated seconds, got ${slow}`);
    assert.ok(Math.abs(other.controller.getSnapshot().position.time - slow) < 0.05);
  });

  test('pause keeps the position; resume continues from it', () => {
    const { controller, frames } = controllerFor(groundRoute);
    controller.start();
    frames.advance(3000);
    controller.pause();
    const paused = controller.getSnapshot();
    assert.equal(paused.status, 'paused');
    assert.equal(frames.pendingCount, 0, 'no frames while paused');

    frames.advance(10_000);
    assert.equal(controller.getSnapshot().position.time, paused.position.time, 'time does not pass while paused');

    controller.resume();
    frames.advance(1000);
    assert.ok(Math.abs(controller.getSnapshot().position.time - (paused.position.time + 1)) < 0.05);
  });

  test('restart returns the marker to the start of the route and keeps running', () => {
    const { controller, frames } = controllerFor(stairsRoute);
    controller.start();
    frames.advance(30_000, 50);
    assert.ok(controller.getSnapshot().position.stepIndex > 1);
    controller.restart();
    const snapshot = controller.getSnapshot();
    assert.equal(snapshot.status, 'running');
    assert.equal(snapshot.position.time, 0);
    assert.equal(snapshot.position.stepIndex, 0);
    assert.equal(snapshot.position.floorId, stairsRoute.steps[0].floorId);
    assert.equal(frames.pendingCount, 1);
  });

  test('arrival is detected from route progress, and the loop stops', () => {
    const { controller, frames, updates } = controllerFor(stairsRoute, { rate: 4 });
    controller.start();
    const total = buildSimulationTrack(stairsRoute).totalSeconds;
    frames.advance((total / 4) * 1000 + 500, 50);
    const snapshot = controller.getSnapshot();
    assert.equal(snapshot.status, 'arrived');
    assert.equal(snapshot.position.arrived, true);
    assert.equal(snapshot.position.floorId, 'floor_demo_second');
    assert.equal(frames.pendingCount, 0);
    assert.equal(updates.at(-1).status, 'arrived');
    // Start again after arriving begins a new run from the start.
    controller.start();
    assert.equal(controller.getSnapshot().position.time, 0);
  });

  test('the multi-floor run reports the floor change in its updates', () => {
    const { controller, frames, updates } = controllerFor(stairsRoute, { rate: 4 });
    controller.start();
    frames.advance(60_000, 50);
    const floors = [];
    for (const update of updates) if (floors.at(-1) !== update.position.floorId) floors.push(update.position.floorId);
    assert.deepEqual(floors, ['floor_ground', 'floor_demo_second']);
    assert.ok(updates.some((update) => update.position.transition?.kind === 'stairs'), 'the stairs state is shown');
  });

  test('clicking Start repeatedly never creates a second animation loop', () => {
    const { controller, frames } = controllerFor(groundRoute);
    controller.start();
    controller.start();
    controller.start();
    assert.equal(frames.pendingCount, 1);
    frames.advance(500);
    controller.start();
    controller.resume();
    assert.equal(frames.pendingCount, 1);
    controller.restart();
    controller.restart();
    assert.equal(frames.pendingCount, 1);
  });

  test('position updates are throttled, not sent every frame', () => {
    const { controller, frames, updates } = controllerFor(groundRoute);
    controller.start();
    const before = updates.length;
    frames.advance(1000, 10); // 100 frames
    const sent = updates.length - before;
    assert.ok(sent <= Math.ceil(1000 / SIMULATION_CONFIG.updateIntervalMs) + 1, `${sent} updates`);
    assert.ok(sent >= 10);
  });

  test('a hidden tab pauses the simulation; it resumes from the same position when visible', () => {
    const { controller, frames, visibility } = controllerFor(groundRoute);
    controller.start();
    frames.advance(2000);
    visibility.setHidden(true);
    const hidden = controller.getSnapshot();
    assert.equal(hidden.status, 'paused');
    assert.equal(hidden.pausedByHidden, true);
    assert.equal(frames.pendingCount, 0);

    frames.advance(60_000); // the tab stays hidden for a minute
    visibility.setHidden(false);
    assert.equal(controller.getSnapshot().status, 'running');
    assert.equal(controller.getSnapshot().position.time, hidden.position.time);

    // A simulation the patient paused stays paused when the tab comes back.
    controller.pause();
    visibility.setHidden(true);
    visibility.setHidden(false);
    assert.equal(controller.getSnapshot().status, 'paused');
  });

  test('stop and dispose clean up: no frames, no listener, no more updates', () => {
    const { controller, frames, visibility, updates } = controllerFor(groundRoute);
    assert.equal(visibility.listenerCount, 0, 'nothing is set up before Start (safe under Strict Mode)');
    controller.start();
    assert.equal(visibility.listenerCount, 1);
    controller.stop();
    assert.equal(controller.getSnapshot().status, 'idle');
    assert.equal(frames.pendingCount, 0);

    controller.start();
    controller.dispose();
    assert.equal(frames.pendingCount, 0);
    assert.equal(visibility.listenerCount, 0);
    const count = updates.length;
    controller.start();
    controller.resume();
    visibility.setHidden(true);
    frames.advance(1000);
    assert.equal(updates.length, count);
  });

  test('changing the destination: the old simulation is disposed and the new one starts idle', () => {
    // useRouteSimulation disposes the controller of the previous route, as here.
    const first = controllerFor(stairsRoute);
    first.controller.start();
    first.frames.advance(2000);
    first.controller.dispose();
    assert.equal(first.frames.pendingCount, 0);
    const updatesAfter = first.updates.length;
    first.frames.advance(5000);
    assert.equal(first.updates.length, updatesAfter, 'the old route sends nothing more');

    const second = controllerFor(groundRoute);
    assert.equal(second.controller.getSnapshot().status, 'idle');
    assert.equal(second.controller.getSnapshot().position.time, 0);
    assert.equal(second.frames.pendingCount, 0);
  });

  test('changing the playback speed keeps the position continuous', () => {
    const { controller, frames } = controllerFor(groundRoute);
    controller.start();
    frames.advance(2000);
    const before = controller.getSnapshot().position.time;
    controller.setRate(4);
    assert.ok(Math.abs(controller.getSnapshot().position.time - before) < 0.05);
    frames.advance(1000);
    assert.ok(Math.abs(controller.getSnapshot().position.time - (before + 4)) < 0.1);
  });
});

describe('start, destination, and token', () => {
  test('without a start in the link, the demo start is the main entrance', () => {
    const result = resolveStartPlace(places, null, 'room_demo_card_1');
    assert.equal(result.place.id, ENTRANCE);
    assert.equal(result.isDefault, true);
  });

  test('a start named in the link is used; an unknown one is an error, never replaced', () => {
    assert.deepEqual(resolveStartPlace(places, 'room_demo_pharmacy', 'room_demo_card_1').isDefault, false);
    assert.deepEqual(resolveStartPlace(places, 'room_nowhere', 'room_demo_card_1'), { place: null, reason: 'invalid' });
  });

  test('when the destination is the entrance, or no entrance exists, the patient must choose a start', () => {
    assert.deepEqual(resolveStartPlace(places, null, ENTRANCE), { place: null, reason: 'noDefault' });
    assert.deepEqual(resolveStartPlace(places.filter((place) => !place.isEntrance), null, 'room_demo_card_1'), { place: null, reason: 'noDefault' });
  });

  test("a token's department resolves to its mapped room, and the link keeps the token for the way back", () => {
    const token = { id: 'tok_123', departmentId: 'dept_demo_card' };
    const department = DEMO_HOSPITAL.departments.find((item) => item.id === token.departmentId);
    const { destination } = resolveDepartmentDestination(graph, department);
    assert.equal(destination.id, 'room_demo_card_1');
    assert.equal(directionsPath({ to: destination.id, token: token.id }), '/navigation?to=room_demo_card_1&token=tok_123');

    const start = resolveStartPlace(places, null, destination.id);
    const route = routeBetween(start.place.id, destination.id);
    const track = buildSimulationTrack(route);
    assert.equal(positionAt(track, track.totalSeconds).floorId, 'floor_demo_first');
  });

  test('a department without a mapped room gives no destination, so there is nothing to simulate', () => {
    const { destination } = resolveDepartmentDestination(graph, { id: 'dept_unmapped', roomIds: [] });
    assert.equal(destination, null);
  });

  test('invalid or missing routes fail safely', () => {
    assert.equal(findRoute(graph, { from: ENTRANCE, to: 'room_nowhere' }).error, 'unknown_location');
    const empty = buildSimulationTrack(null);
    assert.equal(empty.totalSeconds, 0);
    assert.equal(positionAt(empty, 5).point, null);
    const { controller, frames } = controllerFor({ steps: [] });
    controller.start();
    assert.equal(controller.getSnapshot().status, 'arrived');
    assert.equal(frames.pendingCount, 0, 'no loop for an empty route');
  });
});

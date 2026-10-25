/*
 * Simulated navigation: a marker that moves along a route from GET /api/map/route on its own.
 * It is a demonstration, not tracking: nothing here reads the device's position.
 *
 * No React, so it is unit-tested directly (client/tests/routeSimulation.test.js). The React
 * wrapper is useRouteSimulation.js.
 *
 * Movement follows the route's own steps: a walk step's `points` are the graph nodes it passes
 * through, so the marker only moves along graph edges (corridors and door passages), never in a
 * straight line between unrelated points. Lift and stairs steps hold the marker at the lift or
 * stairs door for the step's time, then the next step continues on the new floor.
 */
import { documentVisibility } from '../../lib/autoRefresh';

export const SIMULATION_CONFIG = Object.freeze({
  // Simulated walking pace. It matches the demo dataset's planning assumption (1 m/s); it is not
  // a measured speed.
  walkingMetresPerSecond: 1,
  // How much faster than the simulated time the demo plays. The default makes an average demo
  // route take under a minute while staying easy to follow.
  playbackRates: Object.freeze([1, 2, 4]),
  defaultPlaybackRate: 2,
  // Used only if a route step lacks its own values: the demo map's scale (20 map units = 1 m) and
  // a lift/stairs time.
  fallbackMetresPerMapUnit: 0.05,
  fallbackTransitionSeconds: 20,
  // The marker's position is reported at most this often (the map does not need 60 updates/s).
  updateIntervalMs: 50,
});

const TRANSITIONS = new Set(['lift', 'stairs']);
const positive = (value) => Number.isFinite(value) && value > 0;

function polylineLengths(points) {
  const lengths = [];
  for (let i = 1; i < points.length; i += 1) lengths.push(Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  return lengths;
}

/**
 * Splits a route into timed pieces: walking (along the step's points) and floor changes.
 * Times are simulated seconds at 1× playback. Start and arrive steps take no time.
 *   → { pieces, totalSeconds, totalMetres, start, end }
 */
export function buildSimulationTrack(route, config = SIMULATION_CONFIG) {
  const steps = route?.steps ?? [];
  const pieces = [];
  let time = 0;
  let metres = 0;

  for (const step of steps) {
    if (step.kind === 'walk' && step.points?.length > 1) {
      const lengths = polylineLengths(step.points);
      const length = lengths.reduce((sum, value) => sum + value, 0);
      if (!(length > 0)) continue;
      const stepMetres = positive(step.metres) ? step.metres : length * config.fallbackMetresPerMapUnit;
      const seconds = stepMetres / config.walkingMetresPerSecond;
      pieces.push({ kind: 'walk', stepIndex: step.index, floorId: step.floorId, points: step.points, lengths, length, metres: stepMetres, startTime: time, endTime: time + seconds, startMetres: metres });
      time += seconds;
      metres += stepMetres;
    } else if (TRANSITIONS.has(step.kind) && step.points?.length > 0) {
      const stepMetres = positive(step.metres) ? step.metres : 0;
      let seconds = config.fallbackTransitionSeconds;
      if (positive(step.seconds)) seconds = step.seconds;
      else if (stepMetres > 0) seconds = stepMetres / config.walkingMetresPerSecond;
      pieces.push({
        kind: step.kind,
        stepIndex: step.index,
        floorId: step.floorId,
        toFloorId: step.toFloorId,
        direction: step.direction,
        point: step.points[0],
        metres: stepMetres,
        startTime: time,
        endTime: time + seconds,
        startMetres: metres,
      });
      time += seconds;
      metres += stepMetres;
    }
  }

  const first = steps[0];
  const last = steps.at(-1);
  return {
    pieces,
    totalSeconds: time,
    totalMetres: metres,
    start: first ? { stepIndex: first.index, floorId: first.floorId, point: first.points[0] } : null,
    end: last ? { stepIndex: last.index, floorId: last.floorId, point: last.points[0] } : null,
  };
}

function pointAlong(piece, fraction) {
  let remaining = fraction * piece.length;
  for (let i = 0; i < piece.lengths.length; i += 1) {
    const length = piece.lengths[i];
    if (remaining <= length || i === piece.lengths.length - 1) {
      const t = length > 0 ? Math.min(1, remaining / length) : 1;
      const a = piece.points[i];
      const b = piece.points[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= length;
  }
  return piece.points.at(-1);
}

/**
 * Where the marker is at simulated `time` (seconds). `stepIndex` is the instruction being
 * followed; `transition` is set while in a lift or on the stairs (the marker stays at its door on
 * the floor being left until the floor change completes).
 */
export function positionAt(track, time) {
  const total = track.totalSeconds;
  const clamped = Math.max(0, Math.min(Number.isFinite(time) ? time : 0, total));
  const base = { time: clamped, progress: total > 0 ? clamped / total : 1, transition: null };

  if (!track.start || clamped >= total) {
    const end = track.end ?? track.start;
    return { ...base, arrived: true, stepIndex: end?.stepIndex ?? 0, floorId: end?.floorId ?? null, point: end?.point ?? null, remainingSeconds: 0, remainingMetres: 0 };
  }
  if (clamped <= 0) {
    return { ...base, arrived: false, stepIndex: track.start.stepIndex, floorId: track.start.floorId, point: track.start.point, remainingSeconds: total, remainingMetres: track.totalMetres };
  }

  const piece = track.pieces.find((item) => clamped < item.endTime) ?? track.pieces.at(-1);
  const duration = piece.endTime - piece.startTime;
  const fraction = duration > 0 ? (clamped - piece.startTime) / duration : 1;
  const travelled = piece.startMetres + piece.metres * fraction;
  const common = { ...base, arrived: false, stepIndex: piece.stepIndex, remainingSeconds: total - clamped, remainingMetres: Math.max(0, track.totalMetres - travelled) };

  if (piece.kind === 'walk') return { ...common, floorId: piece.floorId, point: pointAlong(piece, fraction) };
  return {
    ...common,
    floorId: piece.floorId,
    point: piece.point,
    transition: { kind: piece.kind, direction: piece.direction, fromFloorId: piece.floorId, toFloorId: piece.toFloorId, progress: fraction },
  };
}

/** Browser animation frames; tests pass their own. */
export const browserFrames = Object.freeze({
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
});

/**
 * Plays a track. One animation loop at most: start/resume while running do nothing.
 *
 *   status: 'idle' (not started) · 'running' · 'paused' · 'arrived'
 *   start()   idle/arrived → running from the beginning; paused → resume
 *   pause() · resume() · restart() (back to the start, running) · stop() (back to idle)
 *   setRate(rate)   playback speed, kept continuous (no jump in position)
 *   dispose()       cancels the frame and the visibility listener; no callbacks after it
 *
 * Simulated time comes from elapsed real time × rate, not from frame counts, so a slow device
 * moves the marker in bigger steps rather than more slowly. While the tab is hidden the
 * simulation pauses (and resumes from the same position when visible again) if it was running.
 * `onUpdate(snapshot)` is called on status changes and, while running, at most every
 * `updateIntervalMs`.
 */
export function createSimulationController({ track, rate = SIMULATION_CONFIG.defaultPlaybackRate, onUpdate, frames = browserFrames, visibility = documentVisibility, updateIntervalMs = SIMULATION_CONFIG.updateIntervalMs }) {
  let status = 'idle';
  let simTime = 0;
  let anchor = null; // { real, sim } while running
  let frameId = null;
  let lastEmit = -Infinity;
  let pausedByHidden = false;
  let unsubscribe = null;
  let disposed = false;
  let playbackRate = rate;

  const currentTime = () => (status === 'running' && anchor ? anchor.sim + ((frames.now() - anchor.real) / 1000) * playbackRate : simTime);

  function snapshot() {
    return { status, rate: playbackRate, pausedByHidden, position: positionAt(track, simTime) };
  }

  function emit() {
    if (disposed) return;
    lastEmit = frames.now();
    onUpdate?.(snapshot());
  }

  function cancelFrame() {
    if (frameId !== null) frames.cancel(frameId);
    frameId = null;
  }

  function tick() {
    frameId = null;
    if (disposed || status !== 'running') return;
    simTime = Math.min(currentTime(), track.totalSeconds);
    if (simTime >= track.totalSeconds) {
      status = 'arrived';
      anchor = null;
      emit();
      return;
    }
    if (frames.now() - lastEmit >= updateIntervalMs) emit();
    frameId = frames.request(tick);
  }

  function run() {
    cancelFrame();
    status = 'running';
    pausedByHidden = false;
    anchor = { real: frames.now(), sim: simTime };
    if (!unsubscribe) unsubscribe = visibility.subscribe(handleVisibility);
    emit();
    frameId = frames.request(tick);
  }

  function handleVisibility() {
    if (disposed) return;
    if (visibility.isHidden()) {
      if (status === 'running') {
        pause();
        pausedByHidden = true;
        emit();
      }
    } else if (status === 'paused' && pausedByHidden) {
      run();
    }
  }

  function pause() {
    if (disposed || status !== 'running') return;
    simTime = currentTime();
    anchor = null;
    cancelFrame();
    status = 'paused';
    pausedByHidden = false;
    emit();
  }

  return {
    start() {
      if (disposed || status === 'running') return;
      if (status === 'paused') {
        run();
        return;
      }
      simTime = 0;
      if (track.totalSeconds <= 0) {
        status = 'arrived';
        emit();
        return;
      }
      run();
    },
    pause,
    resume() {
      if (disposed || status !== 'paused') return;
      run();
    },
    restart() {
      if (disposed) return;
      simTime = 0;
      run();
    },
    stop() {
      if (disposed) return;
      cancelFrame();
      status = 'idle';
      simTime = 0;
      anchor = null;
      pausedByHidden = false;
      emit();
    },
    setRate(next) {
      if (disposed || !positive(next) || next === playbackRate) return;
      simTime = currentTime();
      if (anchor) anchor = { real: frames.now(), sim: simTime };
      playbackRate = next;
      emit();
    },
    getSnapshot: snapshot,
    /** True while an animation frame is scheduled (for tests). */
    get looping() {
      return frameId !== null;
    },
    dispose() {
      if (disposed) return;
      cancelFrame();
      unsubscribe?.();
      unsubscribe = null;
      disposed = true;
    },
  };
}

/**
 * The starting place for directions: the place named in the link if it is valid, otherwise (when
 * the link names none) the demo starting point, the main entrance, unless that is the
 * destination `toId` itself. Returns
 *   { place, isDefault } · { place: null, reason: 'invalid' | 'noDefault' }
 */
export function resolveStartPlace(places, fromId, toId = null) {
  if (fromId) {
    const place = places.find((item) => item.id === fromId);
    return place ? { place, isDefault: false } : { place: null, reason: 'invalid' };
  }
  const entrance = places.find((item) => item.isEntrance && item.id !== toId);
  return entrance ? { place: entrance, isDefault: true } : { place: null, reason: 'noDefault' };
}

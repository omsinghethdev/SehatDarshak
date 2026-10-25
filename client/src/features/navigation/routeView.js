/*
 * Pure helpers that turn a route from GET /api/map/route into what one floor's map draws.
 * No React, so they are unit-tested directly (client/tests/navigationView.test.js).
 */

const TRANSITIONS = new Set(['lift', 'stairs']);

/** Everything the map draws for `floorId`: route lines, start/end pins, and lift/stair markers. */
export function routeOnFloor(route, floorId) {
  if (!route) return { lines: [], start: null, end: null, transitions: [] };
  const steps = route.steps ?? [];
  const transitions = [];
  steps.forEach((step, index) => {
    if (!TRANSITIONS.has(step.kind)) return;
    // Where the patient leaves this floor…
    if (step.floorId === floorId) transitions.push({ kind: step.kind, role: 'leave', direction: step.direction, floorId: step.toFloorId, point: step.points[0] });
    // …and where they arrive on the new floor (the first point of the next step).
    const next = steps[index + 1];
    if (step.toFloorId === floorId && next?.points?.[0]) {
      transitions.push({ kind: step.kind, role: 'arrive', direction: step.direction, floorId: step.floorId, point: next.points[0] });
    }
  });

  const first = steps[0];
  const last = steps.at(-1);
  return {
    lines: (route.segments ?? []).filter((segment) => segment.floorId === floorId).map((segment) => segment.points),
    start: first && first.floorId === floorId ? first.points[0] : null,
    end: last && last.floorId === floorId ? last.points[0] : null,
    transitions,
  };
}

/** Floors the route touches (walking, or arriving/leaving by lift or stairs). */
export function routeFloorIds(route) {
  const ids = new Set();
  for (const segment of route?.segments ?? []) ids.add(segment.floorId);
  for (const step of route?.steps ?? []) {
    ids.add(step.floorId);
    if (step.toFloorId) ids.add(step.toFloorId);
  }
  return ids;
}

/** The floor a step is shown on: a lift/stairs step shows the floor being left. */
export function stepFloorId(step) {
  return step?.floorId ?? null;
}

/**
 * A viewBox that fits `points` (with padding) on a floor, keeping the floor's aspect ratio and
 * staying inside the floor. With no points, the whole floor.
 */
export function fitViewBox(floor, points, { padding = 90, minWidth = 320 } = {}) {
  const whole = { x: 0, y: 0, width: floor.width, height: floor.height };
  if (!points?.length) return whole;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const aspect = floor.height / floor.width;
  let width = Math.max(Math.max(...xs) - Math.min(...xs) + padding * 2, minWidth);
  let height = Math.max(Math.max(...ys) - Math.min(...ys) + padding * 2, width * aspect);
  width = Math.max(width, height / aspect);
  height = width * aspect;
  if (width >= floor.width || height >= floor.height) return whole;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return clampViewBox(floor, { x: cx - width / 2, y: cy - height / 2, width, height });
}

/** Keeps a viewBox inside the floor. */
export function clampViewBox(floor, box) {
  const width = Math.min(box.width, floor.width);
  const height = Math.min(box.height, floor.height);
  return {
    x: Math.min(Math.max(box.x, 0), floor.width - width),
    y: Math.min(Math.max(box.y, 0), floor.height - height),
    width,
    height,
  };
}

/** Zooms a viewBox about its centre by `factor` (> 1 zooms in), within the floor. */
export function zoomViewBox(floor, box, factor, { maxZoom = 4 } = {}) {
  const minWidth = floor.width / maxZoom;
  const width = Math.min(floor.width, Math.max(minWidth, box.width / factor));
  const height = width * (floor.height / floor.width);
  return clampViewBox(floor, { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height });
}

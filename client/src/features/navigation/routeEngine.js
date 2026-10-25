/*
 * Indoor route engine: shortest paths over an explicit walkable graph (see demoHospital.data.js).
 *
 * SHARED FILE: server/src/modules/navigation/routeEngine.js and
 * client/src/features/navigation/routeEngine.js must stay byte-for-byte identical
 * (server/tests/navigationShared.test.js checks this). It has no imports, so it runs unchanged
 * in Node and in the browser (the client uses it only for the development mock).
 *
 * Routes follow graph edges only. Lengths of walking edges come from their node coordinates
 * and the demo scale; lift and stair edges carry their own values. Paths minimise estimated
 * travel time (Dijkstra), with ties broken by node ID so results are deterministic.
 */

const VERTICAL_KINDS = new Set(['lift', 'stairs']);
const STRAIGHT_DEGREES = 30;
const U_TURN_DEGREES = 150;

const point = (node) => ({ x: node.x, y: node.y });

/**
 * Builds the routable graph from graph data and the *active* rooms and floors. Nodes on an
 * unknown or inactive floor, and doors of unknown or inactive rooms, are left out, so routes
 * never pass through them.
 *   graphData: { routing, nodes, edges }
 *   rooms:  [{ id, displayName, roomType, departmentId, floorId }]
 *   floors: [{ id, displayName, level }]
 */
export function buildNavigationGraph(graphData, { rooms, floors }) {
  const routing = graphData?.routing;
  const floorById = new Map(floors.map((floor) => [floor.id, floor]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const nodeById = new Map();
  const doorByRoom = new Map();

  for (const node of graphData?.nodes ?? []) {
    if (!floorById.has(node.floorId)) continue;
    if (node.kind === 'door' && (!roomById.has(node.roomId) || roomById.get(node.roomId).floorId !== node.floorId)) continue;
    nodeById.set(node.id, node);
    if (node.kind === 'door') doorByRoom.set(node.roomId, node.id);
  }

  const adjacency = new Map([...nodeById.keys()].map((id) => [id, []]));
  for (const edge of graphData?.edges ?? []) {
    const a = nodeById.get(edge.from);
    const b = nodeById.get(edge.to);
    if (!a || !b || !routing) continue;
    const vertical = VERTICAL_KINDS.has(edge.kind);
    // A walking edge must stay on one floor; a lift/stair edge must change floor.
    if (vertical === (a.floorId === b.floorId)) continue;

    let metres;
    let seconds;
    if (edge.kind === 'lift') {
      metres = 0;
      seconds = edge.seconds;
    } else if (edge.kind === 'stairs') {
      metres = edge.metres;
      seconds = metres / routing.stairsMetresPerSecond;
    } else {
      metres = Math.hypot(b.x - a.x, b.y - a.y) * routing.metresPerMapUnit;
      seconds = metres / routing.walkingMetresPerSecond;
    }
    if (!Number.isFinite(metres) || !Number.isFinite(seconds) || metres < 0 || seconds < 0) continue;

    adjacency.get(a.id).push({ to: b.id, kind: edge.kind, metres, seconds });
    adjacency.get(b.id).push({ to: a.id, kind: edge.kind, metres, seconds });
  }

  return { routing, floorById, roomById, nodeById, doorByRoom, adjacency };
}

/** Dijkstra on estimated seconds. Returns { nodes, edges } or null when unreachable. */
function shortestPath(graph, startId, goalId, { avoidStairs }) {
  const best = new Map([[startId, 0]]);
  const previous = new Map();
  const done = new Set();

  for (;;) {
    let current = null;
    for (const [id, cost] of best) {
      if (done.has(id)) continue;
      if (current === null || cost < best.get(current) || (cost === best.get(current) && id < current)) current = id;
    }
    if (current === null) return null;
    if (current === goalId) break;
    done.add(current);

    for (const link of graph.adjacency.get(current) ?? []) {
      if (avoidStairs && link.kind === 'stairs') continue;
      if (done.has(link.to)) continue;
      const cost = best.get(current) + link.seconds;
      if (!best.has(link.to) || cost < best.get(link.to)) {
        best.set(link.to, cost);
        previous.set(link.to, { from: current, link });
      }
    }
  }

  const nodes = [goalId];
  const edges = [];
  for (let id = goalId; id !== startId; ) {
    const step = previous.get(id);
    edges.unshift(step.link);
    nodes.unshift(step.from);
    id = step.from;
  }
  return { nodes: nodes.map((id) => graph.nodeById.get(id)), edges };
}

/** Turn between two headings on a y-down map: straight, left, right, or back (U-turn). */
export function turnBetween(heading, next) {
  const cross = heading.x * next.y - heading.y * next.x;
  const dot = heading.x * next.x + heading.y * next.y;
  const degrees = Math.abs((Math.atan2(cross, dot) * 180) / Math.PI);
  if (degrees <= STRAIGHT_DEGREES) return 'straight';
  if (degrees >= U_TURN_DEGREES) return 'back';
  return cross > 0 ? 'right' : 'left';
}

const doorOnly = (item) => item.type === 'leg' && item.edgeKinds.every((kind) => kind === 'door');
const sideOf = (turn) => (turn === 'left' || turn === 'right' ? turn : turn === 'straight' ? 'ahead' : null);

/**
 * Turns a node path into walking legs and floor changes, then tidies them into instructions:
 * a short door passage at the start of a leg is folded into "leave …, then turn …", and the
 * door passage into the destination (or a lift/stairs) becomes "it is on your left/right".
 */
function describePath(path) {
  const items = [];
  let leg = null;
  let heading = null;
  let departFrom = 'start';

  path.edges.forEach((link, index) => {
    const a = path.nodes[index];
    const b = path.nodes[index + 1];
    if (VERTICAL_KINDS.has(link.kind)) {
      if (leg) items.push(leg);
      leg = null;
      heading = null;
      const last = items.at(-1);
      if (last?.type === 'transition' && last.kind === link.kind) {
        last.toFloorId = b.floorId;
        last.metres += link.metres;
        last.seconds += link.seconds;
      } else {
        items.push({ type: 'transition', kind: link.kind, floorId: a.floorId, toFloorId: b.floorId, metres: link.metres, seconds: link.seconds, points: [point(a)] });
      }
      departFrom = link.kind;
      return;
    }

    const vector = { x: b.x - a.x, y: b.y - a.y };
    const turn = heading ? turnBetween(heading, vector) : 'depart';
    if (!leg || turn !== 'straight') {
      if (leg) items.push(leg);
      leg = { type: 'leg', floorId: a.floorId, turn, departFrom: turn === 'depart' ? departFrom : null, metres: 0, seconds: 0, points: [point(a)], edgeKinds: [] };
    }
    leg.metres += link.metres;
    leg.seconds += link.seconds;
    leg.points.push(point(b));
    leg.edgeKinds.push(link.kind);
    heading = vector;
  });
  if (leg) items.push(leg);

  // A door passage into the destination or a lift/stairs: fold it into the previous leg and
  // describe it as the side the door is on.
  const sides = new Map();
  for (let i = items.length - 1; i > 0; i -= 1) {
    const item = items[i];
    const before = items[i - 1];
    const atEnd = i === items.length - 1 || items[i + 1].type === 'transition';
    if (doorOnly(item) && item.turn !== 'depart' && atEnd && before.type === 'leg') {
      before.metres += item.metres;
      before.seconds += item.seconds;
      before.points.push(...item.points.slice(1));
      sides.set(i === items.length - 1 ? 'arrive' : items[i + 1], sideOf(item.turn));
      items.splice(i, 1);
    }
  }
  // A door passage at the start of a walk: merge it into the next leg ("leave …, then turn …").
  for (let i = 0; i < items.length - 1; i += 1) {
    const item = items[i];
    const next = items[i + 1];
    if (doorOnly(item) && item.turn === 'depart' && next.type === 'leg') {
      next.departFrom = item.departFrom;
      next.metres += item.metres;
      next.seconds += item.seconds;
      next.points = [...item.points, ...next.points.slice(1)];
      items.splice(i, 1);
    }
  }

  return { items, sides };
}

const round = (value) => Math.round(value);

/**
 * Route between two rooms (by room ID). Returns { route } or { error, field? }:
 *   unknown_location — the room is not an active room on an active floor
 *   not_navigable    — the room has no door on the walkable graph
 *   same_location    — start and destination are the same room
 *   no_route         — no connection exists (with the given options)
 */
export function findRoute(graph, { from, to, avoidStairs = false }) {
  for (const [field, id] of [['from', from], ['to', to]]) {
    if (!graph.roomById.has(id) || !graph.floorById.has(graph.roomById.get(id).floorId)) return { error: 'unknown_location', field };
  }
  if (from === to) return { error: 'same_location', field: 'to' };
  for (const [field, id] of [['from', from], ['to', to]]) {
    if (!graph.doorByRoom.has(id)) return { error: 'not_navigable', field };
  }

  const path = shortestPath(graph, graph.doorByRoom.get(from), graph.doorByRoom.get(to), { avoidStairs });
  if (!path) return { error: 'no_route' };

  const { items, sides } = describePath(path);
  const first = path.nodes[0];
  const last = path.nodes.at(-1);

  const steps = [{ kind: 'start', floorId: first.floorId, locationId: from, points: [point(first)] }];
  for (const item of items) {
    if (item.type === 'transition') {
      const direction = graph.floorById.get(item.toFloorId).level > graph.floorById.get(item.floorId).level ? 'up' : 'down';
      steps.push({ kind: item.kind, floorId: item.floorId, toFloorId: item.toFloorId, direction, side: sides.get(item) ?? null, metres: round(item.metres), seconds: round(item.seconds), points: item.points });
    } else {
      steps.push({ kind: 'walk', floorId: item.floorId, turn: item.turn, departFrom: item.departFrom, metres: round(item.metres), seconds: round(item.seconds), points: item.points });
    }
  }
  steps.push({ kind: 'arrive', floorId: last.floorId, locationId: to, side: sides.get('arrive') ?? null, points: [point(last)] });

  // One segment per stretch of walking on a floor (a stairwell passed through has none).
  const segments = [];
  let segment = null;
  path.nodes.forEach((node, index) => {
    if (index > 0 && VERTICAL_KINDS.has(path.edges[index - 1].kind)) segment = null;
    if (!segment) {
      segment = { floorId: node.floorId, points: [] };
      segments.push(segment);
    }
    segment.points.push(point(node));
  });
  const walked = segments.filter((item) => item.points.length > 1);

  const floorIds = [];
  for (const node of path.nodes) if (floorIds.at(-1) !== node.floorId) floorIds.push(node.floorId);
  const metres = path.edges.reduce((sum, link) => sum + link.metres, 0);
  const seconds = path.edges.reduce((sum, link) => sum + link.seconds, 0);
  const place = (id) => {
    const room = graph.roomById.get(id);
    return { id: room.id, displayName: room.displayName, floorId: room.floorId };
  };

  return {
    route: {
      from: place(from),
      to: place(to),
      avoidStairs: Boolean(avoidStairs),
      metres: round(metres),
      estimatedSeconds: round(seconds),
      estimatedMinutes: Math.max(1, Math.ceil(seconds / 60)),
      floors: floorIds.map((id) => ({ id, displayName: graph.floorById.get(id).displayName })),
      segments: walked,
      steps: steps.map((step, index) => ({ index, ...step })),
      path: path.nodes.map((node) => node.id),
    },
  };
}

/** A room as a navigation place, with its floor. */
function toPlace(graph, room) {
  const floor = graph.floorById.get(room.floorId);
  const node = graph.nodeById.get(graph.doorByRoom.get(room.id));
  return {
    id: room.id,
    displayName: room.displayName,
    roomType: room.roomType,
    departmentId: room.departmentId ?? null,
    floorId: room.floorId,
    floorName: floor.displayName,
    isEntrance: node?.entrance === true,
    transition: node?.transition ?? null,
  };
}

/**
 * Rooms that can be routed to or from (they have a door on the graph), ordered by floor level
 * and name. `query` matches room names and, through `departments`, department names and codes.
 */
export function listNavigableLocations(graph, { departments = [], query = '' } = {}) {
  const needle = query.trim().toLowerCase();
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const matches = (room) => {
    if (!needle) return true;
    const department = departmentById.get(room.departmentId);
    return [room.displayName, department?.name, department?.code].some((text) => text?.toLowerCase().includes(needle));
  };

  return [...graph.doorByRoom.keys()]
    .map((id) => graph.roomById.get(id))
    .filter(matches)
    .map((room) => toPlace(graph, room))
    .sort((a, b) => graph.floorById.get(a.floorId).level - graph.floorById.get(b.floorId).level || a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
}

/**
 * Where "navigate to department" leads: the first room in the department's roomIds that the
 * map assigns to that department (room.departmentId) and that is on the graph. `destination`
 * is null when there is none; nothing is guessed. `alternatives` lists its other such rooms.
 */
export function resolveDepartmentDestination(graph, department) {
  const places = (department.roomIds ?? [])
    .map((id) => graph.roomById.get(id))
    .filter((room) => room && room.departmentId === department.id && graph.doorByRoom.has(room.id))
    .map((room) => toPlace(graph, room));
  return { departmentId: department.id, destination: places[0] ?? null, alternatives: places.slice(1) };
}

/** One floor's drawable walkways: corridor areas, its nodes, and the edges on that floor. */
export function floorWalkways(graphData, graph, floorId) {
  const onFloor = (node) => node?.floorId === floorId;
  const nodes = [...graph.nodeById.values()].filter(onFloor);
  const edges = [];
  const transitions = new Map();
  for (const [id, links] of graph.adjacency) {
    const node = graph.nodeById.get(id);
    if (!onFloor(node)) continue;
    for (const link of links) {
      const other = graph.nodeById.get(link.to);
      if (VERTICAL_KINDS.has(link.kind)) {
        const entry = transitions.get(id) ?? { nodeId: id, kind: link.kind, floorIds: [] };
        entry.floorIds.push(other.floorId);
        transitions.set(id, entry);
      } else if (id < link.to) {
        edges.push({ from: id, to: link.to, kind: link.kind });
      }
    }
  }

  return {
    floorId,
    corridors: (graphData?.corridors ?? [])
      .filter((corridor) => corridor.floorId === floorId)
      .map(({ id, x, y, width, height }) => ({ id, x, y, width, height })),
    nodes: nodes.map((node) => ({ id: node.id, kind: node.kind, x: node.x, y: node.y, ...(node.roomId ? { locationId: node.roomId } : {}) })),
    edges,
    transitions: [...transitions.values()].map((entry) => ({
      ...entry,
      floorIds: [...new Set(entry.floorIds)].sort((a, b) => graph.floorById.get(a).level - graph.floorById.get(b).level),
    })),
  };
}

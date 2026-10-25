import { isValidResourceId } from '../utils/requestValidation.js';

const isPositiveNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isNonNegativeNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function checkIds(records, label, problems) {
  const seen = new Set();
  for (const { _id } of records) {
    if (!isValidResourceId(_id)) {
      problems.push(`${label} ID "${_id}" is not a valid resource ID`);
    }
    if (seen.has(_id)) {
      problems.push(`${label} ID "${_id}" is duplicated`);
    }
    seen.add(_id);
  }
}

function checkRoomPlacement(room, floor, problems) {
  const { x, y, width, height } = room.mapPosition ?? {};

  if (![x, y].every(isNonNegativeNumber) || ![width, height].every(isPositiveNumber)) {
    problems.push(`Room "${room._id}" needs non-negative x/y and positive width/height`);
    return;
  }

  if (x + width > floor.width || y + height > floor.height) {
    problems.push(`Room "${room._id}" extends outside floor "${floor._id}" (${floor.width} x ${floor.height})`);
  }
}

// ---- Walkable graph (indoor directions) --------------------------------------------------------

const rectOf = (item) => ({ x: item.x, y: item.y, width: item.width, height: item.height });
const roomRect = (room) => rectOf(room.mapPosition ?? {});
const insideRect = (p, r) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const strictlyInside = (p, r) => p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
const onBoundary = (p, r) =>
  insideRect(p, r) && (p.x === r.x || p.x === r.x + r.width || p.y === r.y || p.y === r.y + r.height);
const overlaps = (a, b) =>
  Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);

// Points every ~2 map units along a segment, including both ends.
function samples(a, b) {
  const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  return Array.from({ length: count + 1 }, (_, i) => ({ x: a.x + ((b.x - a.x) * i) / count, y: a.y + ((b.y - a.y) * i) / count }));
}

function reachable(startId, edges, allowed) {
  const links = new Map();
  for (const edge of edges.filter(allowed)) {
    for (const [a, b] of [[edge.from, edge.to], [edge.to, edge.from]]) {
      links.set(a, [...(links.get(a) ?? []), b]);
    }
  }
  const seen = new Set([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    for (const next of links.get(queue.shift()) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

// Checks that a walkable graph matches the floors and rooms it is drawn on: doors sit on their
// room's outline, junctions and corridor edges lie inside drawn corridors, door passages do not
// cross other rooms, corridors do not overlap rooms, floors are joined only by explicit
// lift/stair edges between lift/stair doors, every room on a mapped floor has a door, and
// every door can be reached — also without stairs.
function findNavigationGraphProblems(graph, { floorsById, roomsById, departments, rooms }) {
  const problems = [];
  const label = `Navigation graph "${graph._id}"`;
  const { routing = {} } = graph;
  if (!isValidResourceId(graph._id)) problems.push(`${label} needs a valid ID`);
  if (!['metresPerMapUnit', 'walkingMetresPerSecond', 'stairsMetresPerSecond'].every((key) => isPositiveNumber(routing[key]))) {
    problems.push(`${label} needs positive routing scale and speeds`);
  }

  const corridorsByFloor = new Map();
  const corridorIds = new Set();
  for (const corridor of graph.corridors ?? []) {
    const floor = floorsById.get(corridor.floorId);
    if (corridorIds.has(corridor.id)) problems.push(`Corridor "${corridor.id}" is duplicated`);
    corridorIds.add(corridor.id);
    if (!floor) {
      problems.push(`Corridor "${corridor.id}" references unknown floor "${corridor.floorId}"`);
      continue;
    }
    const rect = rectOf(corridor);
    if (![rect.x, rect.y].every(isNonNegativeNumber) || ![rect.width, rect.height].every(isPositiveNumber)) {
      problems.push(`Corridor "${corridor.id}" needs non-negative x/y and positive width/height`);
      continue;
    }
    if (rect.x + rect.width > floor.width || rect.y + rect.height > floor.height) {
      problems.push(`Corridor "${corridor.id}" extends outside floor "${floor._id}"`);
    }
    for (const room of rooms.filter((item) => item.floorId === corridor.floorId)) {
      if (overlaps(rect, roomRect(room))) problems.push(`Corridor "${corridor.id}" overlaps room "${room._id}"`);
    }
    corridorsByFloor.set(corridor.floorId, [...(corridorsByFloor.get(corridor.floorId) ?? []), rect]);
  }
  const inCorridor = (p, floorId) => (corridorsByFloor.get(floorId) ?? []).some((rect) => insideRect(p, rect));

  const nodesById = new Map();
  const doorByRoom = new Map();
  for (const node of graph.nodes ?? []) {
    if (nodesById.has(node.id)) problems.push(`Node "${node.id}" is duplicated`);
    nodesById.set(node.id, node);
    const floor = floorsById.get(node.floorId);
    if (!floor) {
      problems.push(`Node "${node.id}" references unknown floor "${node.floorId}"`);
      continue;
    }
    if (!insideRect(node, { x: 0, y: 0, width: floor.width, height: floor.height })) {
      problems.push(`Node "${node.id}" lies outside floor "${floor._id}"`);
    }
    if (node.kind === 'door') {
      const room = roomsById.get(node.roomId);
      if (!room) {
        problems.push(`Door "${node.id}" references unknown room "${node.roomId}"`);
      } else if (room.floorId !== node.floorId) {
        problems.push(`Door "${node.id}" is not on the floor of room "${room._id}"`);
      } else if (!onBoundary(node, roomRect(room))) {
        problems.push(`Door "${node.id}" is not on the outline of room "${room._id}"`);
      }
      if (doorByRoom.has(node.roomId)) problems.push(`Room "${node.roomId}" has more than one door node`);
      doorByRoom.set(node.roomId, node);
    } else if (node.kind === 'junction') {
      if (node.roomId || node.transition || node.entrance) problems.push(`Junction "${node.id}" has door-only fields`);
      if (!inCorridor(node, node.floorId)) problems.push(`Junction "${node.id}" is not inside a corridor`);
    } else {
      problems.push(`Node "${node.id}" has unknown kind "${node.kind}"`);
    }
  }

  const pairs = new Set();
  for (const edge of graph.edges ?? []) {
    const name = `Edge ${edge.from} → ${edge.to}`;
    const a = nodesById.get(edge.from);
    const b = nodesById.get(edge.to);
    if (!a || !b) {
      problems.push(`${name} references an unknown node`);
      continue;
    }
    const pair = [edge.from, edge.to].sort().join('|');
    if (edge.from === edge.to || pairs.has(pair)) problems.push(`${name} is a loop or a duplicate`);
    pairs.add(pair);

    if (edge.kind === 'lift' || edge.kind === 'stairs') {
      if (a.floorId === b.floorId) problems.push(`${name} (${edge.kind}) does not change floor`);
      if (a.transition !== edge.kind || b.transition !== edge.kind) {
        problems.push(`${name} (${edge.kind}) must join two ${edge.kind} doors`);
      }
      const levels = [a, b].map((node) => floorsById.get(node.floorId)?.level ?? 0);
      if (edge.kind === 'stairs' && (Math.abs(levels[0] - levels[1]) !== 1 || !isPositiveNumber(edge.metres))) {
        problems.push(`${name} (stairs) must join adjacent floors and have positive metres`);
      }
      if (edge.kind === 'lift' && !isPositiveNumber(edge.seconds)) problems.push(`${name} (lift) needs positive seconds`);
      continue;
    }

    if (a.floorId !== b.floorId) {
      problems.push(`${name} (${edge.kind}) joins different floors`);
      continue;
    }
    const points = samples(a, b);
    if (edge.kind === 'corridor') {
      if (a.kind !== 'junction' || b.kind !== 'junction') problems.push(`${name} (corridor) must join two junctions`);
      if (!points.every((p) => inCorridor(p, a.floorId))) problems.push(`${name} leaves the drawn corridors`);
    } else if (edge.kind === 'door') {
      const doorNode = a.kind === 'door' ? a : b;
      const other = doorNode === a ? b : a;
      if (doorNode.kind !== 'door' || other.kind !== 'junction') {
        problems.push(`${name} (door) must join a door to a junction`);
        continue;
      }
      const crossed = rooms.filter(
        (room) => room.floorId === a.floorId && room._id !== doorNode.roomId && points.some((p) => strictlyInside(p, roomRect(room))),
      );
      for (const room of crossed) problems.push(`${name} passes through room "${room._id}"`);
    } else {
      problems.push(`${name} has unknown kind "${edge.kind}"`);
    }
  }

  // Every room on a floor that has a walkable graph must be reachable, so the map and the
  // directions never disagree about which places exist.
  const mappedFloors = new Set((graph.nodes ?? []).map((node) => node.floorId));
  for (const room of rooms) {
    if (mappedFloors.has(room.floorId) && !doorByRoom.has(room._id)) {
      problems.push(`Room "${room._id}" is on a mapped floor but has no door node`);
    }
  }

  const doors = [...doorByRoom.values()];
  if (doors.length > 0) {
    const edges = graph.edges ?? [];
    const all = reachable(doors[0].id, edges, () => true);
    const noStairs = reachable(doors[0].id, edges, (edge) => edge.kind !== 'stairs');
    for (const node of doors) {
      if (!all.has(node.id)) problems.push(`Door "${node.id}" cannot be reached`);
      else if (!noStairs.has(node.id)) problems.push(`Door "${node.id}" can only be reached by stairs`);
    }
  }

  // A department whose rooms are on the map must have at least one navigable destination.
  for (const department of departments) {
    const own = rooms.filter((room) => room.departmentId === department._id && mappedFloors.has(room.floorId));
    if (own.length > 0 && !own.some((room) => doorByRoom.has(room._id))) {
      problems.push(`Department "${department._id}" has no room with a door on the walkable graph`);
    }
  }

  return problems;
}

// Checks the floor/department/room relationships that the map and room APIs rely on, and the
// walkable graph when one is given. Returns a list of problems; empty means consistent.
export function findHospitalDataProblems({ floors, departments, rooms, navigationGraphs = [] }) {
  const problems = [];

  checkIds(floors, 'Floor', problems);
  checkIds(departments, 'Department', problems);
  checkIds(rooms, 'Room', problems);

  const floorsById = new Map(floors.map((floor) => [floor._id, floor]));
  const departmentsById = new Map(departments.map((department) => [department._id, department]));
  const roomsById = new Map(rooms.map((room) => [room._id, room]));

  for (const floor of floors) {
    if (![floor.width, floor.height].every(isPositiveNumber)) {
      problems.push(`Floor "${floor._id}" needs a positive width and height`);
    }
  }

  const codes = new Set();
  for (const department of departments) {
    if (codes.has(department.code)) {
      problems.push(`Department code "${department.code}" is duplicated`);
    }
    codes.add(department.code);

    if (department.floor && !floorsById.has(department.floor)) {
      problems.push(`Department "${department._id}" references unknown floor "${department.floor}"`);
    }

    for (const roomId of department.roomIds ?? []) {
      const room = roomsById.get(roomId);
      if (!room) {
        problems.push(`Department "${department._id}" lists unknown room "${roomId}"`);
      } else if (room.departmentId && room.departmentId !== department._id) {
        problems.push(`Department "${department._id}" lists room "${roomId}" that belongs to "${room.departmentId}"`);
      }
    }
  }

  for (const room of rooms) {
    const floor = floorsById.get(room.floorId);
    if (!floor) {
      problems.push(`Room "${room._id}" references unknown floor "${room.floorId}"`);
    } else {
      checkRoomPlacement(room, floor, problems);
    }

    if (room.departmentId) {
      const department = departmentsById.get(room.departmentId);
      if (!department) {
        problems.push(`Room "${room._id}" references unknown department "${room.departmentId}"`);
      } else if (!(department.roomIds ?? []).includes(room._id)) {
        problems.push(`Room "${room._id}" is not listed in roomIds of department "${room.departmentId}"`);
      }
    }
  }

  for (const graph of navigationGraphs) {
    problems.push(...findNavigationGraphProblems(graph, { floorsById, roomsById, departments, rooms }));
  }

  return problems;
}

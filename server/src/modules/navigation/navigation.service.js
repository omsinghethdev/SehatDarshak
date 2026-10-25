import { Department } from '../departments/department.model.js';
import { Floor } from '../map/floor.model.js';
import { Room } from '../rooms/room.model.js';
import { HttpError, notFoundError, validationError } from '../../utils/httpError.js';
import { NavigationGraph } from './navigationGraph.model.js';
import {
  buildNavigationGraph,
  findRoute,
  floorWalkways,
  listNavigableLocations,
  resolveDepartmentDestination,
} from './routeEngine.js';

// A route that cannot be walked is reported with its own code, so clients can tell it apart
// from a missing location (NOT_FOUND) or a malformed request (VALIDATION_ERROR).
export const noRouteError = (message) => new HttpError(404, 'NO_ROUTE', message);

// Loads everything a navigation request needs in one round of parallel queries. Without a seeded
// graph, nothing is navigable: lists are empty and routes report NO_ROUTE.
async function loadGraph() {
  const [graphData, floors, rooms] = await Promise.all([
    NavigationGraph.findOne({ isActive: true }).sort({ _id: 1 }).lean(),
    Floor.find({ isActive: true }).select('displayName level').lean(),
    Room.find({ isActive: true }).select('name type departmentId floorId').lean(),
  ]);

  const graph = buildNavigationGraph(graphData ?? {}, {
    floors: floors.map((floor) => ({ id: floor._id, displayName: floor.displayName, level: floor.level ?? 0 })),
    rooms: rooms.map((room) => ({
      id: room._id,
      displayName: room.name,
      roomType: room.type,
      departmentId: room.departmentId ?? null,
      floorId: room.floorId,
    })),
  });
  return { graphData, graph };
}

const activeDepartments = async () =>
  (await Department.find({ isActive: true }).select('name code roomIds').lean()).map((department) => ({
    id: department._id,
    name: department.name,
    code: department.code,
    roomIds: department.roomIds ?? [],
  }));

export async function listDestinations({ query }) {
  const [{ graph }, departments] = await Promise.all([loadGraph(), query ? activeDepartments() : []]);
  return listNavigableLocations(graph, { departments, query });
}

export async function getDepartmentDestination(departmentId) {
  const [{ graph }, department] = await Promise.all([
    loadGraph(),
    Department.findOne({ _id: departmentId, isActive: true }).select('roomIds').lean(),
  ]);
  if (!department) {
    throw notFoundError('Department not found');
  }
  return resolveDepartmentDestination(graph, { id: department._id, roomIds: department.roomIds ?? [] });
}

export async function getFloorWalkways(floorId) {
  const { graphData, graph } = await loadGraph();
  if (!graph.floorById.has(floorId)) {
    throw notFoundError('Floor not found');
  }
  return floorWalkways(graphData, graph, floorId);
}

export async function getRoute({ from, to, avoidStairs }) {
  const { graph } = await loadGraph();
  const result = findRoute(graph, { from, to, avoidStairs });

  switch (result.error) {
    case undefined:
      return result.route;
    case 'unknown_location':
      throw notFoundError(`Location not found: ${result.field === 'from' ? 'starting point' : 'destination'}`);
    case 'same_location':
      throw validationError('to: Choose a destination different from the starting point', [
        { field: 'to', message: 'Must differ from from' },
      ]);
    case 'not_navigable':
      throw noRouteError(
        `The ${result.field === 'from' ? 'starting point' : 'destination'} is not connected to the walking map`,
      );
    default:
      throw noRouteError('No walking route connects these locations');
  }
}

import { mockError, requireMockUser, simulateLatency } from '../../lib/mockBackend';
import { API_ERROR_CODES } from '../../services/apiClient';
import { MOCK_DEPARTMENTS } from '../departments/mockDepartments';
import { DEMO_HOSPITAL } from './demoHospital.data';
import { MOCK_FLOOR_MAPS } from './mockFloorMaps';
import {
  buildNavigationGraph,
  findRoute,
  floorWalkways,
  listNavigableLocations,
  resolveDepartmentDestination,
} from './routeEngine';

/**
 * DEVELOPMENT-ONLY stand-in for the map endpoints. Same interface as apiNavigationService, and
 * the same route engine and demo hospital data as the server, so mock routes match the API's.
 */
const graph = buildNavigationGraph(DEMO_HOSPITAL, {
  floors: DEMO_HOSPITAL.floors,
  rooms: DEMO_HOSPITAL.rooms.map((room) => ({
    id: room.id,
    displayName: room.name,
    roomType: room.type,
    departmentId: room.departmentId ?? null,
    floorId: room.floorId,
  })),
});

export const mockNavigationService = {
  async listFloors() {
    await simulateLatency();
    requireMockUser();
    return MOCK_FLOOR_MAPS.map(({ id, displayName }) => ({ id, displayName }));
  },

  async getFloorMap(floorId) {
    await simulateLatency();
    requireMockUser();
    const floor = MOCK_FLOOR_MAPS.find((item) => item.id === floorId);
    if (!floor) throw mockError(API_ERROR_CODES.NOT_FOUND, 'Floor not found.');
    return structuredClone(floor);
  },

  async getWalkways(floorId) {
    await simulateLatency(150);
    requireMockUser();
    if (!graph.floorById.has(floorId)) throw mockError(API_ERROR_CODES.NOT_FOUND, 'Floor not found.');
    return floorWalkways(DEMO_HOSPITAL, graph, floorId);
  },

  async listDestinations({ query = '' } = {}) {
    await simulateLatency(150);
    requireMockUser();
    return listNavigableLocations(graph, { departments: MOCK_DEPARTMENTS, query: query.trim() });
  },

  async getDepartmentDestination(departmentId) {
    await simulateLatency(150);
    requireMockUser();
    const department = MOCK_DEPARTMENTS.find((item) => item.id === departmentId);
    if (!department) throw mockError(API_ERROR_CODES.NOT_FOUND, 'Department not found.');
    return resolveDepartmentDestination(graph, department);
  },

  async getRoute({ from, to, avoidStairs = false }) {
    await simulateLatency(250);
    requireMockUser();
    const result = findRoute(graph, { from, to, avoidStairs });
    if (result.route) return result.route;
    if (result.error === 'unknown_location') throw mockError(API_ERROR_CODES.NOT_FOUND, 'Location not found.');
    if (result.error === 'same_location') {
      throw mockError(API_ERROR_CODES.VALIDATION_ERROR, 'to: Choose a destination different from the starting point', [
        { field: 'to', message: 'Must differ from from' },
      ]);
    }
    throw mockError(API_ERROR_CODES.NO_ROUTE, 'No walking route connects these locations.');
  },
};

import { mockError, requireMockUser, simulateLatency } from '../../lib/mockBackend';
import { API_ERROR_CODES } from '../../services/apiClient';
import { MOCK_FLOOR_MAPS } from './mockFloorMaps';

/** DEVELOPMENT-ONLY stand-in for the map endpoints. Same interface as apiNavigationService. */
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
};

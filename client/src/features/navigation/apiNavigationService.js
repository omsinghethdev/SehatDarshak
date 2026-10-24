import { api } from '../../services/apiClient';

/** Map endpoints (docs/API_CONTRACT.md → Departments, rooms, and navigation map). */
export const apiNavigationService = {
  /** GET /api/map/floors — floors available to the 2D navigation UI. */
  async listFloors({ signal } = {}) {
    const { data } = await api.get('/map/floors', { signal });
    return data;
  },

  /** GET /api/map/floors/:floorId — one floor's map metadata and locations. */
  async getFloorMap(floorId, { signal } = {}) {
    const { data } = await api.get(`/map/floors/${encodeURIComponent(floorId)}`, { signal });
    return data;
  },
};

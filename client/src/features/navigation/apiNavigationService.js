import { api } from '../../services/apiClient';

const floorPath = (floorId) => `/map/floors/${encodeURIComponent(floorId)}`;

/** Map endpoints (docs/API_CONTRACT.md → Departments, rooms, and navigation map; Indoor directions). */
export const apiNavigationService = {
  /** GET /api/map/floors — floors available to the 2D navigation UI. */
  async listFloors({ signal } = {}) {
    const { data } = await api.get('/map/floors', { signal });
    return data;
  },

  /** GET /api/map/floors/:floorId — one floor's map metadata and locations. */
  async getFloorMap(floorId, { signal } = {}) {
    const { data } = await api.get(floorPath(floorId), { signal });
    return data;
  },

  /** GET /api/map/floors/:floorId/walkways — corridors and walkable connections on one floor. */
  async getWalkways(floorId, { signal } = {}) {
    const { data } = await api.get(`${floorPath(floorId)}/walkways`, { signal });
    return data;
  },

  /** GET /api/map/destinations?q= — rooms that can be a start or destination. */
  async listDestinations({ query, signal } = {}) {
    const search = query ? `?${new URLSearchParams({ q: query })}` : '';
    const { data } = await api.get(`/map/destinations${search}`, { signal });
    return data;
  },

  /** GET /api/map/departments/:departmentId/destination → { destination | null, alternatives } */
  async getDepartmentDestination(departmentId, { signal } = {}) {
    const { data } = await api.get(`/map/departments/${encodeURIComponent(departmentId)}/destination`, { signal });
    return data;
  },

  /** GET /api/map/route?from=&to=&avoidStairs= — NO_ROUTE (404) when no walkable route exists. */
  async getRoute({ from, to, avoidStairs = false }, { signal } = {}) {
    const query = new URLSearchParams({ from, to, avoidStairs: String(Boolean(avoidStairs)) });
    const { data } = await api.get(`/map/route?${query}`, { signal });
    return data;
  },
};

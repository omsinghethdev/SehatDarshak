import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { apiNavigationService } from './apiNavigationService';
import { mockNavigationService } from './mockNavigationService';

/**
 * Floor-map data for the UI. Both implementations share one interface:
 *   listFloors({ signal })           → Promise<Array<{ id, displayName }>>
 *   getFloorMap(floorId, { signal }) → Promise<FloorMap>
 *   getWalkways(floorId, { signal }) → Promise<{ floorId, corridors, nodes, edges, transitions }>
 *   listDestinations({ query, signal }) → Promise<Place[]>  (rooms on the walking graph)
 *   getDepartmentDestination(departmentId, { signal }) → Promise<{ departmentId, destination, alternatives }>
 *   getRoute({ from, to, avoidStairs }, { signal }) → Promise<Route>  (NO_ROUTE when none exists)
 */
export const navigationService = USE_MOCK_SERVICES ? mockNavigationService : apiNavigationService;

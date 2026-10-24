import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { apiNavigationService } from './apiNavigationService';
import { mockNavigationService } from './mockNavigationService';

/**
 * Floor-map data for the UI. Both implementations share one interface:
 *   listFloors({ signal })           → Promise<Array<{ id, displayName }>>
 *   getFloorMap(floorId, { signal }) → Promise<FloorMap>
 */
export const navigationService = USE_MOCK_SERVICES ? mockNavigationService : apiNavigationService;

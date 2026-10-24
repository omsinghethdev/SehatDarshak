import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { apiQueueService } from './apiQueueService';
import { mockQueueDemo, mockQueueService } from './mockQueueService';

/**
 * Patient queue-token service. Both implementations share one interface:
 *   listActiveTokens({ signal })        → Promise<QueueToken[]>
 *   createToken(departmentId)           → Promise<QueueToken>   (409 CONFLICT if already active)
 *   getToken(tokenId, { signal })       → Promise<QueueToken>
 *   getTokenStatus(tokenId, { signal }) → Promise<QueueTokenStatus>
 */
export const queueService = USE_MOCK_SERVICES ? mockQueueService : apiQueueService;

/** Demo-only simulation controls; `null` when connected to the real API. */
export const queueDemoControls = USE_MOCK_SERVICES ? mockQueueDemo : null;

/** How often an open token page polls for status updates. */
export const QUEUE_POLL_INTERVAL_MS = 15_000;

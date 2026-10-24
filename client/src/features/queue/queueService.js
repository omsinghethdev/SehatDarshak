import { readSession } from '../../services/authStorage';
import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { apiQueueService } from './apiQueueService';
import { apiStaffQueueService } from './apiStaffQueueService';
import { mockQueueDemo, mockQueueService, mockStaffQueueService } from './mockQueueService';

/**
 * Patient queue-token service. Both implementations share one interface:
 *   listActiveTokens({ signal })        → Promise<QueueToken[]>
 *   createToken(departmentId)           → Promise<QueueToken>   (409 CONFLICT if already active)
 *   getToken(tokenId, { signal })       → Promise<QueueToken>
 *   getTokenStatus(tokenId, { signal }) → Promise<QueueTokenStatus>
 */
export const queueService = USE_MOCK_SERVICES ? mockQueueService : apiQueueService;

/**
 * Staff/admin queue service (department-scoped on the server). Both implementations share:
 *   listDepartmentQueue(departmentId, { page, limit, signal }) → Promise<{ items, meta }>
 *   callNext(departmentId)                                    → Promise<{ id, displayNumber, status }>
 *   updateTokenStatus(tokenId, status)                        → Promise<{ id, status }>
 * Invalid transitions and a second `called` token are rejected with 409 CONFLICT.
 */
export const staffQueueService = USE_MOCK_SERVICES ? mockStaffQueueService : apiStaffQueueService;

/**
 * Look up one token for any signed-in role (GET /queue-tokens/:tokenId), e.g. from a token QR.
 * The server returns it only to the patient who owns it, staff of its department, and admins;
 * everyone else gets NOT_FOUND, so a token's existence is not revealed.
 *   getToken(tokenId, { signal }) → Promise<QueueToken>
 */
export const tokenLookupService = USE_MOCK_SERVICES
  ? {
      getToken: (tokenId, options) =>
        (readSession()?.user.role === 'patient' ? mockQueueService : mockStaffQueueService).getToken(tokenId, options),
    }
  : { getToken: (tokenId, options) => apiQueueService.getToken(tokenId, options) };

/** Demo-only simulation controls; `null` when connected to the real API. */
export const queueDemoControls = USE_MOCK_SERVICES ? mockQueueDemo : null;

/** How often an open token page polls for status updates. */
export const QUEUE_POLL_INTERVAL_MS = 15_000;

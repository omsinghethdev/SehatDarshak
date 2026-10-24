import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { apiAssistanceService } from './apiAssistanceService';
import { mockAssistanceDemo, mockAssistanceService } from './mockAssistanceService';

/**
 * Patient assistance requests. Both implementations share one interface:
 *   createRequest({ departmentId, location, message }) → Promise<AssistanceRequest>
 *   listMyRequests({ page, limit, signal })           → Promise<{ items, meta }>
 */
export const assistanceService = USE_MOCK_SERVICES ? mockAssistanceService : apiAssistanceService;

/** Demo-only simulation of a staff acknowledgement; `null` when connected to the real API. */
export const assistanceDemoControls = USE_MOCK_SERVICES ? mockAssistanceDemo : null;

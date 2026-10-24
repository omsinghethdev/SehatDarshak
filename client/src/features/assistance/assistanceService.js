import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { apiAssistanceService } from './apiAssistanceService';
import { apiStaffAssistanceService } from './apiStaffAssistanceService';
import { mockAssistanceDemo, mockAssistanceService, mockStaffAssistanceService } from './mockAssistanceService';

/**
 * Patient assistance requests. Both implementations share one interface:
 *   createRequest({ departmentId, location, message }) → Promise<AssistanceRequest>
 *   listMyRequests({ page, limit, signal })           → Promise<{ items, meta }>
 */
export const assistanceService = USE_MOCK_SERVICES ? mockAssistanceService : apiAssistanceService;

/**
 * Staff/admin assistance management (department-scoped on the server):
 *   listRequests({ status, page, limit, signal }) → Promise<{ items, meta }>
 *   acknowledge(requestId)                       → Promise<{ id, status }>  (409 if not open)
 */
export const staffAssistanceService = USE_MOCK_SERVICES ? mockStaffAssistanceService : apiStaffAssistanceService;

/** Demo-only simulation of a staff acknowledgement; `null` when connected to the real API. */
export const assistanceDemoControls = USE_MOCK_SERVICES ? mockAssistanceDemo : null;

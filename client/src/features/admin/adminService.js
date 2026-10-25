import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { apiAdminService } from './apiAdminService';
import { mockAdminService } from './mockAdminService';

/**
 * Admin management service. Mock mode uses the labelled, browser-only mock admin backend; API
 * mode calls the server. A failing API request throws — it never falls back to mock data.
 * `adminService.source` is `'api'` or `'mock'`; `capabilities` lists what the mock cannot show.
 */
export const adminService = USE_MOCK_SERVICES
  ? mockAdminService
  : { ...apiAdminService, capabilities: { queueStatusHistory: true, doctorAttribution: true } };

export const IS_MOCK_ADMIN = adminService.source === 'mock';

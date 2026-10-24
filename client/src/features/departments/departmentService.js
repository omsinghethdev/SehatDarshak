import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { apiDepartmentService } from './apiDepartmentService';
import { mockDepartmentService } from './mockDepartmentService';

/**
 * Department data for the UI. Both implementations share one interface:
 *   listDepartments({ signal })             → Promise<Department[]>
 *   getDepartment(departmentId, { signal }) → Promise<Department>
 */
export const departmentService = USE_MOCK_SERVICES ? mockDepartmentService : apiDepartmentService;

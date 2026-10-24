import { mockError, requireMockUser, simulateLatency } from '../../lib/mockBackend';
import { API_ERROR_CODES } from '../../services/apiClient';
import { MOCK_DEPARTMENTS, toPublicDepartment } from './mockDepartments';

/** DEVELOPMENT-ONLY stand-in for the department endpoints. Same interface as apiDepartmentService. */
export const mockDepartmentService = {
  async listDepartments() {
    await simulateLatency();
    requireMockUser();
    return MOCK_DEPARTMENTS.map(toPublicDepartment);
  },

  async getDepartment(departmentId) {
    await simulateLatency();
    requireMockUser();
    const department = MOCK_DEPARTMENTS.find((item) => item.id === departmentId);
    if (!department) throw mockError(API_ERROR_CODES.NOT_FOUND, 'Department not found.');
    return toPublicDepartment(department);
  },
};

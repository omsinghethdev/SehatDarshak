import { api } from '../../services/apiClient';

/** Department endpoints (docs/API_CONTRACT.md → Departments, rooms, and navigation map). */
export const apiDepartmentService = {
  /** GET /api/departments → active OPD departments. */
  async listDepartments({ signal } = {}) {
    const { data } = await api.get('/departments', { signal });
    return data;
  },

  /** GET /api/departments/:departmentId */
  async getDepartment(departmentId, { signal } = {}) {
    const { data } = await api.get(`/departments/${encodeURIComponent(departmentId)}`, { signal });
    return data;
  },
};

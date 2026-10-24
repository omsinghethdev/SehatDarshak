import { api } from '../../services/apiClient';

/** Staff/admin assistance endpoints (docs/API_CONTRACT.md → Assistance requests). */
export const apiStaffAssistanceService = {
  /** GET /api/assistance-requests?status=&page=&limit= → `{ items, meta }` (server scopes by department). */
  async listRequests({ status, page = 1, limit = 20, signal } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) query.set('status', status);
    const { data, meta } = await api.get(`/assistance-requests?${query}`, { signal });
    return { items: data, meta };
  },

  /** PATCH /api/assistance-requests/:requestId/acknowledge → `{ id, status }` */
  async acknowledge(requestId) {
    const { data } = await api.patch(`/assistance-requests/${encodeURIComponent(requestId)}/acknowledge`, {});
    return data;
  },
};

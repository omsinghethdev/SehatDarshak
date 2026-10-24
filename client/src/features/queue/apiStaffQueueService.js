import { api } from '../../services/apiClient';

/** Staff/admin queue endpoints (docs/API_CONTRACT.md → Queue tokens, Staff queue actions). */
export const apiStaffQueueService = {
  /** GET /api/queues/:departmentId?page=&limit= → `{ items, meta }` */
  async listDepartmentQueue(departmentId, { page = 1, limit = 100, signal } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    const { data, meta } = await api.get(`/queues/${encodeURIComponent(departmentId)}?${query}`, { signal });
    return { items: data, meta };
  },

  /** POST /api/queues/:departmentId/call-next → `{ id, displayNumber, status }` */
  async callNext(departmentId) {
    const { data } = await api.post(`/queues/${encodeURIComponent(departmentId)}/call-next`, {});
    return data;
  },

  /** PATCH /api/queue-tokens/:tokenId/status → `{ id, status }` */
  async updateTokenStatus(tokenId, status) {
    const { data } = await api.patch(`/queue-tokens/${encodeURIComponent(tokenId)}/status`, { status });
    return data;
  },
};

import { api } from '../../services/apiClient';

/** Patient assistance-request endpoints (docs/API_CONTRACT.md → Assistance requests). */
export const apiAssistanceService = {
  /** POST /api/assistance-requests — the server derives the patient from the JWT. */
  async createRequest({ departmentId, location, message }) {
    const { data } = await api.post('/assistance-requests', { departmentId, location, message });
    return data;
  },

  /** GET /api/assistance-requests/me?page=&limit= → `{ items, meta: { page, limit, total } }` */
  async listMyRequests({ page = 1, limit = 10, signal } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    const { data, meta } = await api.get(`/assistance-requests/me?${query}`, { signal });
    return { items: data, meta };
  },
};

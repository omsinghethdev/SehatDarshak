import { api } from '../../services/apiClient';

const tokenPath = (tokenId) => `/queue-tokens/${encodeURIComponent(tokenId)}`;

/** Patient queue-token endpoints (docs/API_CONTRACT.md → Queue tokens, patient profile). */
export const apiQueueService = {
  /** GET /api/patients/me/queue-tokens/active */
  async listActiveTokens({ signal } = {}) {
    const { data } = await api.get('/patients/me/queue-tokens/active', { signal });
    return data;
  },

  /**
   * GET /api/patients/me/queue-tokens?status=&page=&limit= — the patient's own completed,
   * skipped, and cancelled tokens, newest first → `{ items, meta: { page, limit, total } }`.
   */
  async listTokenHistory({ status, page = 1, limit = 10, signal } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) query.set('status', status);
    const { data, meta } = await api.get(`/patients/me/queue-tokens?${query}`, { signal });
    return { items: data, meta };
  },

  /** POST /api/queue-tokens — the server derives the patient from the JWT. */
  async createToken(departmentId) {
    const { data } = await api.post('/queue-tokens', { departmentId });
    return data;
  },

  /** GET /api/queue-tokens/:tokenId */
  async getToken(tokenId, { signal } = {}) {
    const { data } = await api.get(tokenPath(tokenId), { signal });
    return data;
  },

  /**
   * POST /api/queue-tokens/:tokenId/cancel — withdraw the patient's own waiting token. The server
   * checks ownership and status atomically; 409 CONFLICT if the token is no longer waiting.
   */
  async cancelToken(tokenId) {
    const { data } = await api.post(`${tokenPath(tokenId)}/cancel`, {});
    return data;
  },

  /** GET /api/queue-tokens/:tokenId/status — patient-safe status for polling. */
  async getTokenStatus(tokenId, { signal } = {}) {
    const { data } = await api.get(`${tokenPath(tokenId)}/status`, { signal });
    return data;
  },
};

import { api } from '../../services/apiClient';

const tokenPath = (tokenId) => `/queue-tokens/${encodeURIComponent(tokenId)}`;

/** Patient queue-token endpoints (docs/API_CONTRACT.md → Queue tokens, patient profile). */
export const apiQueueService = {
  /** GET /api/patients/me/queue-tokens/active */
  async listActiveTokens({ signal } = {}) {
    const { data } = await api.get('/patients/me/queue-tokens/active', { signal });
    return data;
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

  /** GET /api/queue-tokens/:tokenId/status — patient-safe status for polling. */
  async getTokenStatus(tokenId, { signal } = {}) {
    const { data } = await api.get(`${tokenPath(tokenId)}/status`, { signal });
    return data;
  },
};

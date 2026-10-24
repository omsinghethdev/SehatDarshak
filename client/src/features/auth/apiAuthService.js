import { api } from '../../services/apiClient';

/**
 * Real authentication against the backend (docs/API_CONTRACT.md → Authentication).
 * Both calls resolve to `{ accessToken, user }` or throw an `ApiError`.
 */
export const apiAuthService = {
  async login({ identifier, password }) {
    const { data } = await api.post('/auth/login', { identifier, password }, { auth: false });
    return data;
  },

  async register({ name, identifier, password }) {
    const { data } = await api.post('/auth/register', { name, identifier, password }, { auth: false });
    return data;
  },

  // The demo-patient shortcut exists only in mock mode.
  loginAsDemoPatient: null,
};

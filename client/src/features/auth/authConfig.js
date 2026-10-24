export const AUTH_MODES = Object.freeze({ API: 'api', MOCK: 'mock' });

const requestedMode = (import.meta.env.VITE_AUTH_MODE ?? '').trim().toLowerCase();

if (requestedMode && !Object.values(AUTH_MODES).includes(requestedMode)) {
  console.warn(`Unknown VITE_AUTH_MODE "${requestedMode}". Falling back to "${AUTH_MODES.API}".`);
}

/**
 * Mock authentication is opt-in only (`VITE_AUTH_MODE=mock`). Anything else uses the real API,
 * so the app never falls back to mock sign-in silently.
 */
export const AUTH_MODE = requestedMode === AUTH_MODES.MOCK ? AUTH_MODES.MOCK : AUTH_MODES.API;

export const IS_MOCK_AUTH = AUTH_MODE === AUTH_MODES.MOCK;

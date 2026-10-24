import { IS_MOCK_AUTH } from '../features/auth/authConfig';

/**
 * Data services (departments, queue tokens) follow the auth mode set by VITE_AUTH_MODE:
 * a mock session's token cannot authenticate against the real API, and real sessions must
 * never be served mock data. Services are chosen once at startup; a failing real request
 * is reported as an error and never falls back to mock data.
 */
export const USE_MOCK_SERVICES = IS_MOCK_AUTH;

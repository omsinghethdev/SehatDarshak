import { apiAuthService } from './apiAuthService';
import { IS_MOCK_AUTH } from './authConfig';
import { mockAuthService } from './mockAuthService';

/**
 * The single auth service used by the app. Both implementations share one interface:
 *   login({ identifier, password })        → Promise<{ accessToken, user }>
 *   register({ name, identifier, password }) → Promise<{ accessToken, user }>
 *   demoAccounts / loginAsDemoAccount(key) → simulated accounts in mock mode, otherwise null
 *   demoRegistrationKinds / registerDemoAccount(kind, details) → development-only staff/admin
 *     account creation in mock mode, otherwise [] / null (the API only registers patients)
 * Errors are always `ApiError`s using the contract's error codes.
 *
 * Switch with VITE_AUTH_MODE ("api" or "mock"); see authConfig.js.
 */
export const authService = IS_MOCK_AUTH ? mockAuthService : apiAuthService;

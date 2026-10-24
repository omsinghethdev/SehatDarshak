import { API_ERROR_CODES, ApiError } from '../../services/apiClient';
import { MOCK_DEMO_ACCOUNTS } from './mockDemoAccounts';
import { toErrorDetails, validateLogin, validateRegistration } from './validation';

/*
 * DEVELOPMENT-ONLY mock authentication.
 *
 * Accounts live in this browser's localStorage, and "access tokens" are random strings that
 * no server will accept. This is NOT secure and must never hold real patient data. It mimics
 * the request/response shapes and error codes of docs/API_CONTRACT.md so the forms work
 * unchanged against the real API (see authService.js).
 */

const ACCOUNTS_STORAGE_KEY = 'sehatdarsak.mockAccounts';
const SIMULATED_LATENCY_MS = 500;

/** Usernames reserved by the simulated demo accounts (which have no passwords). */
const RESERVED_IDENTIFIERS = new Set(MOCK_DEMO_ACCOUNTS.map((account) => account.identifier));

function wait() {
  return new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
}

function readAccounts() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCOUNTS_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts) {
  try {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    throw new ApiError({
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Demo accounts could not be saved in this browser.',
      status: 500,
    });
  }
}

function requireWebCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.randomUUID) {
    throw new ApiError({
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Demo sign-in needs a secure browser context (https or localhost).',
      status: 500,
    });
  }
}

/** Avoids storing plain-text passwords in the browser. A fast hash is fine for demo data only. */
async function digestPassword(identifier, password) {
  const bytes = new TextEncoder().encode(`sehatdarsak-mock:${identifier}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toPublicUser({ id, name, role }) {
  return { id, name, role };
}

function issueSession(account) {
  return { accessToken: `mock.${crypto.randomUUID()}`, user: toPublicUser(account) };
}

function validationError(errors) {
  return new ApiError({
    code: API_ERROR_CODES.VALIDATION_ERROR,
    message: 'Some details need attention.',
    status: 400,
    details: toErrorDetails(errors),
  });
}

export const mockAuthService = {
  async login({ identifier, password }) {
    requireWebCrypto();
    await wait();

    const errors = validateLogin({ identifier, password });
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const account = readAccounts().find((item) => item.identifier === identifier);
    const digest = await digestPassword(identifier, password);

    if (!account || account.passwordDigest !== digest) {
      throw new ApiError({
        code: API_ERROR_CODES.UNAUTHORIZED,
        message: 'Incorrect username or password.',
        status: 401,
      });
    }
    return issueSession(account);
  },

  async register({ name, identifier, password }) {
    requireWebCrypto();
    await wait();

    const errors = validateRegistration({ name, identifier, password });
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const accounts = readAccounts();
    if (RESERVED_IDENTIFIERS.has(identifier) || accounts.some((item) => item.identifier === identifier)) {
      throw new ApiError({
        code: API_ERROR_CODES.CONFLICT,
        message: 'That username is already taken. Please choose a different one.',
        status: 409,
        details: [{ field: 'identifier', message: 'This username is already taken.' }],
      });
    }

    // Public registration always creates a patient (docs/API_CONTRACT.md).
    const account = {
      id: `mock_user_${crypto.randomUUID()}`,
      name: name.trim(),
      identifier,
      role: 'patient',
      passwordDigest: await digestPassword(identifier, password),
    };
    writeAccounts([...accounts, account]);
    return issueSession(account);
  },

  /** Simulated demo accounts offered on the sign-in page (mock mode only). */
  demoAccounts: MOCK_DEMO_ACCOUNTS.map(({ key, buttonLabel, description }) => ({ key, buttonLabel, description })),

  /** Sign in as one of the simulated demo accounts, without a password. */
  async loginAsDemoAccount(key) {
    requireWebCrypto();
    await wait();
    const account = MOCK_DEMO_ACCOUNTS.find((item) => item.key === key);
    if (!account) {
      throw new ApiError({ code: API_ERROR_CODES.NOT_FOUND, message: 'Demo account not found.', status: 404 });
    }
    return issueSession(account.user);
  },
};

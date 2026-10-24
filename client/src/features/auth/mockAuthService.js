import { API_ERROR_CODES, ApiError } from '../../services/apiClient';
import { ACCOUNT_TYPES } from './accountTypes';
import { accountType, readMockAccounts, writeMockAccounts } from './mockAccountStore';
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

const SIMULATED_LATENCY_MS = 500;

/**
 * Staff and administrator accounts can be created only in mock mode, as fictional demo accounts.
 * Administrator creation is further limited to development builds (`npm run dev`), so a deployed
 * demo cannot be used to create administrators; it offers the seeded demo administrator instead.
 */
const DEMO_REGISTRATION_KINDS = Object.freeze([
  'staff_opd',
  'staff_med',
  ...(import.meta.env.DEV ? ['admin'] : []),
]);

/** Usernames reserved by the simulated demo accounts (which have no passwords). */
const RESERVED_IDENTIFIERS = new Set(MOCK_DEMO_ACCOUNTS.map((account) => account.identifier));

function wait() {
  return new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
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

function issueSession({ id, name, role }) {
  return { accessToken: `mock.${crypto.randomUUID()}`, user: { id, name, role } };
}

function validationError(errors) {
  return new ApiError({
    code: API_ERROR_CODES.VALIDATION_ERROR,
    message: 'Some details need attention.',
    status: 400,
    details: toErrorDetails(errors),
  });
}

async function createAccount(kind, { name, identifier, password }) {
  requireWebCrypto();
  await wait();

  const errors = validateRegistration({ name, identifier, password });
  if (Object.keys(errors).length > 0) throw validationError(errors);

  const accounts = readMockAccounts();
  if (RESERVED_IDENTIFIERS.has(identifier) || accounts.some((item) => item.identifier === identifier)) {
    throw new ApiError({
      code: API_ERROR_CODES.CONFLICT,
      message: 'That username is already taken. Please choose a different one.',
      status: 409,
      details: [{ field: 'identifier', message: 'This username is already taken.' }],
    });
  }

  const account = {
    id: `mock_user_${crypto.randomUUID()}`,
    name: name.trim(),
    identifier,
    kind,
    passwordDigest: await digestPassword(identifier, password),
  };
  writeMockAccounts([...accounts, account]);
  return issueSession({ ...account, role: ACCOUNT_TYPES[kind].role });
}

export const mockAuthService = {
  async login({ identifier, password }) {
    requireWebCrypto();
    await wait();

    const errors = validateLogin({ identifier, password });
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const account = readMockAccounts().find((item) => item.identifier === identifier);
    const digest = await digestPassword(identifier, password);
    // The role comes from the account's category, not from any stored role field.
    const type = account && accountType(account);

    if (!account || !type || account.passwordDigest !== digest) {
      throw new ApiError({
        code: API_ERROR_CODES.UNAUTHORIZED,
        message: 'Incorrect username or password.',
        status: 401,
      });
    }
    return issueSession({ ...account, role: type.role });
  },

  /** Public registration always creates a patient (docs/API_CONTRACT.md). */
  async register({ name, identifier, password }) {
    return createAccount('patient', { name, identifier, password });
  },

  /** Categories that `registerDemoAccount` accepts in this build. */
  demoRegistrationKinds: DEMO_REGISTRATION_KINDS,

  /**
   * DEVELOPMENT-ONLY: create a fictional staff or administrator account in this browser. The role
   * and department are taken from ACCOUNT_TYPES for the chosen category, so they cannot be set
   * through the form. Not part of the API; nothing is created on a hospital server.
   */
  async registerDemoAccount(kind, { name, identifier, password }) {
    if (!DEMO_REGISTRATION_KINDS.includes(kind)) {
      throw new ApiError({
        code: API_ERROR_CODES.FORBIDDEN,
        message: 'This kind of account cannot be created here.',
        status: 403,
      });
    }
    return createAccount(kind, { name, identifier, password });
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

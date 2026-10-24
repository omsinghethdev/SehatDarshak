import { API_ERROR_CODES, ApiError } from '../services/apiClient';
import { readSession } from '../services/authStorage';

/*
 * Shared helpers for DEVELOPMENT-ONLY mock services. They imitate the server's behaviour
 * described in docs/API_CONTRACT.md (authentication, role checks, error envelopes) so UI
 * code can switch to the real API without changes. Nothing here is secure.
 */

export function simulateLatency(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function readStore(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw mockError(API_ERROR_CODES.INTERNAL_ERROR, 'Demo data could not be saved in this browser.');
  }
}

const STATUS_BY_CODE = {
  [API_ERROR_CODES.VALIDATION_ERROR]: 400,
  [API_ERROR_CODES.UNAUTHORIZED]: 401,
  [API_ERROR_CODES.FORBIDDEN]: 403,
  [API_ERROR_CODES.NOT_FOUND]: 404,
  [API_ERROR_CODES.CONFLICT]: 409,
  [API_ERROR_CODES.INTERNAL_ERROR]: 500,
};

export function mockError(code, message, details) {
  return new ApiError({ code, message, status: STATUS_BY_CODE[code], details });
}

/**
 * The mock equivalent of verifying the Bearer token: returns the signed-in mock user or
 * throws UNAUTHORIZED / FORBIDDEN, as the server would.
 */
export function requireMockUser(allowedRoles) {
  const session = readSession();
  if (!session || session.source !== 'mock') {
    throw mockError(API_ERROR_CODES.UNAUTHORIZED, 'Please sign in to continue.');
  }
  if (allowedRoles && !allowedRoles.includes(session.user.role)) {
    throw mockError(API_ERROR_CODES.FORBIDDEN, 'You do not have access to this.');
  }
  return session.user;
}

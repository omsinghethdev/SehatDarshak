import { getAccessToken } from './authStorage';

/** Error codes defined by docs/API_CONTRACT.md. */
export const API_ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // Indoor directions: no walkable route between two valid locations (GET /api/map/route).
  NO_ROUTE: 'NO_ROUTE',
});

/**
 * Client-side failure codes. These never come from the server; they describe
 * problems reaching it or reading its response.
 */
export const CLIENT_ERROR_CODES = Object.freeze({
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
});

const STATUS_TO_CODE = {
  400: API_ERROR_CODES.VALIDATION_ERROR,
  401: API_ERROR_CODES.UNAUTHORIZED,
  403: API_ERROR_CODES.FORBIDDEN,
  404: API_ERROR_CODES.NOT_FOUND,
  409: API_ERROR_CODES.CONFLICT,
};

export class ApiError extends Error {
  constructor({ code, message, status = 0, details }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = Array.isArray(details) ? details : undefined;
  }
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');

let unauthorizedHandler = null;

/**
 * Register a callback for `UNAUTHORIZED` responses to authenticated requests
 * (used by the auth provider to clear the local session). Returns an unsubscribe function.
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

function buildUrl(path) {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Send a JSON request to the Sehat Darshak API.
 *
 * @param {string} path Path relative to VITE_API_BASE_URL, e.g. `/auth/me`.
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {unknown} [options.body] Serialized as JSON when provided.
 * @param {boolean} [options.auth=true] Attach the stored Bearer token when available.
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ data: unknown, message?: string, meta?: object }>}
 * @throws {ApiError}
 */
export async function apiRequest(path, { method = 'GET', body, auth = true, signal } = {}) {
  if (!BASE_URL) {
    throw new ApiError({
      code: CLIENT_ERROR_CODES.CONFIG_ERROR,
      message: 'The service address is not configured.',
    });
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = auth ? getAccessToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError({
      code: CLIENT_ERROR_CODES.NETWORK_ERROR,
      message: 'Unable to reach the service. Check your connection and try again.',
    });
  }

  if (response.status === 204) return { data: null };

  const payload = await parseJson(response);

  if (!response.ok) {
    const serverError = payload?.error;
    const error = new ApiError({
      code:
        serverError?.code ??
        STATUS_TO_CODE[response.status] ??
        API_ERROR_CODES.INTERNAL_ERROR,
      message: serverError?.message ?? 'The request could not be completed.',
      status: response.status,
      details: serverError?.details,
    });

    if (error.code === API_ERROR_CODES.UNAUTHORIZED && token && unauthorizedHandler) {
      unauthorizedHandler(error);
    }
    throw error;
  }

  if (!payload || typeof payload !== 'object' || !('data' in payload)) {
    throw new ApiError({
      code: CLIENT_ERROR_CODES.INVALID_RESPONSE,
      message: 'The service returned an unexpected response.',
      status: response.status,
    });
  }

  return { data: payload.data, message: payload.message, meta: payload.meta };
}

export const api = {
  get: (path, options) => apiRequest(path, { ...options, method: 'GET' }),
  post: (path, body = {}, options) => apiRequest(path, { ...options, method: 'POST', body }),
  patch: (path, body = {}, options) => apiRequest(path, { ...options, method: 'PATCH', body }),
};

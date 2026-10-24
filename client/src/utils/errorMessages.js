import { API_ERROR_CODES, CLIENT_ERROR_CODES } from '../services/apiClient';

const CONTENT = {
  [API_ERROR_CODES.VALIDATION_ERROR]: {
    title: 'Please check the details you entered',
    useServerMessage: true,
  },
  [API_ERROR_CODES.UNAUTHORIZED]: {
    title: 'Please sign in to continue',
    description: 'Your session may have ended. Sign in again to continue.',
  },
  [API_ERROR_CODES.FORBIDDEN]: {
    title: 'You do not have access to this',
    description: 'Your account is not permitted to view or change this information.',
  },
  [API_ERROR_CODES.NOT_FOUND]: {
    title: 'We could not find that',
    description: 'It may have been removed, or the link may be incorrect.',
  },
  [API_ERROR_CODES.CONFLICT]: {
    title: 'This action could not be completed',
    useServerMessage: true,
  },
  [API_ERROR_CODES.INTERNAL_ERROR]: {
    title: 'Something went wrong on our side',
    description: 'Please try again in a moment.',
  },
  [CLIENT_ERROR_CODES.NETWORK_ERROR]: {
    title: 'Unable to connect',
    description: 'Check your internet connection and try again.',
  },
  [CLIENT_ERROR_CODES.CONFIG_ERROR]: {
    title: 'Service unavailable',
    description: 'The application is not connected to the hospital service yet.',
  },
  [CLIENT_ERROR_CODES.INVALID_RESPONSE]: {
    title: 'Something went wrong',
    description: 'The service returned an unexpected response. Please try again.',
  },
};

const FALLBACK = {
  title: 'Something went wrong',
  description: 'Please try again in a moment.',
};

/**
 * Map an error to plain-language UI text. Server messages are shown only for
 * validation and conflict errors, where they are actionable; internal details are never shown.
 */
export function getErrorContent(error) {
  const entry = CONTENT[error?.code];
  if (!entry) return FALLBACK;

  if (entry.useServerMessage) {
    return {
      title: entry.title,
      description: error.message || FALLBACK.description,
      details: error.details,
    };
  }
  return { title: entry.title, description: entry.description };
}

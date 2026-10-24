import { HttpError } from '../utils/httpError.js';

const bodyErrorMessages = {
  'entity.too.large': 'Request body is too large',
  'charset.unsupported': 'Unsupported request body charset',
  'encoding.unsupported': 'Unsupported request body encoding',
};

function sendError(response, status, code, message, details) {
  response.status(status).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

export function notFoundHandler(_request, response) {
  sendError(response, 404, 'NOT_FOUND', 'Route not found');
}

export function errorHandler(error, _request, response, next) {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    if (error.retryAfterSeconds) {
      response.set('Retry-After', String(error.retryAfterSeconds));
    }
    sendError(response, error.status, error.code, error.message, error.details);
    return;
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    sendError(response, 400, 'VALIDATION_ERROR', 'Malformed JSON request body');
    return;
  }

  // Other client errors raised by Express or express.json (oversized or undecodable
  // bodies, malformed URL encoding, ...) carry a 4xx status. The contract maps client
  // validation problems to 400 VALIDATION_ERROR, so 413/415 statuses are not passed through.
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    const message = error instanceof URIError
      ? 'Malformed URL encoding'
      : bodyErrorMessages[error.type] ?? 'Invalid request body';
    sendError(response, 400, 'VALIDATION_ERROR', message);
    return;
  }

  sendError(response, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

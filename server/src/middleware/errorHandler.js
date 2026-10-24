import { HttpError } from '../utils/httpError.js';

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
    sendError(response, error.status, error.code, error.message, error.details);
    return;
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    sendError(response, 400, 'VALIDATION_ERROR', 'Malformed JSON request body');
    return;
  }

  sendError(response, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

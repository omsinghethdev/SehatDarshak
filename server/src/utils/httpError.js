export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const validationError = (message, details) => new HttpError(400, 'VALIDATION_ERROR', message, details);
export const unauthorizedError = (message = 'Authentication required') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbiddenError = (message = 'You do not have permission to perform this action') => new HttpError(403, 'FORBIDDEN', message);
export const conflictError = (message) => new HttpError(409, 'CONFLICT', message);

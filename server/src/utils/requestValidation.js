import { validationError } from './httpError.js';

// Resource IDs are stable strings such as "dept_demo_opd" (see docs/SHARED_INTEGRATION_CONTRACT.md).
const resourceIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

const defaultPage = 1;
const defaultLimit = 20;
const maxLimit = 100;

function fieldError(field, message) {
  return validationError(`${field}: ${message}`, [{ field, message }]);
}

// Requires a JSON object body and rejects fields outside allowedFields, so clients cannot
// smuggle server-controlled values such as patientId or status.
export function parseObjectBody(body, allowedFields) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Request body must be a JSON object');
  }

  const unknownField = Object.keys(body).find((field) => !allowedFields.includes(field));
  if (unknownField) {
    throw fieldError(unknownField, 'Field is not allowed');
  }

  return body;
}

export function parseEnumValue(value, field, allowedValues) {
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw fieldError(field, `Must be one of: ${allowedValues.join(', ')}`);
  }

  return value;
}

export function isValidResourceId(value) {
  return typeof value === 'string' && resourceIdPattern.test(value);
}

export function parseResourceId(value, field) {
  if (!isValidResourceId(value)) {
    throw fieldError(field, 'Must be a valid ID');
  }

  return value;
}

// Empty query values (e.g. "?floor=&page=") are treated as omitted, matching the
// documented "?floor=&departmentId=&page=&limit=" form.
const isOmitted = (value) => value === undefined || value === '';

export function parseOptionalResourceId(value, field) {
  return isOmitted(value) ? undefined : parseResourceId(value, field);
}

function parsePositiveInteger(value, field, fallback, max) {
  if (isOmitted(value)) {
    return fallback;
  }

  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < 1 || number > max) {
    throw fieldError(field, `Must be an integer from 1 to ${max}`);
  }

  return number;
}

export function parsePagination(query) {
  const page = parsePositiveInteger(query.page, 'page', defaultPage, Number.MAX_SAFE_INTEGER);
  const limit = parsePositiveInteger(query.limit, 'limit', defaultLimit, maxLimit);

  return { page, limit, skip: (page - 1) * limit };
}

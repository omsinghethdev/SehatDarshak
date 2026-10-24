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

// Returns the trimmed string; rejects non-strings, blank text, and over-long text.
export function parseRequiredText(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw fieldError(field, 'Required');
  }
  if (text.length > maxLength) {
    throw fieldError(field, `Must be at most ${maxLength} characters`);
  }

  return text;
}

export function parseOptionalEnumValue(value, field, allowedValues) {
  return isOmitted(value) ? undefined : parseEnumValue(value, field, allowedValues);
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

// Query flags such as "?isActive=true"; only the exact strings "true" and "false" are accepted.
export function parseOptionalBooleanQuery(value, field) {
  if (isOmitted(value)) {
    return undefined;
  }
  if (value !== 'true' && value !== 'false') {
    throw fieldError(field, 'Must be true or false');
  }
  return value === 'true';
}

// Request-body booleans must be real JSON booleans, not strings.
export function parseBoolean(value, field) {
  if (typeof value !== 'boolean') {
    throw fieldError(field, 'Must be true or false');
  }
  return value;
}

const objectIdPattern = /^[a-f0-9]{24}$/i;

// User IDs are MongoDB ObjectIds (24 hexadecimal characters).
export function parseUserId(value, field) {
  if (typeof value !== 'string' || !objectIdPattern.test(value)) {
    throw fieldError(field, 'Must be a valid user ID');
  }
  return value.toLowerCase();
}

export function parseOptionalUserId(value, field) {
  return isOmitted(value) ? undefined : parseUserId(value, field);
}

// Optional body text. `undefined` means "not provided". With `nullable`, null or blank text means
// "clear this value" and returns null.
export function parseOptionalText(value, field, maxLength, { nullable = false, pattern, patternMessage } = {}) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || (typeof value === 'string' && !value.trim())) {
    if (nullable) {
      return null;
    }
    throw fieldError(field, 'Required');
  }
  if (typeof value !== 'string') {
    throw fieldError(field, 'Must be text');
  }

  const text = value.trim();
  if (text.length > maxLength) {
    throw fieldError(field, `Must be at most ${maxLength} characters`);
  }
  if (pattern && !pattern.test(text)) {
    throw fieldError(field, patternMessage ?? 'Has an invalid format');
  }
  return text;
}

// A resource ID that may be set to null to remove an assignment.
export function parseNullableResourceId(value, field) {
  if (value === undefined) {
    return undefined;
  }
  return value === null ? null : parseResourceId(value, field);
}

const searchMaxLength = 100;

// Free-text search (`q`). Returned as a literal-match regular expression source, so characters
// such as "." or "(" in a search never act as regex operators.
export function parseOptionalSearch(value, field = 'q') {
  if (isOmitted(value)) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw fieldError(field, 'Must be text');
  }
  const text = value.trim();
  if (!text) {
    return undefined;
  }
  if (text.length > searchMaxLength) {
    throw fieldError(field, `Must be at most ${searchMaxLength} characters`);
  }
  return text;
}

export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

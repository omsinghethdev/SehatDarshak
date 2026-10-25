import { supportedLanguages } from '../../config/languages.js';
import { validationError } from '../../utils/httpError.js';

const registerFields = ['name', 'identifier', 'password', 'preferredLanguage'];
const loginFields = ['identifier', 'password'];

const identifierPattern = /^[a-z0-9._-]{3,30}$/;
const nameMaxLength = 100;
const passwordMinLength = 8;
const passwordMaxLength = 128;

// Field rules shared by public registration and admin-created staff accounts. Each pushes
// problems onto `details` and returns the normalized value.
export function checkName(value, details) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) {
    details.push({ field: 'name', message: 'Required' });
  } else if (name.length > nameMaxLength) {
    details.push({ field: 'name', message: `Must be at most ${nameMaxLength} characters` });
  }
  return name;
}

export function checkIdentifier(value, details) {
  const identifier = normalizeIdentifier(value);
  if (typeof identifier !== 'string' || !identifier) {
    details.push({ field: 'identifier', message: 'Required' });
  } else if (!identifierPattern.test(identifier)) {
    details.push({
      field: 'identifier',
      message: 'Must be 3-30 characters using letters, numbers, dots, hyphens, or underscores',
    });
  }
  return identifier;
}

export function checkNewPassword(password, details, field = 'password') {
  if (typeof password !== 'string' || !password) {
    details.push({ field, message: 'Required' });
  } else if (password.length < passwordMinLength) {
    details.push({ field, message: `Must be at least ${passwordMinLength} characters` });
  } else if (password.length > passwordMaxLength) {
    details.push({ field, message: `Must be at most ${passwordMaxLength} characters` });
  }
  return password;
}

export function requireObjectBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Request body must be a JSON object');
  }
}

// Unknown fields are rejected so clients cannot submit role, department, or ID values.
export function collectUnknownFields(body, allowedFields, details) {
  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      details.push({ field, message: 'Field is not allowed' });
    }
  }
}

export function throwIfInvalid(details) {
  if (details.length > 0) {
    const [first] = details;
    throw validationError(`${first.field}: ${first.message}`, details);
  }
}

function normalizeIdentifier(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export function validateRegisterInput(body) {
  requireObjectBody(body);

  const details = [];
  collectUnknownFields(body, registerFields, details);

  const name = checkName(body.name, details);
  const identifier = checkIdentifier(body.identifier, details);
  const password = checkNewPassword(body.password, details);

  const { preferredLanguage } = body;
  if (preferredLanguage !== undefined && !supportedLanguages.includes(preferredLanguage)) {
    details.push({ field: 'preferredLanguage', message: `Must be one of: ${supportedLanguages.join(', ')}` });
  }

  throwIfInvalid(details);

  return {
    name,
    identifier,
    password,
    ...(preferredLanguage ? { preferredLanguage } : {}),
  };
}

export function validateLoginInput(body) {
  requireObjectBody(body);

  const details = [];
  collectUnknownFields(body, loginFields, details);

  const identifier = normalizeIdentifier(body.identifier);
  if (typeof identifier !== 'string' || !identifier) {
    details.push({ field: 'identifier', message: 'Required' });
  }

  const { password } = body;
  if (typeof password !== 'string' || !password) {
    details.push({ field: 'password', message: 'Required' });
  } else if (password.length > passwordMaxLength) {
    details.push({ field: 'password', message: `Must be at most ${passwordMaxLength} characters` });
  }

  throwIfInvalid(details);

  return { identifier, password };
}

export function validateChangePasswordInput(body) {
  requireObjectBody(body);

  const details = [];
  collectUnknownFields(body, ['currentPassword', 'newPassword'], details);

  const { currentPassword } = body;
  if (typeof currentPassword !== 'string' || !currentPassword) {
    details.push({ field: 'currentPassword', message: 'Required' });
  } else if (currentPassword.length > passwordMaxLength) {
    details.push({ field: 'currentPassword', message: `Must be at most ${passwordMaxLength} characters` });
  }
  const newPassword = checkNewPassword(body.newPassword, details, 'newPassword');

  throwIfInvalid(details);
  return { currentPassword, newPassword };
}

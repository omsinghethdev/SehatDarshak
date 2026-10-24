/**
 * Client-side checks mirroring the rules in docs/API_CONTRACT.md. They give fast feedback
 * only; the server remains responsible for validation.
 * Each function returns an object of `{ fieldName: message }` (empty when valid).
 */

export const PASSWORD_MIN_LENGTH = 8;

export function validateLogin({ identifier, password }) {
  const errors = {};
  if (!identifier.trim()) errors.identifier = 'Enter your username.';
  if (!password) errors.password = 'Enter your password.';
  return errors;
}

export function validateRegistration({ name, identifier, password, confirmPassword }) {
  const errors = {};
  if (!name.trim()) errors.name = 'Enter your full name.';
  if (!identifier.trim()) errors.identifier = 'Choose a username.';

  if (!password) {
    errors.password = 'Create a password.';
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (confirmPassword !== undefined) {
    if (!confirmPassword) errors.confirmPassword = 'Re-enter your password.';
    else if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

/** Convert a `{ field: message }` object into the contract's `error.details` array. */
export function toErrorDetails(errors) {
  return Object.entries(errors).map(([field, message]) => ({ field, message }));
}

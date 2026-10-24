import { englishTranslator } from '../../i18n/translate';

/**
 * Client-side checks mirroring the rules in docs/API_CONTRACT.md. They give fast feedback
 * only; the server remains responsible for validation.
 * Each function returns `{ fieldName: message }` (empty when valid). Pass the UI translator `t`
 * for the patient's language; it defaults to English, which the mock services use to imitate
 * server messages.
 */

export const PASSWORD_MIN_LENGTH = 8;

export function validateLogin({ identifier, password }, t = englishTranslator.t) {
  const errors = {};
  if (!identifier.trim()) errors.identifier = t('validation.usernameRequired');
  if (!password) errors.password = t('validation.passwordRequired');
  return errors;
}

export function validateRegistration({ name, identifier, password, confirmPassword }, t = englishTranslator.t) {
  const errors = {};
  if (!name.trim()) errors.name = t('validation.nameRequired');
  if (!identifier.trim()) errors.identifier = t('validation.chooseUsername');

  if (!password) {
    errors.password = t('validation.createPassword');
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = t('validation.passwordTooShort', { min: PASSWORD_MIN_LENGTH });
  }

  if (confirmPassword !== undefined) {
    if (!confirmPassword) errors.confirmPassword = t('validation.confirmPasswordRequired');
    else if (confirmPassword !== password) errors.confirmPassword = t('validation.passwordsDoNotMatch');
  }
  return errors;
}

/** Convert a `{ field: message }` object into the contract's `error.details` array. */
export function toErrorDetails(errors) {
  return Object.entries(errors).map(([field, message]) => ({ field, message }));
}

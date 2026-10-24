import { useCallback } from 'react';
import { useTranslation } from './useTranslation';

/**
 * Turns a form's field errors into display text in the current language. Client-side errors are
 * `{ key, params }` references (see messageRef); server-provided messages are plain strings and
 * are shown as received.
 */
export function useErrorText(fieldErrors) {
  const { t } = useTranslation();
  return useCallback(
    (field) => {
      const error = fieldErrors[field];
      return error && typeof error === 'object' ? t(error.key, error.params) : error;
    },
    [fieldErrors, t],
  );
}

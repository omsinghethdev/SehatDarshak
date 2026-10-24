import { englishTranslator } from '../i18n/translate';
import { API_ERROR_CODES, CLIENT_ERROR_CODES } from '../services/apiClient';

const KNOWN_CODES = new Set([...Object.values(API_ERROR_CODES), ...Object.values(CLIENT_ERROR_CODES)]);
/** For these codes the server's own message is actionable (e.g. "That username is taken"). */
const USE_SERVER_MESSAGE = new Set([API_ERROR_CODES.VALIDATION_ERROR, API_ERROR_CODES.CONFLICT]);

/**
 * Map an error to plain-language UI text in the current language. Internal details are never
 * shown. Server messages (validation/conflict) are in the server's language: in English they are
 * the description; in other languages a translated explanation is shown and the server's own
 * wording is returned separately as `serverMessage` so it can be labelled.
 */
export function getErrorContent(error, t = englishTranslator.t, languageCode = 'en') {
  const code = KNOWN_CODES.has(error?.code) ? error.code : 'FALLBACK';
  const title = t(`errors.${code}.title`);
  const description = t(`errors.${code}.description`);

  if (USE_SERVER_MESSAGE.has(code) && error?.message) {
    return languageCode === 'en'
      ? { title, description: error.message, details: error.details }
      : { title, description, serverMessage: error.message, details: error.details };
  }
  return { title, description };
}

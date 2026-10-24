/**
 * The single list of interface languages. Add a language here (plus a dictionary in
 * ./locales) — components never check language codes themselves.
 *
 * `code` is the UI preference stored in this browser. The API contract has not yet agreed its
 * `preferredLanguage` codes, so this choice is not sent to the server.
 */
export const LANGUAGES = Object.freeze([
  { code: 'en', nativeName: 'English', englishName: 'English', htmlLang: 'en', locale: 'en-IN', speechLang: 'en-IN' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', htmlLang: 'hi', locale: 'hi-IN', speechLang: 'hi-IN' },
]);

export const DEFAULT_LANGUAGE = 'en';

export function getLanguage(code) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES.find((language) => language.code === DEFAULT_LANGUAGE);
}

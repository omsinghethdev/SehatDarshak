import { useContext } from 'react';
import { I18nContext } from '../i18n/I18nContext';

/** `{ t, tx, language, languages, setLanguage }` — see src/i18n/translate.js. */
export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useTranslation must be used within an I18nProvider.');
  return context;
}

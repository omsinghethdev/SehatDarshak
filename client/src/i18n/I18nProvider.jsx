import { useCallback, useEffect, useMemo, useState } from 'react';
import { stopSpeech } from '../lib/speech';
import { I18nContext } from './I18nContext';
import { DEFAULT_LANGUAGE, LANGUAGES, getLanguage } from './languages';
import { createTranslator } from './translate';

export const LANGUAGE_STORAGE_KEY = 'sehatdarsak.language';

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return LANGUAGES.some((language) => language.code === stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Holds the interface language. The choice applies immediately, is kept in localStorage (so it
 * survives refresh and works before sign-in), sets <html lang>, and syncs across open tabs.
 */
export function I18nProvider({ children }) {
  const [code, setCode] = useState(readStoredLanguage);

  const setLanguage = useCallback((next) => {
    if (!LANGUAGES.some((language) => language.code === next)) return;
    stopSpeech(); // Never keep reading aloud in the previous language.
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Storage unavailable: the choice still applies for this visit.
    }
    setCode(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = getLanguage(code).htmlLang;
  }, [code]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === LANGUAGE_STORAGE_KEY) setCode(readStoredLanguage());
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(() => {
    const language = getLanguage(code);
    return { ...createTranslator(code), language, languages: LANGUAGES, setLanguage };
  }, [code, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

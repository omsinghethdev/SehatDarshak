import { Fragment, createElement } from 'react';
import { DEFAULT_LANGUAGE, getLanguage } from './languages';
import en from './locales/en';
import hi from './locales/hi';

const DICTIONARIES = { en, hi };

function lookup(dictionary, key) {
  return key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dictionary);
}

const pluralRules = new Map();
function pluralCategory(code, count) {
  if (!pluralRules.has(code)) pluralRules.set(code, new Intl.PluralRules(getLanguage(code).locale));
  return pluralRules.get(code).select(count);
}

/** Resolve a key to a template string: requested language → English → null. */
function resolve(code, key, params) {
  for (const dictionary of [DICTIONARIES[code], DICTIONARIES[DEFAULT_LANGUAGE]]) {
    let value = lookup(dictionary, key);
    // Plural forms: { zero?, one, other } chosen with Intl.PluralRules for `params.count`.
    // An explicit `zero` form wins for 0 (Hindi's plural rules group 0 with 1, which would
    // otherwise produce "0 मरीज़ है").
    if (value && typeof value === 'object' && typeof params?.count === 'number') {
      value = (params.count === 0 && value.zero) || value[pluralCategory(code, params.count)] || value.other;
    }
    if (typeof value === 'string') return value;
  }
  return null;
}

function missing(key) {
  if (import.meta.env?.DEV) console.warn(`[i18n] Missing translation key "${key}"`);
  return '';
}

/**
 * Create a translator for a language.
 * - `t(key, params)` → string with `{name}` placeholders filled. Missing keys fall back to
 *   English; if the key is missing everywhere it returns `params.defaultValue` (or '') and warns in
 *   development — never the raw key name.
 * - `tx(key, params)` → like `t`, but params may be React nodes (e.g. <strong>), returning nodes.
 */
export function createTranslator(code) {
  const t = (key, params) => {
    const template = resolve(code, key, params);
    if (template === null) return params?.defaultValue ?? missing(key);
    return template.replace(/\{(\w+)\}/g, (match, name) => (params && name in params ? String(params[name]) : match));
  };
  const tx = (key, params) => {
    const template = resolve(code, key, params);
    if (template === null) return params?.defaultValue ?? missing(key);
    return template.split(/(\{\w+\})/g).map((part, index) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1];
      return createElement(Fragment, { key: index }, name && params && name in params ? params[name] : part);
    });
  };
  return { t, tx };
}

/**
 * Use as the `t` argument of a validator to get `{ key, params }` references instead of text,
 * so forms can translate messages at render time (and re-translate on a language switch).
 */
export const messageRef = (key, params) => ({ key, params });

/** English translator for code outside React (e.g. mock services mimicking server messages). */
export const englishTranslator = createTranslator(DEFAULT_LANGUAGE);

export const AVAILABLE_DICTIONARIES = DICTIONARIES;

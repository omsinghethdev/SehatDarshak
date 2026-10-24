import { Languages } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

/**
 * Language switch showing each language in its own script. The group label is bilingual
 * ("Language / भाषा") so it can be found whichever language is currently shown.
 */
export function LanguageSelector({ className }) {
  const { language, languages, setLanguage } = useTranslation();

  return (
    <div role="group" aria-labelledby="language-selector-label" className={cn('flex items-center gap-2', className)}>
      <span id="language-selector-label" className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        <Languages aria-hidden="true" className="size-4 text-brand-700" />
        <span lang="en">Language</span> / <span lang="hi">भाषा</span>
      </span>
      <ul className="flex gap-1">
        {languages.map((option) => {
          const selected = option.code === language.code;
          return (
            <li key={option.code}>
              <button
                type="button"
                lang={option.htmlLang}
                aria-pressed={selected}
                onClick={() => setLanguage(option.code)}
                className={cn(
                  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-base font-semibold',
                  selected
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-slate-400 bg-white text-slate-800 hover:border-brand-700 hover:bg-brand-50',
                )}
              >
                {option.nativeName}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

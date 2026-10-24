import { AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

/** Shared control styling, matching TextField. */
export function controlClasses(error, className) {
  return cn(
    'block w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-500',
    error ? 'border-red-600' : 'border-slate-400 hover:border-slate-500',
    className,
  );
}

/**
 * Label, optional hint, and error message around a form control. `children` receives the
 * ARIA props (`aria-invalid`, `aria-describedby`) to spread onto the control.
 * `footer` renders beside the error line (e.g. a character count).
 */
export function FormField({ id, label, hint, error, footer, className, children }) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block font-medium text-slate-900">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-sm text-slate-600">
          {hint}
        </p>
      )}
      <div className="mt-1.5">
        {children({ 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      </div>
      {(error || footer) && (
        <div className="mt-1.5 flex items-start justify-between gap-3">
          {error ? (
            <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-red-700">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : (
            <span />
          )}
          {footer}
        </div>
      )}
    </div>
  );
}

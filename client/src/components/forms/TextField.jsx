import { AlertCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Labelled input with an optional hint and error. The error is linked through
 * `aria-describedby` and announced with `aria-invalid`.
 * `trailing` renders inside the input's right edge (e.g. a show-password button).
 */
export function TextField({ id, name, label, hint, error, trailing, className, ...inputProps }) {
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
      <div className="relative mt-1.5">
        <input
          id={id}
          name={name ?? id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'block min-h-12 w-full rounded-lg border bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-500',
            error ? 'border-red-600' : 'border-slate-400 hover:border-slate-500',
            trailing && 'pr-14',
          )}
          {...inputProps}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center pr-1">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-red-700">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

import { cn } from '../../utils/cn';
import { FormField, controlClasses } from './FormField';

/**
 * Multi-line text input with a visible label and an optional character count.
 * The count is not a live region, so it does not interrupt screen-reader users while typing;
 * the limit is stated in the hint instead.
 */
export function TextAreaField({ id, name, label, hint, error, maxLength, value, rows = 4, className, ...props }) {
  const length = value?.length ?? 0;
  const footer = maxLength ? (
    <span aria-hidden="true" className={cn('shrink-0 text-sm', length > maxLength ? 'font-semibold text-red-700' : 'text-slate-600')}>
      {length}/{maxLength}
    </span>
  ) : null;

  return (
    <FormField id={id} label={label} hint={hint} error={error} footer={footer} className={className}>
      {(ariaProps) => (
        <textarea
          id={id}
          name={name ?? id}
          rows={rows}
          value={value}
          className={controlClasses(error, 'min-h-28 resize-y')}
          {...ariaProps}
          {...props}
        />
      )}
    </FormField>
  );
}

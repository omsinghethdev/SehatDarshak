import { ChevronDown } from 'lucide-react';
import { FormField, controlClasses } from './FormField';

/**
 * Native select with a visible label. `options` is `[{ value, label }]`; `placeholder`
 * adds an empty first option so nothing is pre-selected by accident.
 */
export function SelectField({ id, name, label, hint, error, options, placeholder, className, ...selectProps }) {
  return (
    <FormField id={id} label={label} hint={hint} error={error} className={className}>
      {(ariaProps) => (
        <div className="relative">
          <select
            id={id}
            name={name ?? id}
            className={controlClasses(error, 'min-h-12 appearance-none pr-10')}
            {...ariaProps}
            {...selectProps}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-slate-600"
          />
        </div>
      )}
    </FormField>
  );
}

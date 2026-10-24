import { useCallback, useState } from 'react';

function detailsToFieldErrors(details, fieldNames) {
  if (!Array.isArray(details)) return {};
  return details.reduce((errors, detail) => {
    if (fieldNames.includes(detail?.field) && !errors[detail.field]) {
      errors[detail.field] = detail.message;
    }
    return errors;
  }, {});
}

/**
 * Small form-state helper: controlled values, client validation, a single in-flight submit,
 * and mapping of API `error.details` back onto fields.
 *
 * Inputs must use `name` attributes matching the keys of `initialValues`, so the first
 * invalid field can receive focus.
 */
export function useForm({ initialValues, validate, onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (pending) return;

    const form = event.currentTarget;
    const errors = validate(values);
    setSubmitError(null);
    setFieldErrors(errors);

    const firstInvalid = Object.keys(initialValues).find((field) => errors[field]);
    if (firstInvalid) {
      const field = form.elements.namedItem(firstInvalid);
      // Radio groups resolve to a RadioNodeList; focus its first enabled option.
      const target =
        field && typeof field.focus !== 'function'
          ? Array.from(field).find((element) => !element.disabled)
          : field;
      target?.focus();
      return;
    }

    setPending(true);
    try {
      await onSubmit(values);
    } catch (error) {
      setFieldErrors(detailsToFieldErrors(error?.details, Object.keys(initialValues)));
      setSubmitError(error);
    } finally {
      setPending(false);
    }
  };

  return { values, fieldErrors, submitError, pending, handleChange, handleSubmit };
}

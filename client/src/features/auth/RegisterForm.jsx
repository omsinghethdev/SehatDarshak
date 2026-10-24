import { ErrorState } from '../../components/feedback/ErrorState';
import { PasswordField } from '../../components/forms/PasswordField';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextField } from '../../components/forms/TextField';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { PASSWORD_MIN_LENGTH, validateRegistration } from './validation';

export function RegisterForm() {
  const { register } = useAuth();
  const { values, fieldErrors, submitError, pending, handleChange, handleSubmit } = useForm({
    initialValues: { name: '', identifier: '', password: '', confirmPassword: '' },
    validate: validateRegistration,
    // confirmPassword is a client-only check; the contract accepts name, identifier, and password.
    onSubmit: ({ name, identifier, password }) =>
      register({ name: name.trim(), identifier: identifier.trim(), password }),
  });

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5" aria-busy={pending}>
      {submitError && <ErrorState error={submitError} showDetails={false} />}

      <TextField
        id="name"
        label="Full name"
        autoComplete="name"
        value={values.name}
        onChange={handleChange}
        error={fieldErrors.name}
        required
      />

      <TextField
        id="identifier"
        label="Username"
        hint="You will use this to sign in."
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        value={values.identifier}
        onChange={handleChange}
        error={fieldErrors.identifier}
        required
      />

      <PasswordField
        id="password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        autoComplete="new-password"
        value={values.password}
        onChange={handleChange}
        error={fieldErrors.password}
        required
      />

      <PasswordField
        id="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={handleChange}
        error={fieldErrors.confirmPassword}
        required
      />

      <SubmitButton pending={pending} pendingLabel="Creating account…" className="w-full">
        Create patient account
      </SubmitButton>
    </form>
  );
}

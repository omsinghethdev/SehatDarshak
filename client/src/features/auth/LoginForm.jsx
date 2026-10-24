import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PasswordField } from '../../components/forms/PasswordField';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextField } from '../../components/forms/TextField';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { API_ERROR_CODES } from '../../services/apiClient';
import { validateLogin } from './validation';

function DemoPatientSignIn({ disabled }) {
  const { loginAsDemoPatient } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  if (!loginAsDemoPatient) return null;

  async function handleClick() {
    if (pending || disabled) return;
    setPending(true);
    setError(null);
    try {
      await loginAsDemoPatient();
    } catch (caught) {
      setError(caught);
      setPending(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-line pt-6">
      <p className="text-sm text-slate-700">
        Exploring the demo? Continue as the fictional demo patient, <strong>Asha Devi</strong>.
      </p>
      <Button
        variant="secondary"
        className="w-full"
        onClick={handleClick}
        aria-disabled={pending || disabled || undefined}
      >
        <UserRound aria-hidden="true" className="size-5" />
        {pending ? 'Signing in…' : 'Continue as demo patient'}
      </Button>
      {error && <ErrorState error={error} />}
    </div>
  );
}

export function LoginForm() {
  const { login } = useAuth();
  const { values, fieldErrors, submitError, pending, handleChange, handleSubmit } = useForm({
    initialValues: { identifier: '', password: '' },
    validate: validateLogin,
    onSubmit: ({ identifier, password }) => login({ identifier: identifier.trim(), password }),
  });

  const badCredentials = submitError?.code === API_ERROR_CODES.UNAUTHORIZED;

  return (
    <div className="space-y-6">
      <form noValidate onSubmit={handleSubmit} className="space-y-5" aria-busy={pending}>
        {submitError && (
          <ErrorState
            error={submitError}
            showDetails={false}
            title={badCredentials ? 'Incorrect username or password' : undefined}
            description={badCredentials ? 'Check your username and password and try again.' : undefined}
          />
        )}

        <TextField
          id="identifier"
          label="Username"
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
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          error={fieldErrors.password}
          required
        />

        <SubmitButton pending={pending} pendingLabel="Signing in…" className="w-full">
          Sign in
        </SubmitButton>
      </form>

      <DemoPatientSignIn disabled={pending} />
    </div>
  );
}

import { useState } from 'react';
import { FlaskConical, UserRound } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PasswordField } from '../../components/forms/PasswordField';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextField } from '../../components/forms/TextField';
import { useAuth } from '../../hooks/useAuth';
import { useErrorText } from '../../hooks/useErrorText';
import { useForm } from '../../hooks/useForm';
import { useTranslation } from '../../hooks/useTranslation';
import { messageRef } from '../../i18n/translate';
import { API_ERROR_CODES } from '../../services/apiClient';
import { validateLogin } from './validation';

/** Development-only shortcut to sign in as a simulated patient, staff, or admin account. */
function DemoAccountSignIn({ disabled }) {
  const { demoAccounts, loginAsDemoAccount } = useAuth();
  const { t } = useTranslation();
  const [pendingKey, setPendingKey] = useState(null);
  const [error, setError] = useState(null);

  if (!loginAsDemoAccount || !demoAccounts?.length) return null;

  async function handleClick(key) {
    if (pendingKey || disabled) return;
    setPendingKey(key);
    setError(null);
    try {
      await loginAsDemoAccount(key);
    } catch (caught) {
      setError(caught);
      setPendingKey(null);
    }
  }

  return (
    <section aria-labelledby="demo-accounts-heading" className="space-y-3 border-t border-line pt-6">
      <h2 id="demo-accounts-heading" className="flex items-center gap-2 font-semibold text-slate-900">
        <FlaskConical aria-hidden="true" className="size-5 text-amber-700" />
        {t('demo.accountsTitle')}
      </h2>
      <p className="text-sm text-slate-700">{t('demo.accountsBody')}</p>
      <ul className="space-y-2">
        {demoAccounts.map((account) => (
          <li key={account.key}>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => handleClick(account.key)}
              aria-disabled={Boolean(pendingKey) || disabled || undefined}
              aria-describedby={`demo-${account.key}-description`}
            >
              <UserRound aria-hidden="true" className="size-5" />
              {pendingKey === account.key ? t('auth.signingIn') : t(`demo.accounts.${account.key}.button`, { defaultValue: account.buttonLabel })}
            </Button>
            <p id={`demo-${account.key}-description`} className="mt-1 text-center text-xs text-slate-600">
              {t(`demo.accounts.${account.key}.description`, { defaultValue: account.description })}
            </p>
          </li>
        ))}
      </ul>
      {error && <ErrorState error={error} />}
    </section>
  );
}

export function LoginForm() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const { values, fieldErrors, submitError, pending, handleChange, handleSubmit } = useForm({
    initialValues: { identifier: '', password: '' },
    validate: (formValues) => validateLogin(formValues, messageRef),
    onSubmit: ({ identifier, password }) => login({ identifier: identifier.trim(), password }),
  });

  const badCredentials = submitError?.code === API_ERROR_CODES.UNAUTHORIZED;
  const errorText = useErrorText(fieldErrors);

  return (
    <div className="space-y-6">
      <form noValidate onSubmit={handleSubmit} className="space-y-5" aria-busy={pending}>
        {submitError && (
          <ErrorState
            error={submitError}
            showDetails={false}
            title={badCredentials ? t('auth.badCredentialsTitle') : undefined}
            description={badCredentials ? t('auth.badCredentialsBody') : undefined}
          />
        )}

        <TextField
          id="identifier"
          label={t('auth.username')}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={values.identifier}
          onChange={handleChange}
          error={errorText('identifier')}
          required
        />

        <PasswordField
          id="password"
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          error={errorText('password')}
          required
        />

        <SubmitButton pending={pending} pendingLabel={t('auth.signingIn')} className="w-full">
          {t('layout.signIn')}
        </SubmitButton>
      </form>

      <DemoAccountSignIn disabled={pending} />
    </div>
  );
}

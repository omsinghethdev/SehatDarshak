import { ErrorState } from '../../components/feedback/ErrorState';
import { PasswordField } from '../../components/forms/PasswordField';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextField } from '../../components/forms/TextField';
import { useAuth } from '../../hooks/useAuth';
import { useErrorText } from '../../hooks/useErrorText';
import { useForm } from '../../hooks/useForm';
import { useTranslation } from '../../hooks/useTranslation';
import { messageRef } from '../../i18n/translate';
import { PASSWORD_MIN_LENGTH, validateRegistration } from './validation';

export function RegisterForm() {
  const { register } = useAuth();
  const { t } = useTranslation();
  const { values, fieldErrors, submitError, pending, handleChange, handleSubmit } = useForm({
    initialValues: { name: '', identifier: '', password: '', confirmPassword: '' },
    validate: (formValues) => validateRegistration(formValues, messageRef),
    // confirmPassword is a client-only check; the contract accepts name, identifier, and password.
    // The interface language is a browser preference only: the contract's preferredLanguage codes
    // are not agreed yet, so it is not sent.
    onSubmit: ({ name, identifier, password }) =>
      register({ name: name.trim(), identifier: identifier.trim(), password }),
  });
  const errorText = useErrorText(fieldErrors);

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5" aria-busy={pending}>
      {submitError && <ErrorState error={submitError} showDetails={false} />}

      <TextField
        id="name"
        label={t('auth.fullName')}
        autoComplete="name"
        value={values.name}
        onChange={handleChange}
        error={errorText('name')}
        required
      />

      <TextField
        id="identifier"
        label={t('auth.username')}
        hint={t('auth.usernameHint')}
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
        hint={t('auth.passwordHint', { min: PASSWORD_MIN_LENGTH })}
        autoComplete="new-password"
        value={values.password}
        onChange={handleChange}
        error={errorText('password')}
        required
      />

      <PasswordField
        id="confirmPassword"
        label={t('auth.confirmPassword')}
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={handleChange}
        error={errorText('confirmPassword')}
        required
      />

      <SubmitButton pending={pending} pendingLabel={t('auth.creatingAccount')} className="w-full">
        {t('auth.createAccount')}
      </SubmitButton>
    </form>
  );
}

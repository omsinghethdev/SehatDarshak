import { Accessibility, HelpCircle, MapPinned, MessageCircleQuestion, Send } from 'lucide-react';
import { ErrorState } from '../../components/feedback/ErrorState';
import { SelectField } from '../../components/forms/SelectField';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextAreaField } from '../../components/forms/TextAreaField';
import { TextField } from '../../components/forms/TextField';
import { useErrorText } from '../../hooks/useErrorText';
import { useForm } from '../../hooks/useForm';
import { useTranslation } from '../../hooks/useTranslation';
import { messageRef } from '../../i18n/translate';
import { LOCATION_MAX, MESSAGE_MAX, MESSAGE_MIN, validateAssistanceRequest } from './assistanceRules';
import { assistanceService } from './assistanceService';

const EMPTY_VALUES = { departmentId: '', location: '', message: '' };

/**
 * Common needs as one-tap choices for patients who find typing hard. A choice only fills the
 * message box (in the patient's language) — it is still sent as the documented `message` text
 * and can be edited.
 */
const QUICK_NEEDS = [
  { key: 'wheelchair', icon: Accessibility },
  { key: 'findDepartment', icon: MapPinned },
  { key: 'understand', icon: MessageCircleQuestion },
  { key: 'other', icon: HelpCircle },
];

/**
 * Request form using exactly the documented fields, as three numbered steps. `useForm` ignores
 * repeat submits while a request is in flight, and the page swaps the form for a confirmation
 * afterwards, so a double-click or Enter press cannot send the same request twice.
 */
export function AssistanceRequestForm({ departments, initialDepartmentId, onSubmitted }) {
  const { t } = useTranslation();
  // Pre-select a department passed from another page (e.g. a skipped token), if it is valid.
  const preselected = departments.some((department) => department.id === initialDepartmentId) ? initialDepartmentId : '';
  const { values, fieldErrors, submitError, pending, handleChange, handleSubmit } = useForm({
    initialValues: { ...EMPTY_VALUES, departmentId: preselected },
    validate: (formValues) => validateAssistanceRequest(formValues, messageRef),
    onSubmit: async ({ departmentId, location, message }) => {
      const request = await assistanceService.createRequest({
        departmentId,
        location: location.trim(),
        message: message.trim(),
      });
      onSubmitted(request);
    },
  });
  const errorText = useErrorText(fieldErrors);

  function chooseNeed(key) {
    const phrase = t(`assistance.needs.${key}.message`);
    const current = values.message.trim();
    const value = current ? `${current}\n${phrase}` : phrase;
    handleChange({ target: { name: 'message', value } });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6" aria-busy={pending}>
      {submitError && <ErrorState error={submitError} showDetails={false} />}

      <SelectField
        id="departmentId"
        label={t('assistance.step1')}
        hint={t('assistance.departmentHint')}
        placeholder={t('assistance.chooseDepartment')}
        options={departments.map((department) => ({ value: department.id, label: department.name }))}
        value={values.departmentId}
        onChange={handleChange}
        error={errorText('departmentId')}
        required
      />

      <TextField
        id="location"
        label={t('assistance.step2')}
        hint={t('assistance.locationHint', { max: LOCATION_MAX })}
        autoComplete="off"
        value={values.location}
        onChange={handleChange}
        error={errorText('location')}
        required
      />

      <div className="space-y-3">
        <div role="group" aria-labelledby="quick-needs-label">
          <p id="quick-needs-label" className="font-medium text-slate-900">
            {t('assistance.step3')}
          </p>
          <p className="mt-0.5 text-sm text-slate-600">{t('assistance.quickHint')}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {QUICK_NEEDS.map(({ key, icon: Icon }) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => chooseNeed(key)}
                  className="flex min-h-12 w-full items-center gap-2 rounded-lg border border-slate-400 bg-white px-3 py-2 text-left font-medium text-slate-900 hover:border-brand-700 hover:bg-brand-50"
                >
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-brand-700" />
                  {t(`assistance.needs.${key}.label`)}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <TextAreaField
          id="message"
          label={t('assistance.messageLabel')}
          hint={t('assistance.messageHint', { min: MESSAGE_MIN, max: MESSAGE_MAX })}
          maxLength={MESSAGE_MAX}
          value={values.message}
          onChange={handleChange}
          error={errorText('message')}
          required
        />
      </div>

      <SubmitButton pending={pending} pendingLabel={t('assistance.sending')} className="w-full sm:w-auto">
        <Send aria-hidden="true" className="size-5" />
        {t('assistance.send')}
      </SubmitButton>
    </form>
  );
}

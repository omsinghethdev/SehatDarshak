import { Send } from 'lucide-react';
import { ErrorState } from '../../components/feedback/ErrorState';
import { SelectField } from '../../components/forms/SelectField';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextAreaField } from '../../components/forms/TextAreaField';
import { TextField } from '../../components/forms/TextField';
import { useForm } from '../../hooks/useForm';
import { LOCATION_MAX, MESSAGE_MAX, MESSAGE_MIN, validateAssistanceRequest } from './assistanceRules';
import { assistanceService } from './assistanceService';

const EMPTY_VALUES = { departmentId: '', location: '', message: '' };

/**
 * Request form using exactly the documented fields. `useForm` ignores repeat submits while a
 * request is in flight, and the page swaps the form for a confirmation afterwards, so a
 * double-click or Enter press cannot send the same request twice.
 */
export function AssistanceRequestForm({ departments, onSubmitted }) {
  const { values, fieldErrors, submitError, pending, handleChange, handleSubmit } = useForm({
    initialValues: EMPTY_VALUES,
    validate: validateAssistanceRequest,
    onSubmit: async ({ departmentId, location, message }) => {
      const request = await assistanceService.createRequest({
        departmentId,
        location: location.trim(),
        message: message.trim(),
      });
      onSubmitted(request);
    },
  });

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5" aria-busy={pending}>
      {submitError && <ErrorState error={submitError} showDetails={false} />}

      <SelectField
        id="departmentId"
        label="Department"
        hint="The department you are visiting or need help with."
        placeholder="Choose a department"
        options={departments.map((department) => ({ value: department.id, label: department.name }))}
        value={values.departmentId}
        onChange={handleChange}
        error={fieldErrors.departmentId}
        required
      />

      <TextField
        id="location"
        label="Where are you?"
        hint={`Describe where you are or where help is needed, for example “Ground floor, near the Registration Desk”. Up to ${LOCATION_MAX} characters.`}
        autoComplete="off"
        value={values.location}
        onChange={handleChange}
        error={fieldErrors.location}
        required
      />

      <TextAreaField
        id="message"
        label="What help do you need?"
        hint={`Between ${MESSAGE_MIN} and ${MESSAGE_MAX} characters.`}
        maxLength={MESSAGE_MAX}
        value={values.message}
        onChange={handleChange}
        error={fieldErrors.message}
        required
      />

      <SubmitButton pending={pending} pendingLabel="Sending request…" className="w-full sm:w-auto">
        <Send aria-hidden="true" className="size-5" />
        Send request
      </SubmitButton>
    </form>
  );
}

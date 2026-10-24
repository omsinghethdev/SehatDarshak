import { AlertCircle, Ticket } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState } from '../../components/feedback/ErrorState';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { useForm } from '../../hooks/useForm';
import { tokenStatusPath } from '../../routes/paths';
import { API_ERROR_CODES } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { queueService } from './queueService';

const ERROR_ID = 'departmentId-error';

function DepartmentOption({ department, activeToken, checked, onChange }) {
  const unavailable = Boolean(activeToken);
  const descriptionId = `dept-${department.id}-description`;

  return (
    <li>
      <label
        className={cn(
          'flex gap-4 rounded-xl border bg-white p-4 sm:p-5',
          unavailable
            ? 'cursor-not-allowed border-dashed border-slate-300 bg-canvas-muted'
            : 'cursor-pointer border-line hover:border-brand-600',
          checked && 'border-brand-700 ring-2 ring-brand-700',
        )}
      >
        <input
          type="radio"
          name="departmentId"
          value={department.id}
          checked={checked}
          onChange={onChange}
          disabled={unavailable}
          aria-describedby={descriptionId}
          className="mt-1 size-5 shrink-0 accent-brand-700"
        />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{department.name}</span>
            <span className="rounded border border-line px-1.5 text-xs font-medium text-slate-600">
              {department.code}
            </span>
          </span>
          <span id={descriptionId} className="mt-1 block text-sm text-slate-700">
            {unavailable
              ? `You already have an active token here: ${activeToken.displayNumber}.`
              : department.description}
          </span>
        </span>
      </label>
      {unavailable && (
        <Link
          to={tokenStatusPath(activeToken.id)}
          className="mt-1 ml-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline underline-offset-4"
        >
          View token {activeToken.displayNumber}
        </Link>
      )}
    </li>
  );
}

/**
 * Department choice and token request. The server enforces one active token per
 * department; `activeTokens` is used only to explain that rule up front.
 */
export function BookTokenForm({ departments, activeTokens, initialDepartmentId, onBooked, onConflict }) {
  const activeByDepartment = new Map(activeTokens.map((token) => [token.departmentId, token]));
  const preselected =
    initialDepartmentId &&
    departments.some((department) => department.id === initialDepartmentId) &&
    !activeByDepartment.has(initialDepartmentId)
      ? initialDepartmentId
      : '';

  const { values, fieldErrors, submitError, pending, handleChange, handleSubmit } = useForm({
    initialValues: { departmentId: preselected },
    // A department that gained an active token since it was chosen (e.g. after a reload or a
    // 409) can no longer be booked, so it counts as not chosen.
    validate: ({ departmentId }) =>
      departmentId && !activeByDepartment.has(departmentId) ? {} : { departmentId: 'Choose a department.' },
    onSubmit: async ({ departmentId }) => {
      try {
        onBooked(await queueService.createToken(departmentId));
      } catch (error) {
        if (error?.code === API_ERROR_CODES.CONFLICT) onConflict?.();
        throw error;
      }
    },
  });

  const allBooked = departments.every((department) => activeByDepartment.has(department.id));
  const fieldError = fieldErrors.departmentId;

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6" aria-busy={pending}>
      {submitError && <ErrorState error={submitError} showDetails={false} />}

      <fieldset aria-describedby={fieldError ? ERROR_ID : undefined}>
        <legend className="text-lg font-semibold text-slate-900">Choose a department</legend>
        <p className="mt-1 text-sm text-slate-600">You can hold one active token per department.</p>
        {fieldError && (
          <p id={ERROR_ID} className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-700">
            <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            {fieldError}
          </p>
        )}
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {departments.map((department) => (
            <DepartmentOption
              key={department.id}
              department={department}
              activeToken={activeByDepartment.get(department.id)}
              checked={values.departmentId === department.id && !activeByDepartment.has(department.id)}
              onChange={handleChange}
            />
          ))}
        </ul>
      </fieldset>

      {allBooked ? (
        <p className="rounded-lg border border-line bg-canvas-muted p-4 text-slate-700">
          You already have an active token in every department.
        </p>
      ) : (
        <SubmitButton pending={pending} pendingLabel="Requesting token…" className="w-full sm:w-auto">
          <Ticket aria-hidden="true" className="size-5" />
          Get my token
        </SubmitButton>
      )}
    </form>
  );
}

import { useState } from 'react';
import { ConfirmPrompt } from '../../components/feedback/ConfirmPrompt';
import { ErrorState } from '../../components/feedback/ErrorState';
import { PasswordField } from '../../components/forms/PasswordField';
import { SelectField } from '../../components/forms/SelectField';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextField } from '../../components/forms/TextField';
import { Button } from '../../components/common/Button';
import { STAFF_TYPE_LABELS } from './adminLabels';
import { IS_MOCK_ADMIN } from './adminService';

/*
 * Create or edit a staff/doctor account. Checks here give quick feedback; the server's validation
 * is authoritative and its field errors are shown next to the matching fields.
 * Role and account status are never form fields: accounts are always `staff` (doctors are
 * staffType "doctor"), and activation is a separate confirmed action.
 */

const IDENTIFIER = /^[a-z0-9._-]{3,30}$/;
const PHONE = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REGISTRATION = /^[A-Za-z0-9/.-]+$/;
const PROFILE_FIELDS = ['designation', 'phone', 'email', 'specialization', 'registrationNumber'];
const DOCTOR_ONLY = ['specialization', 'registrationNumber'];

function initialValues(mode, staffType, account) {
  const base = {
    name: account?.name ?? '',
    identifier: '',
    password: '',
    confirmPassword: '',
    staffType: account?.staffType ?? staffType,
    departmentId: account?.departmentId ?? '',
    wardId: account?.wardId ?? '',
  };
  for (const field of PROFILE_FIELDS) base[field] = account?.[field] ?? '';
  return mode === 'create' ? base : { ...base, identifier: account.identifier };
}

function validate(values, mode) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'Enter the full name.';
  else if (values.name.trim().length > 100) errors.name = 'Use 100 characters or fewer.';
  if (mode === 'create') {
    const identifier = values.identifier.trim().toLowerCase();
    if (!identifier) errors.identifier = 'Choose a username.';
    else if (!IDENTIFIER.test(identifier)) errors.identifier = 'Use 3–30 lowercase letters, numbers, dots, hyphens, or underscores.';
    if (!values.password) errors.password = 'Set an initial password.';
    else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
    else if (values.password.length > 128) errors.password = 'Use 128 characters or fewer.';
    if (!values.confirmPassword) errors.confirmPassword = 'Re-enter the password.';
    else if (values.confirmPassword !== values.password) errors.confirmPassword = 'Passwords do not match.';
  }
  if (!values.departmentId) errors.departmentId = 'Choose a department.';
  if (values.phone.trim() && !PHONE.test(values.phone.trim())) errors.phone = 'Enter a phone number using digits, spaces, or hyphens.';
  if (values.email.trim() && !EMAIL.test(values.email.trim())) errors.email = 'Enter an email address.';
  if (values.registrationNumber.trim() && !REGISTRATION.test(values.registrationNumber.trim())) {
    errors.registrationNumber = 'Use letters, numbers, slashes, dots, or hyphens.';
  }
  return errors;
}

// Create: every provided value. Edit: only changed values; cleared optional fields become null.
function toPayload(values, mode, account) {
  const isDoctor = values.staffType === 'doctor';
  const text = (field) => values[field].trim();
  if (mode === 'create') {
    return {
      name: text('name'),
      identifier: text('identifier').toLowerCase(),
      password: values.password,
      departmentId: values.departmentId,
      staffType: values.staffType,
      ...(values.wardId ? { wardId: values.wardId } : {}),
      ...Object.fromEntries(
        PROFILE_FIELDS.filter((field) => text(field) && (isDoctor || !DOCTOR_ONLY.includes(field))).map((field) => [field, text(field)]),
      ),
    };
  }
  const changes = {};
  if (text('name') !== account.name) changes.name = text('name');
  if (values.departmentId !== account.departmentId) changes.departmentId = values.departmentId;
  if ((values.wardId || null) !== (account.wardId ?? null)) changes.wardId = values.wardId || null;
  if (values.staffType !== account.staffType) changes.staffType = values.staffType;
  for (const field of PROFILE_FIELDS) {
    if (!isDoctor && DOCTOR_ONLY.includes(field)) continue; // The server clears these when a doctor becomes staff.
    const next = text(field) || null;
    if (next !== (account[field] ?? null)) changes[field] = next;
  }
  return changes;
}

const SERVER_FIELDS = ['name', 'identifier', 'password', 'departmentId', 'wardId', 'staffType', ...PROFILE_FIELDS];

export function StaffForm({ mode, staffType, account, reference, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => initialValues(mode, staffType, account));
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(null);
  const isDoctor = values.staffType === 'doctor';

  const change = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  async function submit(payload) {
    setPending(true);
    setSubmitError(null);
    try {
      await onSubmit(payload);
    } catch (error) {
      const fieldErrors = {};
      for (const detail of error?.details ?? []) {
        if (SERVER_FIELDS.includes(detail.field) && !fieldErrors[detail.field]) fieldErrors[detail.field] = detail.message;
      }
      setErrors(fieldErrors);
      setSubmitError(error);
      setConfirming(null);
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    const found = validate(values, mode);
    setErrors(found);
    setSubmitError(null);
    const first = Object.keys(found)[0];
    if (first) {
      event.currentTarget.elements.namedItem(first)?.focus();
      return;
    }
    const payload = toPayload(values, mode, account);
    if (mode === 'edit' && Object.keys(payload).length === 0) {
      setSubmitError({ code: 'NO_CHANGES', message: 'Nothing has changed.' });
      return;
    }
    // Account creation is confirmed before it is sent.
    if (mode === 'create') setConfirming(payload);
    else submit(payload);
  }

  const departmentOptions = mode === 'edit' && account?.departmentId && !reference.activeDepartmentOptions.some((option) => option.value === account.departmentId)
    ? [...reference.activeDepartmentOptions, { value: account.departmentId, label: `${account.departmentName ?? account.departmentId} (inactive)` }]
    : reference.activeDepartmentOptions;
  const wardOptions = mode === 'edit' && account?.wardId && !reference.activeWardOptions.some((option) => option.value === account.wardId)
    ? [...reference.activeWardOptions, { value: account.wardId, label: `${account.wardName ?? account.wardId} (inactive)` }]
    : reference.activeWardOptions;
  const departmentName = reference.names.departments.get(values.departmentId) ?? values.departmentId;
  const typeLabel = STAFF_TYPE_LABELS[values.staffType].toLowerCase();

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5" aria-busy={pending}>
      {submitError?.code === 'NO_CHANGES' ? (
        <p role="status" className="rounded-lg border border-line bg-canvas-muted p-3 text-sm text-slate-800">Nothing has changed.</p>
      ) : (
        submitError && <ErrorState error={submitError} showDetails={false} />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="name" label="Full name" value={values.name} onChange={change} error={errors.name} autoComplete="off" required className="sm:col-span-2" />
        {mode === 'create' ? (
          <TextField
            id="identifier"
            label="Username"
            hint="Used to sign in. 3–30 lowercase letters, numbers, dots, hyphens, or underscores."
            value={values.identifier}
            onChange={change}
            error={errors.identifier}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            required
            className="sm:col-span-2"
          />
        ) : (
          <p className="text-sm text-slate-700 sm:col-span-2">
            Username <span className="font-semibold text-slate-900">{account.identifier}</span> cannot be changed.
          </p>
        )}

        {mode === 'create' && (
          <>
            <PasswordField id="password" label="Initial password" hint="At least 8 characters. Give it to the person directly; it is not shown again." value={values.password} onChange={change} error={errors.password} autoComplete="new-password" required />
            <PasswordField id="confirmPassword" label="Confirm initial password" value={values.confirmPassword} onChange={change} error={errors.confirmPassword} autoComplete="new-password" required />
          </>
        )}

        {mode === 'edit' && (
          <SelectField
            id="staffType"
            label="Role type"
            hint="Doctors and staff have the same department-scoped access. Changing a doctor to staff removes the specialization and registration number."
            value={values.staffType}
            onChange={change}
            error={errors.staffType}
            options={[{ value: 'doctor', label: 'Doctor' }, { value: 'staff', label: 'Staff member' }]}
            className="sm:col-span-2"
          />
        )}

        <SelectField
          id="departmentId"
          label="Department"
          hint="Sets which department's queue and assistance requests the account can manage."
          value={values.departmentId}
          onChange={change}
          error={errors.departmentId}
          placeholder="Choose a department"
          options={departmentOptions}
          required
        />
        <SelectField
          id="wardId"
          label="Ward (optional)"
          hint={wardOptions.length ? 'Administrative assignment only; it grants no access.' : 'No active wards yet.'}
          value={values.wardId}
          onChange={change}
          error={errors.wardId}
          placeholder="No ward"
          options={wardOptions}
        />

        <TextField id="designation" label="Designation (optional)" value={values.designation} onChange={change} error={errors.designation} autoComplete="off" />
        {isDoctor && (
          <TextField id="specialization" label="Specialization (optional)" value={values.specialization} onChange={change} error={errors.specialization} autoComplete="off" />
        )}
        {isDoctor && (
          <TextField
            id="registrationNumber"
            label="Registration number (optional)"
            hint="Recorded as given; the app cannot verify it."
            value={values.registrationNumber}
            onChange={change}
            error={errors.registrationNumber}
            autoComplete="off"
          />
        )}
        <TextField id="phone" label="Phone (optional)" type="tel" value={values.phone} onChange={change} error={errors.phone} autoComplete="off" />
        <TextField id="email" label="Email (optional)" type="email" value={values.email} onChange={change} error={errors.email} autoComplete="off" />
      </div>

      {confirming ? (
        <ConfirmPrompt
          title={`Create a ${typeLabel} account for ${confirming.name}?`}
          confirmLabel="Create account"
          pendingLabel="Creating account…"
          pending={pending}
          onConfirm={() => submit(confirming)}
          onCancel={() => setConfirming(null)}
        >
          Username <strong>{confirming.identifier}</strong> · {departmentName}.{' '}
          {IS_MOCK_ADMIN
            ? 'Demo directory only: this account cannot sign in.'
            : 'The account can sign in immediately and manage this department’s queue and assistance requests.'}
        </ConfirmPrompt>
      ) : (
        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending} pendingLabel={mode === 'create' ? 'Checking…' : 'Saving…'}>
            {mode === 'create' ? 'Review and create' : 'Save changes'}
          </SubmitButton>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        </div>
      )}
    </form>
  );
}

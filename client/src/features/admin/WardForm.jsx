import { useCallback, useState } from 'react';
import { Button } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { SelectField } from '../../components/forms/SelectField';
import { SubmitButton } from '../../components/forms/SubmitButton';
import { TextField } from '../../components/forms/TextField';
import { useAsyncData } from '../../hooks/useAsyncData';
import { navigationService } from '../navigation/navigationService';

const CODE = /^[A-Za-z0-9-]{2,16}$/;
const FIELDS = ['name', 'code', 'description', 'departmentId', 'floorId'];

/**
 * Create or edit a ward. The code (and so the ward ID) is permanent, so it is only set on
 * creation. Wards have no map position: they never change the hospital map or its IDs.
 */
export function WardForm({ mode, ward, reference, onSubmit, onCancel }) {
  const loadFloors = useCallback((signal) => navigationService.listFloors({ signal }), []);
  const floors = useAsyncData(loadFloors);
  const [values, setValues] = useState({
    name: ward?.name ?? '',
    code: ward?.code ?? '',
    description: ward?.description ?? '',
    departmentId: ward?.departmentId ?? '',
    floorId: ward?.floorId ?? '',
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [pending, setPending] = useState(false);

  const change = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (pending) return;
    const found = {};
    if (!values.name.trim()) found.name = 'Enter a ward name.';
    else if (values.name.trim().length > 100) found.name = 'Use 100 characters or fewer.';
    if (mode === 'create' && !CODE.test(values.code.trim())) found.code = 'Use 2–16 letters, numbers, or hyphens.';
    if (values.description.trim().length > 300) found.description = 'Use 300 characters or fewer.';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      event.currentTarget.elements.namedItem(first)?.focus();
      return;
    }

    let payload;
    if (mode === 'create') {
      payload = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        ...(values.departmentId ? { departmentId: values.departmentId } : {}),
        ...(values.floorId ? { floorId: values.floorId } : {}),
      };
    } else {
      payload = {};
      if (values.name.trim() !== ward.name) payload.name = values.name.trim();
      if ((values.description.trim() || null) !== (ward.description ?? null)) payload.description = values.description.trim() || null;
      if ((values.departmentId || null) !== (ward.departmentId ?? null)) payload.departmentId = values.departmentId || null;
      if ((values.floorId || null) !== (ward.floorId ?? null)) payload.floorId = values.floorId || null;
      if (Object.keys(payload).length === 0) {
        onCancel();
        return;
      }
    }

    setPending(true);
    setSubmitError(null);
    try {
      await onSubmit(payload);
    } catch (error) {
      const fieldErrors = {};
      for (const detail of error?.details ?? []) if (FIELDS.includes(detail.field)) fieldErrors[detail.field] = detail.message;
      setErrors(fieldErrors);
      setSubmitError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4" aria-busy={pending}>
      {submitError && <ErrorState error={submitError} showDetails={false} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="name" label="Ward name" value={values.name} onChange={change} error={errors.name} autoComplete="off" required />
        {mode === 'create' ? (
          <TextField id="code" label="Code" hint="2–16 letters, numbers, or hyphens. Permanent." value={values.code} onChange={change} error={errors.code} autoComplete="off" required />
        ) : (
          <p className="self-end text-sm text-slate-700">Code <span className="font-semibold text-slate-900">{ward.code}</span> cannot be changed.</p>
        )}
        <SelectField id="departmentId" label="Department (optional)" value={values.departmentId} onChange={change} error={errors.departmentId} placeholder="Not linked to a department" options={reference.activeDepartmentOptions} />
        <SelectField
          id="floorId"
          label="Floor (optional)"
          hint={floors.status === 'error' ? 'Floors could not be loaded.' : undefined}
          value={values.floorId}
          onChange={change}
          error={errors.floorId}
          placeholder="No floor"
          options={(floors.data ?? []).map((floor) => ({ value: floor.id, label: floor.displayName }))}
        />
        <TextField id="description" label="Description (optional)" value={values.description} onChange={change} error={errors.description} autoComplete="off" className="sm:col-span-2" />
      </div>
      <div className="flex flex-wrap gap-3">
        <SubmitButton pending={pending} pendingLabel="Saving…">{mode === 'create' ? 'Create ward' : 'Save changes'}</SubmitButton>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

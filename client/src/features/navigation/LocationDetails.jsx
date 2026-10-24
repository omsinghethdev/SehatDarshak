import { MousePointerClick, X } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { LocationGlyph } from './LocationGlyph';
import { getLocationType } from './locationTypes';

function departmentText(location, departments) {
  if (!location.departmentId) return 'Not linked to a department';
  if (departments.status === 'loading' && !departments.data) return 'Loading…';
  const department = departments.data?.get(location.departmentId);
  if (department) return `${department.name} (${department.code})`;
  return 'Department details are not available right now.';
}

/** Details for the selected location. Announced politely when the selection changes. */
export function LocationDetails({ location, number, floor, departments, onClear }) {
  if (!location) {
    return (
      <div aria-live="polite" className="rounded-xl border border-dashed border-line bg-white p-5 text-slate-700">
        <p className="flex items-start gap-3">
          <MousePointerClick aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-500" />
          Select a location on the map or in the list below to see its details.
        </p>
      </div>
    );
  }

  const type = getLocationType(location.roomType);

  return (
    <section
      aria-live="polite"
      aria-labelledby="location-details-heading"
      className="rounded-xl border-2 border-slate-900 bg-white p-5"
    >
      <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">Selected location</p>
      <h2 id="location-details-heading" className="mt-2 flex items-start gap-2 text-xl font-bold text-slate-900">
        <LocationGlyph type={type} number={number} className="size-8 shrink-0" />
        {location.displayName}
      </h2>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-sm text-slate-600">Type</dt>
          <dd className="flex items-center gap-1.5 font-medium text-slate-900">
            <type.icon aria-hidden="true" className="size-4" />
            {type.label}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Floor</dt>
          <dd className="font-medium text-slate-900">{floor.displayName}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">Department</dt>
          <dd className="font-medium text-slate-900">{departmentText(location, departments)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-slate-600">
        This map shows where the location is, not how to get there. Ask hospital staff if you need
        directions.
      </p>
      <Button variant="secondary" onClick={onClear} className="mt-4 w-full">
        <X aria-hidden="true" className="size-4" />
        Clear selection
      </Button>
    </section>
  );
}

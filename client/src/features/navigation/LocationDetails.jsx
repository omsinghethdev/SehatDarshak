import { MousePointerClick, Ticket, X } from 'lucide-react';
import { Button, ButtonLink } from '../../components/common/Button';
import { LocationGlyph } from './LocationGlyph';
import { ListenButton } from '../../components/common/ListenButton';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { bookTokenPath } from '../../routes/paths';
import { getLocationType, typeLabel } from './locationTypes';

function departmentText(location, departments, t) {
  if (!location.departmentId) return t('map.noDepartment');
  if (departments.status === 'loading' && !departments.data) return t('common.loading');
  const department = departments.data?.get(location.departmentId);
  if (department) return `${department.name} (${department.code})`;
  return t('queue.departmentUnavailable');
}

/** Details for the selected location. Announced politely when the selection changes. */
export function LocationDetails({ location, number, floor, departments, onClear }) {
  const { t } = useTranslation();
  const { role } = useAuth();
  if (!location) {
    return (
      <div aria-live="polite" className="rounded-xl border border-dashed border-line bg-white p-5 text-slate-700">
        <p className="flex items-start gap-3">
          <MousePointerClick aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-500" />
          {t('map.selectPrompt')}
        </p>
      </div>
    );
  }

  const type = getLocationType(location.roomType);
  const typeText = typeLabel(type, t);
  const departmentValue = departmentText(location, departments, t);
  // Only offered when the department is known, so the booking form opens with it selected.
  const bookableDepartment = role === 'patient' && location.departmentId ? departments.data?.get(location.departmentId) : null;

  return (
    <section
      aria-live="polite"
      aria-labelledby="location-details-heading"
      className="rounded-xl border-2 border-slate-900 bg-white p-5"
    >
      <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{t('map.selectedLocation')}</p>
      <h2 id="location-details-heading" className="mt-2 flex items-start gap-2 text-xl font-bold text-slate-900">
        <LocationGlyph type={type} number={number} className="size-8 shrink-0" />
        {location.displayName}
      </h2>
      <dl className="mt-4 space-y-3">
        <div>
          <dt className="text-sm text-slate-600">{t('map.type')}</dt>
          <dd className="flex items-center gap-1.5 font-medium text-slate-900">
            <type.icon aria-hidden="true" className="size-4" />
            {typeText}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">{t('map.floor')}</dt>
          <dd className="font-medium text-slate-900">{floor.displayName}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600">{t('queue.department')}</dt>
          <dd className="font-medium text-slate-900">{departmentValue}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-slate-600">{t('map.noDirections')}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {bookableDepartment && (
          <ButtonLink to={bookTokenPath(bookableDepartment.id)}>
            <Ticket aria-hidden="true" className="size-4" />
            {t('map.bookForDepartment', { department: bookableDepartment.name })}
          </ButtonLink>
        )}
        <ListenButton
          text={() =>
            [
              location.displayName,
              typeText,
              floor.displayName,
              `${t('queue.department')}: ${departmentValue}`,
              t('map.noDirections'),
            ].join('. ')
          }
        />
        <Button variant="secondary" onClick={onClear}>
          <X aria-hidden="true" className="size-4" />
          {t('map.clearSelection')}
        </Button>
      </div>
    </section>
  );
}

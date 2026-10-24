import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { LocationGlyph } from './LocationGlyph';
import { useTranslation } from '../../hooks/useTranslation';
import { getLocationType, hasValidGeometry, typeLabel } from './locationTypes';

/**
 * Text alternative to the SVG map: every location on the floor as a selectable list item,
 * numbered to match the markers on the map.
 */
export function LocationList({ floor, numbering, selectedId, departmentsById, onSelect }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="location-list-heading" className="space-y-4">
      <div>
        <h2 id="location-list-heading" className="text-xl font-bold text-slate-900">
          {t('map.listTitle', { floor: floor.displayName })}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t('map.listIntro', { count: floor.locations.length })}</p>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {floor.locations.map((location) => {
          const type = getLocationType(location.roomType);
          const selected = location.id === selectedId;
          const department = location.departmentId ? departmentsById?.get(location.departmentId) : null;

          return (
            <li key={location.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(location.id)}
                className={cn(
                  'flex min-h-14 w-full items-start gap-3 rounded-lg border bg-white px-3 py-2.5 text-left hover:border-brand-600',
                  selected ? 'border-2 border-slate-900' : 'border-line',
                )}
              >
                <LocationGlyph type={type} number={numbering.get(location.id)} className="mt-0.5 size-7 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900">{location.displayName}</span>
                  <span className="block text-sm text-slate-700">
                    {typeLabel(type, t)}
                    {department && ` · ${department.name}`}
                  </span>
                  {!hasValidGeometry(location) && (
                    <span className="block text-sm text-slate-600">{t('map.noPosition')}</span>
                  )}
                </span>
                {selected && (
                  <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    {t('common.selected')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

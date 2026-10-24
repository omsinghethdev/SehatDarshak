import { Layers } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';

/** Floor picker as a set of toggle buttons; the current floor has `aria-pressed="true"`. */
export function FloorSelector({ floors, selectedFloorId, onSelect }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-labelledby="floor-selector-label">
      <p id="floor-selector-label" className="flex items-center gap-2 font-semibold text-slate-900">
        <Layers aria-hidden="true" className="size-5 text-brand-700" />
        {t('map.chooseFloor')}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {floors.map((floor) => {
          const selected = floor.id === selectedFloorId;
          return (
            <li key={floor.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(floor.id)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-lg border px-4 font-semibold',
                  selected
                    ? 'border-brand-700 bg-brand-700 text-white'
                    : 'border-slate-400 bg-white text-slate-800 hover:border-brand-700 hover:bg-brand-50',
                )}
              >
                {floor.displayName}
                {selected && <span className="sr-only"> ({t('common.selected')})</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

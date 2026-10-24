import { LocationGlyph } from './LocationGlyph';
import { useTranslation } from '../../hooks/useTranslation';
import { LOCATION_TYPES, typeLabel } from './locationTypes';

/** Key to the location types shown on the map (shape and fill, plus colour). */
export function MapLegend() {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="sr-only">{t('map.key')}</h3>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
        {Object.entries(LOCATION_TYPES).map(([key, type]) => (
          <li key={key} className="flex items-center gap-2">
            <LocationGlyph type={type} className="size-6 shrink-0" />
            <span>
              <span className="font-semibold text-slate-900">{typeLabel(type, t)}</span>
              <span className="text-slate-600"> — {t(type.patternLabelKey)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

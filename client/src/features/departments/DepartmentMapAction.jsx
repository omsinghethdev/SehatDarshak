import { Link } from 'react-router';
import { MapPin, Map as MapIcon } from 'lucide-react';
import { ButtonLink } from '../../components/common/Button';
import { useTranslation } from '../../hooks/useTranslation';
import { resolveDepartmentMapLink } from '../navigation/departmentLocations';
import { PATHS } from '../../routes/paths';

const LINK_CLASS = 'inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-800 underline underline-offset-4';

/**
 * "Find on map" for one department card. Goes straight to the department's room when the map
 * marks one; otherwise opens the plain hospital map and says why, never guessing a location.
 * `lookup` is the shared result of loadDepartmentLocations (see resolveDepartmentMapLink).
 */
export function DepartmentMapAction({ department, lookup }) {
  const { t } = useTranslation();
  const target = resolveDepartmentMapLink(department.id, lookup, PATHS.navigation);

  if (target.kind === 'checking') {
    return <p className="text-sm text-slate-600">{t('departments.map.checking')}</p>;
  }

  if (target.kind === 'located' && target.links.length === 1) {
    const [{ to, location }] = target.links;
    return (
      <div className="space-y-1">
        <ButtonLink to={to} variant="secondary">
          <MapPin aria-hidden="true" className="size-4" />
          {t('departments.map.findOnMap')}
          <span className="sr-only"> — {department.name}</span>
        </ButtonLink>
        <p className="text-sm text-slate-600">
          {location.displayName} · {location.floorName}
        </p>
      </div>
    );
  }

  if (target.kind === 'located') {
    return (
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
          <MapPin aria-hidden="true" className="size-4" />
          {t('departments.map.roomsTitle')}
        </p>
        <ul className="mt-1">
          {target.links.map(({ to, location }) => (
            <li key={location.id}>
              <Link to={to} className={LINK_CLASS}>
                {location.displayName} · {location.floorName}
                <span className="sr-only"> — {department.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const messageKey = { unmapped: 'notMarked', unchecked: 'notChecked', unavailable: 'unavailable' }[target.kind];
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">{t(`departments.map.${messageKey}`)}</p>
      <ButtonLink to={target.to} variant="ghost" className="-ml-3">
        <MapIcon aria-hidden="true" className="size-4" />
        {t('departments.openMap')}
        <span className="sr-only"> — {department.name}</span>
      </ButtonLink>
    </div>
  );
}

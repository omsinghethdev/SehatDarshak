import { useId, useState } from 'react';
import { ChevronDown, HandHelping, MapPin } from 'lucide-react';
import { Link } from 'react-router';
import { Button, ButtonLink } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ListenButton } from '../../components/common/ListenButton';
import { useTranslation } from '../../hooks/useTranslation';
import { PATHS, assistancePath } from '../../routes/paths';
import { navigationService } from '../navigation/navigationService';
import { getLocationType, typeLabel } from '../navigation/locationTypes';

function mapLink(floorId, locationId) {
  return `${PATHS.navigation}?${new URLSearchParams({ floor: floorId, location: locationId })}`;
}

/**
 * Find the department's rooms on the hospital map (documented map endpoints only).
 * Floors that fail to load are reported, not silently dropped.
 */
async function loadDepartmentLocations(departmentId) {
  const floors = await navigationService.listFloors();
  const maps = await Promise.all(
    floors.map((floor) => navigationService.getFloorMap(floor.id).then((map) => ({ map }), (error) => ({ error }))),
  );
  const locations = maps.flatMap(({ map }) =>
    (map?.locations ?? [])
      .filter((location) => location.departmentId && location.departmentId === departmentId)
      .map((location) => ({ ...location, floorId: map.id, floorName: map.displayName })),
  );
  return { locations, failedFloors: maps.filter((entry) => entry.error).length };
}

/**
 * "Where should I wait?" — shows only what the system actually knows: the department and its
 * rooms on the hospital map. The API has no "waiting area" field, so none is named; patients
 * are asked to confirm with staff instead of being given an invented location.
 */
export function WaitingGuidance({ token, department }) {
  const panelId = useId();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ status: 'idle', locations: [], failedFloors: 0, error: null });

  async function load() {
    setState({ status: 'loading', locations: [], failedFloors: 0, error: null });
    try {
      const result = await loadDepartmentLocations(token.departmentId);
      setState({ status: 'success', ...result, error: null });
    } catch (error) {
      setState({ status: 'error', locations: [], failedFloors: 0, error });
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && state.status === 'idle') load();
  }

  const departmentName = department?.name;

  return (
    <section aria-labelledby={`${panelId}-heading`} className="rounded-xl border border-line bg-white">
      <h2 id={`${panelId}-heading`} className="m-0">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-5 py-3 text-left text-lg font-semibold text-slate-900 hover:bg-canvas-muted"
        >
          <span className="flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-5 text-brand-700" />
            {t('waiting.title')}
          </span>
          <ChevronDown aria-hidden="true" className={open ? 'size-5 rotate-180 transition-transform' : 'size-5 transition-transform'} />
        </button>
      </h2>

      <div id={panelId} hidden={!open} className="space-y-4 border-t border-line px-5 py-5">
        <dl className="space-y-1">
          <dt className="text-sm text-slate-600">{t('queue.yourDepartmentLabel')}</dt>
          <dd className="text-lg font-semibold text-slate-900">{departmentName ?? t('queue.departmentUnavailable')}</dd>
        </dl>

        {state.status === 'loading' && <LoadingState label={t('waiting.loading')} className="py-4" />}
        {state.status === 'error' && (
          <ErrorState
            error={state.error}
            title={t('waiting.mapErrorTitle')}
            description={t('waiting.mapErrorBody')}
            onRetry={load}
          />
        )}

        {state.status === 'success' && state.locations.length > 0 && (
          <div className="space-y-3">
            <p className="text-slate-700">
              {t('waiting.roomsIntro', { department: departmentName ?? t('queue.yourDepartment') })}
            </p>
            <ListenButton
              text={() =>
                [
                  t('waiting.roomsIntro', { department: departmentName ?? t('queue.yourDepartment') }),
                  ...state.locations.map((location) => t('waiting.roomSpeech', { room: location.displayName, floor: location.floorName })),
                ].join(' ')
              }
            />
            <ul className="space-y-2">
              {state.locations.map((location) => (
                <li key={location.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
                  <span>
                    <span className="block font-semibold text-slate-900">{location.displayName}</span>
                    <span className="block text-sm text-slate-600">
                      {typeLabel(getLocationType(location.roomType), t)} · {location.floorName}
                    </span>
                  </span>
                  <Link
                    to={mapLink(location.floorId, location.id)}
                    className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4"
                  >
                    {t('waiting.showOnMap')}<span className="sr-only"> — {location.displayName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.status === 'success' && state.locations.length === 0 && (
          <p className="text-slate-700">{t('waiting.notConfigured')}</p>
        )}

        {state.status === 'success' && state.failedFloors > 0 && (
          <p className="text-sm text-slate-600">{t('waiting.someFloorsFailed')}</p>
        )}

        <div className="flex flex-wrap gap-3 border-t border-line pt-4">
          <ButtonLink to={assistancePath(token.departmentId)} variant="secondary">
            <HandHelping aria-hidden="true" className="size-5" />
            {t('waiting.askStaff')}
          </ButtonLink>
          {state.status === 'success' && state.locations.length === 0 && (
            <Button variant="ghost" onClick={load}>
              {t('common.checkAgain')}
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-600">{t('map.locationOnlyShort')}</p>
      </div>
    </section>
  );
}

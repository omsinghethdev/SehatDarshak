import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDownUp, Building2, DoorOpen, MapPin, Navigation, Search } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useTranslation } from '../../hooks/useTranslation';
import { groupPlacesByFloor, searchDestinations } from './destinationSearch';

const FIELD = 'block min-h-12 w-full rounded-lg border border-slate-400 bg-white px-3 text-base text-slate-900';

function DestinationSearch({ places, departments, toPlace, onChoose }) {
  const { t } = useTranslation();
  const ids = useId();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(!toPlace);
  const inputRef = useRef(null);
  const changeRef = useRef(null);
  const results = useMemo(() => searchDestinations({ places, departments, query }), [places, departments, query]);
  const showEditor = editing || !toPlace;

  useEffect(() => {
    if (!toPlace) setEditing(true);
  }, [toPlace]);

  function choose(place) {
    onChoose(place);
    setQuery('');
    setEditing(false);
    // Keep keyboard focus on the destination field rather than losing it with the result list.
    requestAnimationFrame(() => changeRef.current?.focus());
  }

  function startEditing() {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  if (!showEditor) {
    return (
      <div className="space-y-2">
        <p className="font-semibold text-slate-900">{t('directions.selectedTo')}</p>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-brand-700 bg-brand-50 p-3">
          <span className="flex min-w-0 items-start gap-2">
            <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700" />
            <span className="min-w-0">
              <span className="block font-semibold text-slate-900">{toPlace.displayName}</span>
              <span className="block text-sm text-slate-700">{toPlace.floorName}</span>
            </span>
          </span>
          <Button ref={changeRef} variant="secondary" onClick={startEditing}>
            {t('directions.change')}
          </Button>
        </div>
      </div>
    );
  }

  const trimmed = query.trim();
  return (
    <div className="space-y-2">
      <label htmlFor={`${ids}-to`} className="block font-semibold text-slate-900">
        {t('directions.toLabel')}
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-500" />
        <input
          ref={inputRef}
          id={`${ids}-to`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && toPlace) {
              setQuery('');
              setEditing(false);
            }
          }}
          placeholder={t('directions.toPlaceholder')}
          aria-describedby={`${ids}-to-hint ${ids}-to-count`}
          autoComplete="off"
          className={`${FIELD} pl-10`}
        />
      </div>
      <p id={`${ids}-to-hint`} className="text-sm text-slate-600">
        {t('directions.toHint')}
      </p>
      <p id={`${ids}-to-count`} aria-live="polite" className="sr-only">
        {trimmed ? t('directions.resultsCount', { count: results.length }) : ''}
      </p>
      {trimmed && results.length === 0 && <p className="text-sm text-slate-700">{t('directions.noResults', { query: trimmed })}</p>}
      {results.length > 0 && (
        <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-line bg-white p-1">
          {results.map((result) => {
            const { place } = result;
            const isDepartment = result.kind === 'department';
            const Icon = isDepartment ? Building2 : DoorOpen;
            return (
              <li key={`${result.kind}-${isDepartment ? result.department.id : place.id}`}>
                <button
                  type="button"
                  onClick={() => choose(place)}
                  className="flex min-h-12 w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-brand-50"
                >
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">
                      {isDepartment ? result.department.name : place.displayName}
                      {isDepartment && <span className="ml-2 text-sm font-normal text-slate-600">{t('directions.departmentResult')}</span>}
                    </span>
                    <span className="block text-sm text-slate-700">
                      {isDepartment
                        ? t('directions.goesTo', { place: place.displayName, floor: place.floorName })
                        : [result.department?.name, place.floorName].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Choose a destination (search departments and rooms) and a starting point (a list grouped by
 * floor). The start is always chosen by the patient: the app has no indoor positioning.
 */
export function RoutePlanner({ places, departments, from, to, avoidStairs, onChange, startIsDefault = false }) {
  const { t } = useTranslation();
  const ids = useId();
  const placesById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const groups = useMemo(() => groupPlacesByFloor(places), [places]);
  const toPlace = placesById.get(to) ?? null;
  const fromPlace = placesById.get(from) ?? null;
  const entrance = places.find((place) => place.isEntrance && place.id !== to) ?? null;

  return (
    <section aria-labelledby={`${ids}-heading`} className="space-y-5 rounded-xl border border-line bg-white p-5 shadow-raised sm:p-6">
      <div>
        <h2 id={`${ids}-heading`} className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Navigation aria-hidden="true" className="size-5 text-brand-700" />
          {t('directions.plannerTitle')}
        </h2>
        <p className="mt-1 text-slate-700">{t('directions.plannerIntro')}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <DestinationSearch places={places} departments={departments} toPlace={toPlace} onChoose={(place) => onChange({ to: place.id })} />

        <div className="space-y-2">
          <label htmlFor={`${ids}-from`} className="block font-semibold text-slate-900">
            {t('directions.fromLabel')}
          </label>
          <select
            id={`${ids}-from`}
            value={fromPlace ? from : ''}
            onChange={(event) => onChange({ from: event.target.value || null })}
            aria-describedby={`${ids}-from-hint`}
            className={FIELD}
          >
            <option value="">{t('directions.fromPlaceholder')}</option>
            {groups.map((group) => (
              <optgroup key={group.floorId} label={group.floorName}>
                {group.places.map((place) => (
                  <option key={place.id} value={place.id} disabled={place.id === to}>
                    {place.displayName}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p id={`${ids}-from-hint`} className="text-sm text-slate-600">
            {startIsDefault && fromPlace ? t('directions.simulation.defaultStart', { place: fromPlace.displayName }) : t('directions.fromHint')}
          </p>
          {!fromPlace && entrance && (
            <Button variant="secondary" onClick={() => onChange({ from: entrance.id })}>
              <DoorOpen aria-hidden="true" className="size-5" />
              {t('directions.useEntrance', { place: entrance.displayName })}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-t border-line pt-4">
        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium text-slate-900">
            <input
              type="checkbox"
              checked={avoidStairs}
              onChange={(event) => onChange({ avoidStairs: event.target.checked })}
              aria-describedby={`${ids}-stairs-hint`}
              className="size-5 accent-brand-700"
            />
            {t('directions.avoidStairs')}
          </label>
          <p id={`${ids}-stairs-hint`} className="text-sm text-slate-600">
            {t('directions.avoidStairsHint')}
          </p>
        </div>
        {fromPlace && toPlace && (
          <Button variant="ghost" onClick={() => onChange({ from: to, to: from })}>
            <ArrowDownUp aria-hidden="true" className="size-5" />
            {t('directions.swap')}
          </Button>
        )}
      </div>
    </section>
  );
}


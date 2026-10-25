import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MapPinOff } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button, ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { PageHeader } from '../components/layout/PageHeader';
import { departmentService } from '../features/departments/departmentService';
import { FloorMapSvg } from '../features/navigation/FloorMapSvg';
import { FloorSelector } from '../features/navigation/FloorSelector';
import { LocationDetails } from '../features/navigation/LocationDetails';
import { LocationList } from '../features/navigation/LocationList';
import { MapLegend } from '../features/navigation/MapLegend';
import { RouteLayer, RouteLegend, WalkwaysLayer } from '../features/navigation/MapOverlays';
import { MapViewport } from '../features/navigation/MapViewport';
import { NavigationBar, RoutePanel } from '../features/navigation/RoutePanel';
import { RoutePlanner } from '../features/navigation/RoutePlanner';
import { SimulationBadge, SimulationBar, currentInstruction } from '../features/navigation/SimulationPanel';
import { navigationService } from '../features/navigation/navigationService';
import { describeStep, routeSummary } from '../features/navigation/routeInstructions';
import { resolveStartPlace } from '../features/navigation/routeSimulation';
import { routeFloorIds, routeOnFloor } from '../features/navigation/routeView';
import { useRouteSimulation } from '../features/navigation/useRouteSimulation';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS, isSafeId, tokenStatusPath } from '../routes/paths';

function isUsableFloorMap(floor) {
  return (
    floor &&
    Number.isFinite(floor.width) &&
    Number.isFinite(floor.height) &&
    floor.width > 0 &&
    floor.height > 0 &&
    Array.isArray(floor.locations)
  );
}

/** Moves focus to the first visible element marked `data-nav-focus` (panel or mobile bar). */
function focusNavigationControl() {
  requestAnimationFrame(() => {
    const target = [...document.querySelectorAll('[data-nav-focus]')].find((element) => element.offsetParent !== null);
    target?.focus();
  });
}

function FloorMapSection({ floorState, departments, selectedId, onSelect, onClear, walkways, route, activeStep, simPosition, sidePanel, placesById, onDirectionsTo, onStartHere, floorList, onShowFloor }) {
  const { t } = useTranslation();
  const { status, data: floor, error, reload } = floorState;

  const numbering = useMemo(
    () => new Map((floor?.locations ?? []).map((location, index) => [location.id, index + 1])),
    [floor],
  );
  const departmentsById = useMemo(
    () => (departments.data ? new Map(departments.data.map((item) => [item.id, item])) : null),
    [departments.data],
  );
  const view = useMemo(() => (route && floor ? routeOnFloor(route, floor.id) : null), [route, floor]);

  if (status === 'error') return <ErrorState error={error} onRetry={reload} />;
  if (status === 'loading' || !floor) return <LoadingState label={t('map.loadingFloor')} />;

  if (!isUsableFloorMap(floor)) {
    return <EmptyState icon={MapPinOff} title={t('map.unusableTitle')} description={t('map.unusableBody')} />;
  }

  if (floor.locations.length === 0) {
    return (
      <EmptyState
        icon={MapPinOff}
        title={t('map.emptyFloorTitle', { floor: floor.displayName })}
        description={t('map.emptyFloorBody')}
      />
    );
  }

  const selected = floor.locations.find((location) => location.id === selectedId) ?? null;
  const departmentsState = { ...departments, data: departmentsById };

  // What the view fits: the current step while navigating, else the whole route on this floor.
  const step = route && activeStep !== null ? route.steps[activeStep] : null;
  const stepPoints = step && step.floorId === floor.id ? step.points : null;
  // A lift, stairs, or arrival step is a single point: frame it with the walk leading to it, so
  // the view does not zoom right in on one door.
  const previousStep = step ? route.steps[step.index - 1] : null;
  const focusStepPoints =
    stepPoints && stepPoints.length < 2 && previousStep?.floorId === floor.id ? [...previousStep.points, ...stepPoints] : stepPoints;
  const routePoints = view ? [...view.lines.flat(), ...view.transitions.map((item) => item.point)] : [];
  const focusPoints = focusStepPoints ?? (routePoints.length > 0 ? routePoints : null);
  const focusKey = `${floor.id}|${route?.path?.join('>') ?? ''}|${activeStep ?? ''}`;

  const routeFloors = route ? routeFloorIds(route) : null;
  const floorName = (id) =>
    floorList.find((item) => item.id === id)?.displayName ?? route?.floors.find((item) => item.id === id)?.displayName ?? id;
  const transitionLabel = (transition) =>
    t(`directions.map.${transition.kind}${transition.role === 'leave' ? 'To' : 'From'}`, { floor: floorName(transition.floorId) });

  const navigable = Boolean(selected && placesById?.has(selected.id));
  const marker = simPosition && simPosition.floorId === floor.id && simPosition.point ? simPosition : null;

  return (
    <div className="space-y-10">
      {selectedId && !selected && (
        <Notice tone="info" title={t('map.linkNotFoundTitle')}>
          {t('map.linkNotFoundBody', { floor: floor.displayName })}
        </Notice>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="floor-map-heading" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="floor-map-heading" className="text-xl font-bold text-slate-900">
              {t('map.floorMapTitle', { floor: floor.displayName })}
            </h2>
            <p className="text-sm text-slate-600">
              {t('map.selectNumbered')}
              <span className="sm:hidden"> {t('map.swipeHint')}</span>
            </p>
          </div>

          {route && routeFloors && !routeFloors.has(floor.id) && (
            <Notice
              tone="info"
              title={t('directions.routeTitle')}
              action={
                <div className="flex flex-wrap gap-2">
                  {route.floors.map((item) => (
                    <Button key={item.id} variant="secondary" onClick={() => onShowFloor(item.id)}>
                      {t('directions.map.showFloor', { floor: item.displayName })}
                    </Button>
                  ))}
                </div>
              }
            >
              {t('directions.map.notOnFloor', { floor: floor.displayName, floors: route.floors.map((item) => item.displayName).join(', ') })}
            </Notice>
          )}

          {simPosition && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <SimulationBadge />
              <span>{t('directions.simulation.mapNote')}</span>
            </p>
          )}

          <MapViewport
            floor={floor}
            focusPoints={focusPoints}
            focusKey={focusKey}
            followPoint={marker?.point ?? null}
            renderMap={({ viewBox, zoomed, frameProps }) => (
              <FloorMapSvg
                floor={floor}
                numbering={numbering}
                selectedId={selected?.id}
                onSelect={onSelect}
                viewBox={viewBox}
                zoomed={zoomed}
                frameProps={frameProps}
                underlay={<WalkwaysLayer walkways={walkways?.floorId === floor.id ? walkways : null} />}
                overlay={
                  view && (
                    <RouteLayer
                      view={view}
                      activePoints={step ? (stepPoints?.length > 1 ? stepPoints : []) : null}
                      transitionLabel={transitionLabel}
                      floorWidth={floor.width}
                      marker={marker}
                    />
                  )
                }
              />
            )}
          />
          <MapLegend />
          <RouteLegend t={t} showRoute={Boolean(view)} showMarker={Boolean(simPosition)} />
        </section>

        <div className="space-y-4 lg:sticky lg:top-24">
          {sidePanel ?? (
            <LocationDetails
              location={selected}
              number={selected ? numbering.get(selected.id) : undefined}
              floor={floor}
              departments={departmentsState}
              onClear={onClear}
              onDirectionsTo={navigable ? () => onDirectionsTo(selected.id) : undefined}
              onStartHere={navigable ? () => onStartHere(selected.id) : undefined}
            />
          )}
        </div>
      </div>

      <LocationList
        floor={floor}
        numbering={numbering}
        selectedId={selected?.id}
        departmentsById={departmentsById}
        onSelect={onSelect}
      />
    </div>
  );
}

export function NavigationPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.map'));
  const { isMockAuth, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadFloors = useCallback((signal) => navigationService.listFloors({ signal }), []);
  const floors = useAsyncData(loadFloors);

  // Department names are optional detail: a failure here must not block the map.
  const loadDepartments = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const departments = useAsyncData(loadDepartments);

  // Places on the walking graph: the start and destination choices.
  const loadPlaces = useCallback((signal) => navigationService.listDestinations({ signal }), []);
  const places = useAsyncData(loadPlaces);
  const placesById = useMemo(() => (places.data ? new Map(places.data.map((place) => [place.id, place])) : null), [places.data]);

  const toParam = searchParams.get('to');
  const fromParam = searchParams.get('from');
  const avoidStairs = searchParams.get('stairs') === 'avoid';
  const tokenId = isSafeId(searchParams.get('token')) ? searchParams.get('token') : null;
  const toPlace = placesById?.get(toParam) ?? null;
  // Without a start in the link, directions to a destination begin at the demo starting point
  // (the main entrance). A start named in the link must be a real place: it is never replaced.
  const start = places.data && (fromParam || toPlace) ? resolveStartPlace(places.data, fromParam, toPlace?.id) : null;
  const fromPlace = start?.place ?? null;
  const startIsDefault = Boolean(start?.isDefault);
  const linkPlaceMissing = Boolean(placesById) && Boolean((toParam && !toPlace) || (fromParam && !fromPlace));

  // Changes only the given URL parameters (a null value removes one); others, such as the
  // token context, are kept.
  const updateParams = useCallback(
    (changes) =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  // ---- Route: only when both ends are known places --------------------------------------------
  const routeKey = toPlace && fromPlace ? `${fromPlace.id}|${toPlace.id}|${avoidStairs}` : null;
  const loadRoute = useCallback(
    (signal) => {
      if (!routeKey) return Promise.resolve(null);
      const [from, to, avoid] = routeKey.split('|');
      return navigationService.getRoute({ from, to, avoidStairs: avoid === 'true' }, { signal });
    },
    [routeKey],
  );
  // useAsyncData aborts the previous request when the inputs change, and a route is shown only
  // if it answers the current inputs, so a slow older response can never replace a newer one.
  const routeData = useAsyncData(loadRoute);
  const route =
    routeData.data && `${routeData.data.from.id}|${routeData.data.to.id}|${routeData.data.avoidStairs}` === routeKey
      ? routeData.data
      : null;

  let routeState = null;
  if (toPlace && !fromPlace) routeState = { status: 'needStart', reason: start?.reason };
  else if (routeKey && route) routeState = { status: 'success', route };
  else if (routeKey && routeData.status === 'error') routeState = { status: 'error', error: routeData.error, retry: routeData.reload };
  else if (routeKey) routeState = { status: 'loading' };

  // ---- Simulated navigation: a dot moves along the route; it is not the patient's position -----
  // A new route (destination, start, or stairs option) replaces the simulation for the old one.
  const simulation = useRouteSimulation(route);
  const sim = simulation.snapshot;
  const simulating = Boolean(sim) && (sim.status === 'running' || sim.status === 'paused');
  const simArrived = sim?.status === 'arrived';
  const simPosition = simulating || simArrived ? sim.position : null;

  // ---- Step-by-step navigation: manual; nothing detects the patient's position ----------------
  const [navigation, setNavigation] = useState({ key: null, step: null, arrived: false });
  const manualStep = route && navigation.key === routeKey ? navigation.step : null;
  const arrived = Boolean(route && navigation.key === routeKey && navigation.arrived) || simArrived;
  // The step the map highlights: the simulation's while it runs, else the manual one.
  const activeStep = simulating ? sim.position.stepIndex : manualStep;

  function goToStep(index) {
    if (!route) return;
    simulation.controls.stop();
    const step = route.steps[Math.max(0, Math.min(index, route.steps.length - 1))];
    setNavigation({ key: routeKey, step: step.index, arrived: false });
    updateParams({ floor: step.floorId, location: null });
    // On small screens the step controls are in a bottom bar: bring the map into view above it.
    if (window.matchMedia?.('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => document.getElementById('floor-map-heading')?.scrollIntoView({ block: 'start' }));
    }
  }
  function startNavigation() {
    goToStep(0);
    focusNavigationControl();
  }
  function stopNavigation() {
    setNavigation({ key: null, step: null, arrived: false });
    simulation.controls.stop();
    focusNavigationControl();
  }
  function markArrived() {
    setNavigation({ key: routeKey, step: route.steps.length - 1, arrived: true });
    updateParams({ floor: route.to.floorId });
    focusNavigationControl();
  }

  // Polite announcements for important changes only: a new route, a new step, arrival.
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (!route) return;
    if (arrived) {
      setAnnouncement(t('directions.arrivedTitle', { place: route.to.displayName }));
    } else if (manualStep !== null) {
      const position = t('directions.stepOf', { current: manualStep + 1, total: route.steps.length });
      setAnnouncement(`${position}: ${describeStep(route.steps[manualStep], route, t)}`);
    } else if (!simulating) {
      const { distance, time } = routeSummary(route, t);
      setAnnouncement(t('directions.routeAnnounce', { place: route.to.displayName, distance, time, count: route.steps.length }));
    }
    // A language change re-renders the text but should not repeat the announcement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, manualStep, arrived]);

  // Simulation events worth announcing: a new instruction (with the floor when it changes). Not
  // every position update. Start, pause, resume, restart, and exit are announced by their buttons.
  const simStep = simulating ? sim.position.stepIndex : null;
  const simFloorId = simulating ? sim.position.floorId : null;
  const lastSim = useRef(null);
  useEffect(() => {
    const previous = lastSim.current;
    lastSim.current = simStep === null ? null : { step: simStep, floorId: simFloorId };
    if (!route || simStep === null || !previous || previous.step === simStep) return;
    const instruction = currentInstruction(route, sim.position, t);
    const floorChanged = previous.floorId !== simFloorId;
    const floor = route.floors.find((item) => item.id === simFloorId)?.displayName ?? simFloorId;
    setAnnouncement(floorChanged ? `${t('directions.simulation.announceFloor', { floor })} ${instruction}` : instruction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simStep, simFloorId]);

  // The map follows the simulation onto each floor it reaches (by a lift or stairs step). The
  // patient can still look at another floor in between; the next floor change brings them back.
  useEffect(() => {
    if (simFloorId) updateParams({ floor: simFloorId, location: null });
  }, [simFloorId, updateParams]);

  function startSimulation() {
    if (!route) return;
    setNavigation({ key: null, step: null, arrived: false });
    // The next position update starts a new announcement history.
    lastSim.current = null;
    simulation.controls.start();
    setAnnouncement(t('directions.simulation.announceStarted', { instruction: describeStep(route.steps[0], route, t) }));
    // On small screens the controls are in a bottom bar: bring the map itself to the top.
    if (window.matchMedia?.('(max-width: 1023px)').matches) {
      requestAnimationFrame(() =>
        document.querySelector('section[aria-labelledby="floor-map-heading"] svg[role="group"]')?.scrollIntoView({ block: 'start' }),
      );
    }
    focusNavigationControl();
  }
  const simulationHandlers = {
    onStart: startSimulation,
    onPause: () => {
      simulation.controls.pause();
      setAnnouncement(t('directions.simulation.announcePaused'));
    },
    onResume: () => {
      simulation.controls.resume();
      setAnnouncement(t('directions.simulation.announceResumed'));
    },
    onRestart: () => {
      lastSim.current = null;
      simulation.controls.restart();
      updateParams({ floor: route?.steps[0].floorId, location: null });
      setAnnouncement(t('directions.simulation.announceRestarted', { instruction: route ? describeStep(route.steps[0], route, t) : '' }));
    },
    onExit: () => {
      simulation.controls.stop();
      setAnnouncement(t('directions.simulation.announceStopped'));
      focusNavigationControl();
    },
    onRateChange: simulation.controls.setRate,
  };

  function changePlan(changes) {
    const next = { from: fromParam, to: toParam, avoidStairs, ...changes };
    const nextFrom = next.from ?? (places.data ? resolveStartPlace(places.data, null, next.to).place?.id : null);
    const both = Boolean(placesById?.has(nextFrom) && placesById?.has(next.to));
    updateParams({
      from: next.from,
      to: next.to,
      stairs: next.avoidStairs ? 'avoid' : null,
      // With both ends chosen, show the start floor; with only a destination, show it selected.
      floor: both ? null : placesById?.get(next.to)?.floorId ?? searchParams.get('floor'),
      location: both ? null : next.to,
    });
  }

  // ---- Floor shown ------------------------------------------------------------------------------
  const floorList = floors.data ?? [];
  const requestedFloorId = searchParams.get('floor');
  const isFloor = (id) => floorList.some((floor) => floor.id === id);
  const defaultFloorId = [fromPlace?.floorId, toPlace?.floorId].find(isFloor) ?? floorList[0]?.id ?? null;
  const floorId = isFloor(requestedFloorId) ? requestedFloorId : defaultFloorId;
  const selectedId = searchParams.get('location');

  const loadFloorMap = useCallback(
    (signal) => (floorId ? navigationService.getFloorMap(floorId, { signal }) : Promise.resolve(null)),
    [floorId],
  );
  const floorMap = useAsyncData(loadFloorMap);
  // Ignore a previous floor's data while the newly selected floor loads.
  const floorState =
    floorMap.data && floorMap.data.id !== floorId ? { ...floorMap, status: 'loading', data: null } : floorMap;

  // Walkways are drawn when available; without them the map still works.
  const loadWalkways = useCallback(
    (signal) => (floorId ? navigationService.getWalkways(floorId, { signal }) : Promise.resolve(null)),
    [floorId],
  );
  const walkways = useAsyncData(loadWalkways);

  const selectFloor = (id) => updateParams({ floor: id, location: null });
  const selectLocation = (id) => updateParams({ floor: floorId, location: id === selectedId ? null : id });
  const clearLocation = () => updateParams({ location: null });

  let planner;
  if (places.status === 'error') {
    planner = <ErrorState error={places.error} onRetry={places.reload} />;
  } else if (!places.data) {
    planner = <LoadingState label={t('directions.placesLoading')} />;
  } else if (places.data.length === 0) {
    planner = (
      <Notice tone="info" title={t('directions.unavailableTitle')}>
        {t('directions.unavailableBody')}
      </Notice>
    );
  } else {
    planner = (
      <div className="space-y-3">
        {linkPlaceMissing && (
          <Notice tone="warning" title={t('directions.linkPlaceNotFoundTitle')}>
            {t('directions.linkPlaceNotFoundBody')}
          </Notice>
        )}
        <RoutePlanner
          places={places.data}
          departments={departments.data ?? []}
          from={fromPlace?.id ?? null}
          to={toPlace?.id ?? null}
          avoidStairs={avoidStairs}
          onChange={changePlan}
          startIsDefault={startIsDefault}
        />
      </div>
    );
  }

  const sidePanel = routeState ? (
    <RoutePanel
      routeState={routeState}
      toPlace={toPlace}
      avoidStairs={avoidStairs}
      activeStep={manualStep}
      arrived={arrived}
      onStart={startNavigation}
      onStop={stopNavigation}
      onGoToStep={goToStep}
      onArrived={markArrived}
      tokenId={tokenId}
      simulation={{ snapshot: sim, rate: simulation.rate, ...simulationHandlers }}
    />
  ) : null;

  let content;
  if (floors.status === 'error') {
    content = <ErrorState error={floors.error} onRetry={floors.reload} />;
  } else if (!floors.data) {
    content = <LoadingState label={t('map.loadingFloors')} />;
  } else if (floorList.length === 0) {
    content = (
      <EmptyState
        icon={MapPinOff}
        title={t('map.noFloorsTitle')}
        description={t('map.noFloorsBody')}
        action={<Button variant="secondary" onClick={floors.reload}>{t('common.checkAgain')}</Button>}
      />
    );
  } else {
    // A link naming a floor that does not exist falls back to another floor, and says so.
    const floorMissing = Boolean(requestedFloorId) && requestedFloorId !== floorId;
    content = (
      <div className="space-y-8">
        {floorMissing && (
          <Notice tone="info" title={t('map.floorNotFoundTitle')}>
            {t('map.floorNotFoundBody', { floor: floorList.find((floor) => floor.id === floorId)?.displayName })}
          </Notice>
        )}
        <FloorSelector
          floors={floorList}
          selectedFloorId={floorId}
          onSelect={selectFloor}
          routeFloorIds={route ? routeFloorIds(route) : null}
        />
        <FloorMapSection
          floorState={floorState}
          departments={departments}
          selectedId={selectedId}
          onSelect={selectLocation}
          onClear={clearLocation}
          walkways={walkways.data}
          route={route}
          activeStep={activeStep}
          simPosition={simPosition}
          sidePanel={sidePanel}
          placesById={placesById}
          onDirectionsTo={(id) => changePlan({ to: id })}
          onStartHere={(id) => changePlan({ from: id })}
          floorList={floorList}
          onShowFloor={selectFloor}
        />
      </div>
    );
  }

  const navigating = manualStep !== null && !arrived;

  return (
    <Container className={`space-y-8 py-10 sm:py-14 ${navigating || simulating ? 'pb-72 lg:pb-14' : ''}`}>
      {tokenId && (
        <ButtonLink to={tokenStatusPath(tokenId)} variant="ghost" className="-ml-3">
          <ArrowLeft aria-hidden="true" className="size-5" />
          {t('directions.backToToken')}
        </ButtonLink>
      )}

      <PageHeader eyebrow={t('dashboard.actions.infoTitle')} title={t('nav.map')} description={t('map.intro')} />

      <div className="space-y-3">
        {isMockAuth && (
          <Notice tone="warning" title={t('demo.mapTitle')}>
            {t('demo.mapBody')}
          </Notice>
        )}
        <Notice
          tone="info"
          title={t('map.locationOnlyTitle')}
          action={
            role === 'patient' && (
              <ButtonLink to={PATHS.assistance} variant="secondary">
                {t('waiting.askStaff')}
              </ButtonLink>
            )
          }
        >
          {t('map.locationOnlyBody')}
        </Notice>
      </div>

      {planner}

      {content}

      {navigating && route && (
        <NavigationBar route={route} activeStep={manualStep} onGoToStep={goToStep} onArrived={markArrived} onStop={stopNavigation} />
      )}

      {simulating && route && (
        <SimulationBar
          route={route}
          snapshot={sim}
          rate={simulation.rate}
          onPause={simulationHandlers.onPause}
          onResume={simulationHandlers.onResume}
          onRestart={simulationHandlers.onRestart}
          onExit={simulationHandlers.onExit}
          onRateChange={simulationHandlers.onRateChange}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </Container>
  );
}

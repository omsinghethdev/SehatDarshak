import { ArrowLeft, ArrowRight, CheckCircle2, Footprints, ListOrdered, MapPin, Play, Square } from 'lucide-react';
import { Button, ButtonLink } from '../../components/common/Button';
import { ErrorState } from '../../components/feedback/ErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { Notice } from '../../components/feedback/Notice';
import { useTranslation } from '../../hooks/useTranslation';
import { tokenStatusPath } from '../../routes/paths';
import { API_ERROR_CODES } from '../../services/apiClient';
import { cn } from '../../utils/cn';
import { describeStep, routeSummary } from './routeInstructions';
import { SIMULATION_CONFIG } from './routeSimulation';
import { SimulationBadge, SimulationControls } from './SimulationPanel';

function StepControls({ route, activeStep, onGoToStep, onArrived, onStop, compact = false }) {
  const { t } = useTranslation();
  const total = route.steps.length;
  const step = route.steps[activeStep];
  const last = activeStep === total - 1;
  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      <p className="text-sm font-semibold tracking-wide text-blue-800 uppercase">
        {t('directions.stepOf', { current: activeStep + 1, total })}
      </p>
      <p className={cn('font-semibold text-slate-900', compact ? 'text-base' : 'text-lg')}>{describeStep(step, route, t)}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => activeStep > 0 && onGoToStep(activeStep - 1)} aria-disabled={activeStep === 0 || undefined}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t('directions.previous')}
        </Button>
        {last ? (
          <Button onClick={onArrived} data-nav-focus>
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {t('directions.arrivedButton')}
          </Button>
        ) : (
          <Button onClick={() => onGoToStep(activeStep + 1)} data-nav-focus>
            {t('directions.next')}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        )}
        <Button variant="ghost" onClick={onStop}>
          <Square aria-hidden="true" className="size-4" />
          {t('directions.stopNavigation')}
        </Button>
      </div>
    </div>
  );
}

/**
 * Fixed bottom bar for small screens while navigating, so the current instruction and its
 * controls stay in reach while the patient looks at the map. Larger screens use the panel.
 */
export function NavigationBar(props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-blue-700 bg-white px-4 py-3 shadow-[0_-4px_16px_rgb(15_23_42/0.12)] lg:hidden">
      <StepControls {...props} compact />
    </div>
  );
}

/**
 * Route summary and directions. `routeState` is one of:
 *   { status: 'needStart', reason? } · { status: 'loading' } · { status: 'error', error, retry } ·
 *   { status: 'success', route }
 * Two ways to follow a route, neither of which detects the patient's position: simulated
 * navigation (`simulation`: a dot moves along the route by itself) and manual step by step.
 * `simulation` is { snapshot, rate, onStart, onPause, onResume, onRestart, onExit, onRateChange }.
 */
export function RoutePanel({ routeState, toPlace, avoidStairs, activeStep, arrived, onStart, onStop, onGoToStep, onArrived, tokenId, simulation }) {
  const { t } = useTranslation();

  if (routeState.status === 'needStart' && routeState.reason === 'noDefault') {
    return (
      <Notice tone="warning" title={t('directions.simulation.startUnresolvedTitle')}>
        {t('directions.simulation.startUnresolvedBody')}
      </Notice>
    );
  }
  if (routeState.status === 'needStart') {
    return (
      <div className="rounded-xl border border-dashed border-line bg-white p-5 text-slate-700">
        <p className="flex items-start gap-3">
          <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-red-700" />
          {t('directions.needStart', { place: toPlace.displayName })}
        </p>
      </div>
    );
  }
  if (routeState.status === 'loading') return <LoadingState label={t('directions.routeLoading')} />;
  if (routeState.status === 'error') {
    if (routeState.error?.code === API_ERROR_CODES.NO_ROUTE) {
      return (
        <Notice tone="warning" title={t('directions.noRouteTitle')}>
          {avoidStairs ? t('directions.noRouteStairsBody') : t('directions.noRouteBody')}
        </Notice>
      );
    }
    return <ErrorState error={routeState.error} onRetry={routeState.retry} />;
  }

  const { route } = routeState;
  const summary = routeSummary(route, t);
  const navigating = activeStep !== null && !arrived;
  const snapshot = simulation?.snapshot;
  const simulating = Boolean(snapshot) && (snapshot.status === 'running' || snapshot.status === 'paused');
  const currentIndex = simulating ? snapshot.position.stepIndex : navigating ? activeStep : null;

  return (
    <section aria-labelledby="route-heading" className="space-y-5 rounded-xl border-2 border-blue-700 bg-white p-5">
      <div>
        <h2 id="route-heading" className="flex items-center gap-2 text-xl font-bold text-slate-900">
          <Footprints aria-hidden="true" className="size-5 text-blue-700" />
          {t('directions.routeTitle')}
        </h2>
        <p className="mt-1 text-slate-700">{t('directions.routeFromTo', { from: route.from.displayName, to: route.to.displayName })}</p>
        <p className="mt-3 text-lg font-semibold text-slate-900">
          {summary.distance} · {summary.time}
        </p>
        <p className="text-sm text-slate-700">{t('directions.floorsUsed', { floors: route.floors.map((floor) => floor.displayName).join(', ') })}</p>
        <p className="mt-2 text-sm text-slate-600">
          {simulating
            ? t('directions.simulation.estimateNote', { speed: SIMULATION_CONFIG.walkingMetresPerSecond })
            : t('directions.estimateNote')}
        </p>
      </div>

      {arrived && (
        <Notice
          tone="success"
          title={t('directions.arrivedTitle', { place: route.to.displayName })}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onStop} data-nav-focus>
                {t('directions.done')}
              </Button>
              {tokenId && (
                <ButtonLink to={tokenStatusPath(tokenId)}>
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  {t('directions.backToToken')}
                </ButtonLink>
              )}
            </div>
          }
        >
          {t('directions.arrivedBody')}
        </Notice>
      )}

      {!navigating && !arrived && !simulating && (
        <div className="space-y-3">
          {simulation && (
            <>
              <Button onClick={simulation.onStart} className="w-full" data-nav-focus>
                <Play aria-hidden="true" className="size-4" />
                {t('directions.simulation.start')}
              </Button>
              <p className="text-sm text-slate-600">
                <SimulationBadge className="mb-1 text-xs" />
                <span className="block">{t('directions.simulation.explanation')}</span>
              </p>
            </>
          )}
          <Button variant={simulation ? 'secondary' : 'primary'} onClick={onStart} className="w-full" data-nav-focus={simulation ? undefined : true}>
            <ListOrdered aria-hidden="true" className="size-4" />
            {simulation ? t('directions.simulation.manual') : t('directions.startNavigation')}
          </Button>
        </div>
      )}

      {simulating && (
        <div className="hidden rounded-lg bg-blue-50 p-4 lg:block">
          <SimulationControls
            route={route}
            snapshot={snapshot}
            rate={simulation.rate}
            onPause={simulation.onPause}
            onResume={simulation.onResume}
            onRestart={simulation.onRestart}
            onExit={simulation.onExit}
            onRateChange={simulation.onRateChange}
          />
          <p className="mt-3 text-sm text-slate-700">{t('directions.simulation.explanation')}</p>
        </div>
      )}

      {navigating && (
        <div className="hidden rounded-lg bg-blue-50 p-4 lg:block">
          <StepControls route={route} activeStep={activeStep} onGoToStep={onGoToStep} onArrived={onArrived} onStop={onStop} />
        </div>
      )}

      <div>
        <h3 className="font-semibold text-slate-900">{t('directions.stepsTitle')}</h3>
        <ol className="mt-2 space-y-2">
          {route.steps.map((step, index) => {
            const current = index === currentIndex;
            return (
              <li
                key={step.index}
                aria-current={current ? 'step' : undefined}
                className={cn('flex gap-3 rounded-lg border p-3', current ? 'border-2 border-blue-700 bg-blue-50' : 'border-line')}
              >
                <span aria-hidden="true" className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold', current ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-800')}>
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-slate-900">{describeStep(step, route, t)}</span>
                  <button
                    type="button"
                    onClick={() => onGoToStep(index)}
                    className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 underline underline-offset-4"
                  >
                    {t('directions.showStep')}
                    <span className="sr-only"> — {t('directions.stepOf', { current: index + 1, total: route.steps.length })}</span>
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

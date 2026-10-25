import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { describeStep } from './routeInstructions';
import { SIMULATION_CONFIG } from './routeSimulation';

function floorName(route, floorId) {
  return route.floors?.find((floor) => floor.id === floorId)?.displayName ?? floorId;
}

/** The label shown wherever the moving dot is: it is a simulation, not the patient's location. */
export function SimulationBadge({ className }) {
  const { t } = useTranslation();
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border border-blue-700 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-900', className)}>
      <span aria-hidden="true" className="size-2.5 rounded-full bg-blue-700" />
      {t('directions.simulation.label')}
    </span>
  );
}

/** "Now" sentence: the step being followed, or the lift/stairs being used. */
export function currentInstruction(route, position, t) {
  const { transition } = position;
  if (transition) {
    const key = transition.kind === 'lift' ? 'inLift' : 'onStairs';
    return t(`directions.simulation.${key}`, { floor: floorName(route, transition.toFloorId) });
  }
  return describeStep(route.steps[position.stepIndex], route, t);
}

function remainingText(position, t) {
  const distance = t('directions.simulation.distanceLeft', { distance: Math.max(0, Math.round(position.remainingMetres)) });
  const minutes = Math.ceil(position.remainingSeconds / 60);
  const time = position.remainingSeconds < 60 ? t('directions.simulation.timeLeftShort') : t('directions.simulation.timeLeft', { count: minutes });
  return `${distance} · ${time}`;
}

/**
 * Live status and controls for simulated navigation. The instruction area keeps a fixed minimum
 * height so text changes do not shift the layout. Screen-reader announcements are made by the
 * page for important events only; nothing here is a live region (it changes many times a second).
 */
export function SimulationControls({ route, snapshot, rate, onPause, onResume, onRestart, onExit, onRateChange, compact = false }) {
  const { t } = useTranslation();
  const { status, position } = snapshot;
  const running = status === 'running';
  const next = route.steps[position.stepIndex + 1];
  const percent = Math.round(position.progress * 100);
  let statusText = t('directions.simulation.moving');
  if (status === 'paused') statusText = snapshot.pausedByHidden ? t('directions.simulation.pausedHidden') : t('directions.simulation.paused');

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SimulationBadge className={compact ? 'text-xs' : undefined} />
        <span className="text-sm font-semibold text-slate-700">{statusText}</span>
      </div>

      <div className={compact ? 'min-h-12' : 'min-h-20'}>
        <p className="text-sm font-semibold tracking-wide text-blue-800 uppercase">{t('directions.simulation.now')}</p>
        <p className={cn('font-semibold text-slate-900', compact ? 'text-base' : 'text-lg')}>{currentInstruction(route, position, t)}</p>
        {!compact && next && (
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-semibold">{t('directions.simulation.next')}:</span> {describeStep(next, route, t)}
          </p>
        )}
      </div>

      <div>
        <div
          role="progressbar"
          aria-label={t('directions.simulation.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2.5 overflow-hidden rounded-full bg-slate-200"
        >
          <div className="h-full rounded-full bg-blue-700" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-sm text-slate-700 tabular-nums">{remainingText(position, t)}</p>
      </div>

      <div className={cn('flex gap-2', compact ? 'flex-nowrap' : 'flex-wrap')}>
        {running ? (
          <Button variant="secondary" onClick={onPause} data-nav-focus>
            <Pause aria-hidden="true" className="size-4" />
            {t('directions.simulation.pause')}
          </Button>
        ) : (
          <Button onClick={onResume} data-nav-focus>
            <Play aria-hidden="true" className="size-4" />
            {t('directions.simulation.resume')}
          </Button>
        )}
        <Button variant="secondary" onClick={onRestart}>
          <RotateCcw aria-hidden="true" className="size-4" />
          {t('directions.simulation.restart')}
        </Button>
        <Button variant="ghost" onClick={onExit}>
          <Square aria-hidden="true" className="size-4" />
          {compact ? t('directions.simulation.exitShort') : t('directions.simulation.exit')}
        </Button>
      </div>

      {!compact && (
        <div role="group" aria-labelledby="simulation-speed-label" className="flex flex-wrap items-center gap-2">
          <span id="simulation-speed-label" className="text-sm font-semibold text-slate-900">
            {t('directions.simulation.speed')}
          </span>
          {SIMULATION_CONFIG.playbackRates.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={option === rate}
              onClick={() => onRateChange(option)}
              className={cn(
                'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 font-semibold',
                option === rate ? 'border-blue-800 bg-blue-800 text-white' : 'border-slate-400 bg-white text-slate-800 hover:border-blue-700 hover:bg-blue-50',
              )}
            >
              {t('directions.simulation.speedOption', { rate: option })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Fixed bottom bar for small screens while the simulation runs; larger screens use the panel. */
export function SimulationBar(props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-blue-700 bg-white px-4 py-3 shadow-[0_-4px_16px_rgb(15_23_42/0.12)] lg:hidden">
      <SimulationControls {...props} compact />
    </div>
  );
}

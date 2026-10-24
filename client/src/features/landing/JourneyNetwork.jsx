import { useEffect, useId, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { FULL_ROUTE, LINKS, PATIENTS, PLACES, QUEUE, ROUTE, STAGES, VIEWBOX, pointOf } from './journeyGeometry';
import './landing.css';

/*
 * "From confusion to clarity": an abstract network that starts busy and uncertain, then a single
 * route connects it (about 7 seconds), and settles into a quiet loop. It is an illustration, not
 * live data, and says so. All timing lives in landing.css; this component only renders the
 * composition and handles highlighting, replay, and pause.
 *
 * - `intro`: play the opening sequence (otherwise start from the settled composition).
 * - `reducedMotion`: no motion at all; the settled composition is shown complete and still.
 * The journey steps beside it are real buttons, so every highlight is reachable by keyboard and
 * screen reader; hovering points in the drawing is a mouse-only extra.
 */
export function JourneyNetwork({ intro, reducedMotion }) {
  const { t } = useTranslation();
  const [run, setRun] = useState(0);
  const [playIntro, setPlayIntro] = useState(intro);
  const [paused, setPaused] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [preview, setPreview] = useState(null);
  const rootRef = useRef(null);
  const svgRef = useRef(null);
  const captionId = useId();
  const motion = !reducedMotion;
  const active = preview ?? pinned;

  // Pause while the hero is scrolled out of view (saves work), and whenever the user paused.
  const [offscreen, setOffscreen] = useState(false);
  useEffect(() => {
    if (!motion || !rootRef.current || !('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [motion]);
  const halted = paused || offscreen;
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg?.pauseAnimations) return;
    if (halted) svg.pauseAnimations();
    else svg.unpauseAnimations();
  }, [halted, run]);

  function replay() {
    setPaused(false);
    setPlayIntro(true);
    setRun((value) => value + 1);
  }

  const stageButton = (stage) => (
    <button
      type="button"
      aria-pressed={pinned === stage.id}
      onClick={() => setPinned((current) => (current === stage.id ? null : stage.id))}
      onPointerEnter={(event) => event.pointerType === 'mouse' && setPreview(stage.id)}
      onPointerLeave={() => setPreview(null)}
      onFocus={() => setPreview(stage.id)}
      onBlur={() => setPreview(null)}
      className="jn-stage inline-flex min-h-11 items-center rounded-full border px-3 text-sm font-semibold"
    >
      {t(stage.labelKey)}
      <span className="sr-only">: {t(stage.descriptionKey)}</span>
    </button>
  );

  const labelPosition = (place) => {
    if (place.labelSide === 'left') return { x: place.x - 22, y: place.y + 4, anchor: 'end' };
    if (place.labelSide === 'right') return { x: place.x + 22, y: place.y + 4, anchor: 'start' };
    return { x: place.x, y: place.y - 26, anchor: 'middle' };
  };

  return (
    <figure
      ref={rootRef}
      data-active={active ?? undefined}
      className={cn('jn', motion && 'jn-motion', motion && playIntro && 'jn-intro', halted && 'jn-paused')}
    >
      <svg
        key={run}
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="img"
        aria-labelledby={captionId}
        className="jn-canvas"
      >
        <g className="jn-links">
          {LINKS.map((link, index) => {
            const from = pointOf(link.from);
            const to = pointOf(link.to);
            return (
              <line
                key={`${link.from}-${link.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                pathLength="1"
                className={cn('jn-link', link.breaks && 'jn-break', link.extra && 'jn-extra')}
                style={{ '--d': `${index * 35}ms` }}
              />
            );
          })}
        </g>

        <g className="jn-dots">
          {PATIENTS.map((patient, index) => (
            <circle
              key={patient.id}
              cx={patient.x}
              cy={patient.y}
              r="3.4"
              className={cn('jn-dot', patient.extra && 'jn-extra', index % 4 === 0 && 'jn-dot-float')}
              style={{ '--wx': `${patient.wx}px`, '--wy': `${patient.wy}px`, '--d': `${120 + index * 30}ms` }}
            />
          ))}
        </g>

        <path d={ROUTE.find} pathLength="1" className="jn-route jn-route-find" />
        <path d={ROUTE.help} pathLength="1" className="jn-route jn-route-help" />
        <path id={`${captionId}-route`} d={FULL_ROUTE} className="jn-route-guide" />

        <g className="jn-queue">
          {QUEUE.map((chip, index) => (
            <rect
              key={chip.x}
              x={chip.x - 6}
              y={chip.y - 4}
              width="12"
              height="8"
              rx="2.5"
              className={cn('jn-chip', chip.extra && 'jn-extra')}
              style={{ '--sx': `${chip.sx}px`, '--sy': `${chip.sy}px`, '--sr': `${chip.sr}deg`, '--d': `${index * 60}ms` }}
            />
          ))}
        </g>

        {PLACES.map((place, index) => {
          const label = place.labelKey && labelPosition(place);
          const isPrimary = place.id === 'opd';
          return (
            <g
              key={place.id}
              className={cn('jn-place', `jn-place-${place.kind}`, place.stage && `jn-stage-${place.stage}`, place.extra && 'jn-extra')}
              style={{ '--d': `${80 + index * 70}ms` }}
              onPointerEnter={(event) => place.stage && event.pointerType === 'mouse' && setPreview(place.stage)}
              onPointerLeave={() => place.stage && setPreview(null)}
            >
              {place.kind === 'destination' && (
                <circle cx={place.x} cy={place.y} r="17" className={cn('jn-dest-ring', isPrimary && 'jn-dest-primary')} />
              )}
              {place.kind === 'start' ? (
                <rect x={place.x - 6} y={place.y - 6} width="12" height="12" rx="3" className="jn-start" />
              ) : (
                <circle cx={place.x} cy={place.y} r={place.kind === 'destination' ? 8 : 6.5} className="jn-node" />
              )}
              {place.kind === 'destination' && (
                <circle cx={place.x} cy={place.y} r="24" className="jn-hit" />
              )}
              {label && (
                <text x={label.x} y={label.y} textAnchor={label.anchor} className={cn('jn-label', `jn-label-${place.stage}`, isPrimary && 'jn-label-primary')}>
                  {t(place.labelKey)}
                </text>
              )}
            </g>
          );
        })}

        {motion && (
          <circle r="5" className="jn-pulse" opacity="0">
            <animateMotion dur="6s" begin={playIntro ? '6.6s' : '0.8s'} repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.72;1" calcMode="linear">
              <mpath href={`#${captionId}-route`} />
            </animateMotion>
            <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.06;0.66;0.72;1" dur="6s" begin={playIntro ? '6.6s' : '0.8s'} repeatCount="indefinite" />
          </circle>
        )}
      </svg>

      <figcaption id={captionId} className="sr-only">{t('home.journey.description')}</figcaption>

      <ol aria-label={t('home.journey.stagesLabel')} className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {STAGES.map((stage, index) => (
          <li key={stage.id} className="flex items-center gap-1.5">
            {index > 0 && <span aria-hidden="true" className="text-slate-500">→</span>}
            {stageButton(stage)}
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-600">{t('home.journey.illustrationNote')}</p>
        {motion && (
          <div className="flex gap-1">
            <button type="button" onClick={() => setPaused((value) => !value)} className="jn-control inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-700">
              {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
              {paused ? t('home.journey.play') : t('home.journey.pause')}
            </button>
            <button type="button" onClick={replay} className="jn-control inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-700">
              <RotateCcw aria-hidden="true" className="size-4" />
              {t('home.journey.replay')}
            </button>
          </div>
        )}
      </div>
    </figure>
  );
}

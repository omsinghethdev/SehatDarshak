import { Clock } from 'lucide-react';
import { useInView } from '../../hooks/useInView';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import './landing.css';

/*
 * Small illustrations for the landing-page story sections. Each plays once when scrolled into
 * view (motion users only) and is otherwise shown complete. They are illustrations: every value
 * shown is fixed example content, and the queue example says so in text.
 */

function Stage({ reducedMotion, label, className, children }) {
  const [ref, inView] = useInView();
  return (
    <div ref={ref} className={cn('ln', !reducedMotion && 'ln-motion', !reducedMotion && inView && 'ln-play', className)}>
      <div role="img" aria-label={label}>{children}</div>
    </div>
  );
}

const delay = (ms) => ({ '--ln-delay': `${ms}ms` });

/** Section A: corridors, a start point, and a route drawn to the destination. */
export function RouteIllustration({ reducedMotion }) {
  const { t } = useTranslation();
  return (
    <Stage reducedMotion={reducedMotion} label={t('home.story.find.illustration')}>
      <svg viewBox="0 0 360 260" aria-hidden="true">
        {/* Corridors */}
        <path className="ln-grid" d="M30 210 H330 M30 135 H330 M60 60 H330 M70 60 V230 M190 50 V230 M300 50 V230" />
        {/* Rooms along the corridors */}
        {[[110, 95], [150, 95], [230, 95], [250, 172], [110, 172], [150, 172], [230, 30], [120, 30]].map(([x, y], index) => (
          <rect key={index} x={x} y={y} width="26" height="18" rx="4" className="ln-token ln-appear" style={delay(150 + index * 40)} />
        ))}
        <path className="ln-path ln-draw" pathLength="1" d="M40 210 H190 V135 H300 V60" style={delay(500)} />
        <rect x="30" y="200" width="20" height="20" rx="5" fill="var(--ln-ink)" />
        <text x="30" y="246" className="ln-muted">{t('home.story.find.entrance')}</text>
        <circle cx="300" cy="60" r="19" className="ln-ring ln-anim ln-appear" style={delay(1900)} />
        <circle cx="300" cy="60" r="8" className="ln-node ln-node-green" />
        <text x="300" y="26" textAnchor="middle" className="ln-text ln-appear" style={delay(2000)}>{t('home.story.find.destination')}</text>
      </svg>
    </Stage>
  );
}

const TOKENS = [
  { label: 'OPD-097', lx: '-30px', ly: '46px', lr: '-14deg' },
  { label: 'OPD-098', lx: '24px', ly: '64px', lr: '10deg' },
  { label: 'OPD-099', lx: '-12px', ly: '30px', lr: '18deg' },
  { label: 'OPD-100', lx: '34px', ly: '52px', lr: '-9deg' },
  { label: 'OPD-101', lx: '-20px', ly: '70px', lr: '12deg', you: true },
];

/** Section B: queue tokens lining up, with a representative token and a labelled estimate. */
export function QueueIllustration({ reducedMotion }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Stage reducedMotion={reducedMotion} label={t('home.story.queue.illustration')}>
        <svg viewBox="0 0 360 120" aria-hidden="true">
          <line x1="16" y1="60" x2="344" y2="60" className="ln-faint" strokeDasharray="3 5" />
          {TOKENS.map((token, index) => (
            <g key={token.label} className="ln-anim ln-line-up" style={{ '--lx': token.lx, '--ly': token.ly, '--lr': token.lr, ...delay(200 + index * 130) }}>
              <rect x={14 + index * 68} y="38" width="60" height="44" rx="8" className={cn('ln-token', token.you && 'ln-token-you')} />
              <text x={44 + index * 68} y="65" textAnchor="middle" className={token.you ? 'ln-text' : 'ln-muted'}>{token.label}</text>
            </g>
          ))}
        </svg>
      </Stage>
      <div className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-600">{t('home.story.queue.yourToken')}</p>
          <p className="text-xs font-medium text-slate-600">{t('home.story.queue.exampleNote')}</p>
        </div>
        <p className="text-4xl font-semibold tracking-tight text-[#17221d]">OPD-101</p>
        <p className="mt-3 font-semibold text-slate-900">{t('home.story.queue.ahead')}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-700">
          <Clock aria-hidden="true" className="size-4" />
          {t('home.story.queue.estimate')}
          <span className="rounded border border-line bg-canvas-muted px-1.5 text-xs font-medium text-slate-700">{t('home.story.queue.simulated')}</span>
        </p>
      </div>
    </div>
  );
}

/** Section C: a request travels from the patient to staff, and the acknowledgement comes back. */
export function AssistIllustration({ reducedMotion }) {
  const { t } = useTranslation();
  return (
    <Stage reducedMotion={reducedMotion} label={t('home.story.help.illustration')}>
      <svg viewBox="0 0 360 230" aria-hidden="true">
        {[[40, 40], [320, 40], [40, 190], [320, 190], [180, 210]].map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r="4" fill="var(--ln-ink)" opacity="0.35" />
        ))}
        <path className="ln-faint" d="M40 40 L70 115 L40 190 M320 40 L290 115 L320 190" />
        <path className="ln-path ln-draw" pathLength="1" d="M70 115 C 120 50, 240 50, 290 115" style={delay(300)} />
        <path className="ln-path ln-draw" pathLength="1" d="M290 115 C 240 180, 120 180, 70 115" style={{ ...delay(1500), stroke: 'var(--ln-sage)' }} />
        <circle cx="70" cy="115" r="20" className="ln-node" />
        <circle cx="290" cy="115" r="20" className="ln-node ln-node-green" />
        <text x="70" y="157" textAnchor="middle" className="ln-text">{t('home.story.help.you')}</text>
        <text x="290" y="157" textAnchor="middle" className="ln-text">{t('home.story.help.staff')}</text>
        <g className="ln-anim ln-appear" style={delay(1100)}>
          <rect x="128" y="44" width="104" height="28" rx="14" fill="#fff" stroke="var(--ln-green)" strokeWidth="1.5" />
          <text x="180" y="63" textAnchor="middle" className="ln-muted">{t('home.story.help.request')}</text>
        </g>
        <g className="ln-anim ln-appear" style={delay(2600)}>
          <rect x="120" y="158" width="120" height="28" rx="14" fill="var(--ln-green)" />
          <text x="180" y="177" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="600">{t('home.story.help.acknowledged')}</text>
        </g>
      </svg>
    </Stage>
  );
}

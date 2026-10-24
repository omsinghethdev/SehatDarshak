import {
  Accessibility,
  ArrowRight,
  Building2,
  Clock,
  HandHelping,
  Hourglass,
  Keyboard,
  Languages,
  LayoutDashboard,
  ListOrdered,
  LogIn,
  Map as MapIcon,
  MapPin,
  ShieldCheck,
  Smartphone,
  Ticket,
  Type,
  Users,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { Notice } from '../components/feedback/Notice';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLandingReveal } from '../hooks/useLandingReveal';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';
import { cn } from '../utils/cn';

// Text lives in the dictionaries under home.*; only icons and keys are listed here.
const FEATURES = [
  { icon: Ticket, key: 'tokens' },
  { icon: Hourglass, key: 'tracking' },
  { icon: MapIcon, key: 'maps' },
  { icon: HandHelping, key: 'help' },
  { icon: Languages, key: 'languages' },
  { icon: Accessibility, key: 'accessible' },
];

const STEPS = [
  { icon: LogIn, key: 'register' },
  { icon: Building2, key: 'department' },
  { icon: Ticket, key: 'token' },
  { icon: MapPin, key: 'track' },
];

const ACCESS_POINTS = [
  { icon: Languages, key: 'language' },
  { icon: Type, key: 'reading' },
  { icon: Keyboard, key: 'keyboard' },
  { icon: Smartphone, key: 'touch' },
  { icon: Volume2, key: 'listen' },
  { icon: HandHelping, key: 'assistance' },
];

const STAFF_POINTS = [
  { icon: ListOrdered, key: 'staff' },
  { icon: LayoutDashboard, key: 'admin' },
];

function SectionHeading({ id, eyebrow, title, description }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">{eyebrow}</p>
      <h2 id={id} className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      {description && <p className="mt-3 text-lg text-slate-700">{description}</p>}
    </div>
  );
}

const CARD = 'rounded-xl border border-line bg-white shadow-raised';

/**
 * Illustrative example of a visit: the token, where to go, and the queue position. All values
 * are fixed demo content, and the caption says so. When `animate` is set (first landing only),
 * the cards enter in turn, drift once, and the status badge pulses; see "Floating token cards"
 * in styles/index.css. On small screens the side cards stack below the token instead of floating.
 */
function ExampleVisit({ animate }) {
  const { t } = useTranslation();
  const motion = (name) => (animate ? `float-card float-card-${name}` : undefined);
  const stageRef = useRef(null);
  const frame = useRef(0);

  // Mouse parallax: the cards shift slightly towards the pointer, each by its own depth. Only
  // CSS custom properties change here (no re-render); styles/index.css applies them only for
  // hover-capable pointers without a reduced-motion preference.
  function setPointer(x, y) {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      stageRef.current?.style.setProperty('--px', x.toFixed(3));
      stageRef.current?.style.setProperty('--py', y.toFixed(3));
    });
  }
  function handlePointerMove(event) {
    if (event.pointerType !== 'mouse' || !stageRef.current) return;
    const box = stageRef.current.getBoundingClientRect();
    const clamp = (value) => Math.max(-1, Math.min(1, value));
    setPointer(clamp(((event.clientX - box.left) / box.width) * 2 - 1), clamp(((event.clientY - box.top) / box.height) * 2 - 1));
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <figure className="mx-auto w-full max-w-lg" onPointerMove={handlePointerMove} onPointerLeave={() => setPointer(0, 0)}>
      <div ref={stageRef} className="parallax-stage relative sm:pt-18 sm:pr-6 sm:pb-24 sm:pl-10">
        <div className={cn(CARD, 'parallax-card parallax-depth-1 p-6 sm:p-8', motion('token'))}>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-slate-600">Demo OPD</p>
            <span
              className={cn(
                'relative rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800',
                animate && 'status-pulse',
              )}
            >
              {t('status.waiting.label')}
            </span>
          </div>
          <p className="mt-4 text-sm text-slate-600">{t('home.example.yourToken')}</p>
          <p className="text-5xl font-bold tracking-tight text-slate-900">OPD-101</p>
        </div>

        <div className={cn(CARD, 'parallax-card parallax-depth-2 mt-3 flex items-center gap-3 p-4 sm:absolute sm:top-0 sm:left-0 sm:mt-0 sm:w-60', motion('place'))}>
          <span className="hover-icon flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <MapPin aria-hidden="true" className="size-5 text-brand-700" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="text-slate-600">{t('home.example.whereToGo')}</p>
            <p className="font-semibold text-slate-900">{t('home.example.place')}</p>
            <p className="text-slate-600">{t('home.example.floor')}</p>
          </div>
        </div>

        <div className={cn(CARD, 'parallax-card parallax-depth-3 mt-3 flex items-start gap-3 p-4 sm:absolute sm:right-0 sm:bottom-0 sm:mt-0 sm:w-72', motion('queue'))}>
          <span className="hover-icon flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50">
            <Users aria-hidden="true" className="size-5 text-brand-700" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-slate-900">{t('alerts.approaching.ahead', { count: 4 })}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-700">
              <Clock aria-hidden="true" className="size-4" />
              {t('estimate.aboutMinutes', { count: 20 })}
              <span className="rounded bg-canvas-muted px-1.5 text-xs font-medium text-slate-600">
                {t('queue.simulatedEstimate')}
              </span>
            </p>
          </div>
        </div>
      </div>

      <figcaption className="mt-4 rounded-lg bg-canvas-muted px-3 py-2 text-sm text-slate-700">
        {t('home.example.caption')}
      </figcaption>
    </figure>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('home.documentTitle'));
  const { isAuthenticated } = useAuth();
  // Opening reveal: staggered rise for the hero text, then the example card (CSS in styles/index.css).
  const reveal = useLandingReveal();
  const riseClass = reveal ? 'intro-rise' : undefined;
  const riseDelay = (ms) => (reveal ? { '--intro-delay': `${ms}ms` } : undefined);

  return (
    <>
      <section aria-labelledby="hero-heading" className="border-b border-line">
        <Container className="grid items-center gap-12 pt-10 pb-14 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:py-24">
          <div>
            <p
              className={cn(
                'inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800',
                riseClass,
              )}
              style={riseDelay(0)}
            >
              <ShieldCheck aria-hidden="true" className="size-4" />
              {t('home.badge')}
            </p>
            {/* Balanced wrapping avoids a one-word last line; Devanagari needs more line height
                and normal tracking so matras and conjuncts never touch the line above. */}
            <h1
              id="hero-heading"
              className={cn(
                'mt-5 max-w-2xl text-[2.25rem] leading-[1.1] font-bold tracking-tight text-balance text-slate-900 sm:text-5xl sm:leading-[1.06] xl:text-[3.25rem]',
                '[&:lang(hi)]:leading-[1.3] [&:lang(hi)]:tracking-normal',
                riseClass,
              )}
              style={riseDelay(80)}
            >
              {t('home.title')}
            </h1>
            <p
              className={cn('mt-5 max-w-[36rem] text-[1.0625rem] leading-relaxed text-pretty text-slate-700 sm:text-lg', riseClass)}
              style={riseDelay(160)}
            >
              {t('home.intro')}
            </p>
            <div className={cn('mt-8 flex flex-col gap-3 sm:flex-row sm:items-center', riseClass)} style={riseDelay(240)}>
              {isAuthenticated ? (
                <ButtonLink to={PATHS.dashboard} className="landing-cta min-h-12 px-6 shadow-raised">
                  {t('home.goToDashboard')}
                  <ArrowRight aria-hidden="true" className="landing-cta-arrow size-5" />
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to={PATHS.registerPatient} className="landing-cta min-h-12 px-6 shadow-raised">
                    {t('auth.registerTitle')}
                    <ArrowRight aria-hidden="true" className="landing-cta-arrow size-5" />
                  </ButtonLink>
                  <ButtonLink to={PATHS.login} variant="secondary" className="landing-cta min-h-12 px-6">
                    {t('layout.signIn')}
                  </ButtonLink>
                </>
              )}
            </div>
            <LanguageSelector className="mt-8 flex-wrap" />
          </div>

          <ExampleVisit animate={reveal} />
        </Container>
      </section>

      <section id="features" tabIndex={-1} aria-labelledby="features-heading" className="py-16 sm:py-24">
        <Container>
          <SectionHeading
            id="features-heading"
            eyebrow={t('nav.features')}
            title={t('home.features.title')}
            description={t('home.features.description')}
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, key }) => (
              // On phones the icon sits beside the text, so six cards don't make a very long column.
              <li key={key} className="hover-card flex gap-4 rounded-xl border border-line bg-white p-5 sm:block sm:p-6">
                <span className="hover-icon flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                  <Icon aria-hidden="true" className="size-6 text-brand-700" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900 sm:mt-4">{t(`home.features.${key}.title`)}</h3>
                  <p className="mt-1 text-slate-700 sm:mt-2">{t(`home.features.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section
        id="how-it-works"
        tabIndex={-1}
        aria-labelledby="how-heading"
        className="border-y border-line bg-canvas-muted py-16 sm:py-24"
      >
        <Container>
          <SectionHeading
            id="how-heading"
            eyebrow={t('nav.howItWorks')}
            title={t('home.steps.title')}
            description={t('home.steps.description')}
          />
          {/* A vertical timeline on small screens and a horizontal one on wide screens. The order
              is carried by the <ol> and the visible step numbers, not by colour. */}
          <ol className="mt-10 grid lg:grid-cols-4 lg:gap-8">
            {STEPS.map(({ icon: Icon, key }, index) => {
              const last = index === STEPS.length - 1;
              return (
                <li key={key} className={cn('hover-step flex gap-4 lg:flex-col lg:gap-5', !last && 'pb-8 lg:pb-0')}>
                  <div className="flex flex-col items-center lg:flex-row">
                    <span
                      aria-hidden="true"
                      className="hover-step-number flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white"
                    >
                      {index + 1}
                    </span>
                    {!last && (
                      <span aria-hidden="true" className="mt-2 w-px flex-1 bg-brand-200 lg:mt-0 lg:ml-4 lg:h-px lg:w-auto" />
                    )}
                  </div>
                  <div className="min-w-0 pt-1.5 lg:pt-0">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                      <Icon aria-hidden="true" className="hover-step-icon size-5 shrink-0 text-brand-700" />
                      <span>
                        <span className="sr-only">{t('home.steps.stepLabel', { number: index + 1 })} </span>
                        {t(`home.steps.${key}.title`)}
                      </span>
                    </h3>
                    <p className="mt-1 text-slate-700">{t(`home.steps.${key}.description`)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-10 flex max-w-2xl items-start gap-2 text-sm text-slate-700">
            <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-700" />
            {t('home.steps.estimateNote')}
          </p>
        </Container>
      </section>

      <section id="accessibility" aria-labelledby="access-heading" className="py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <SectionHeading
              id="access-heading"
              eyebrow={t('home.access.eyebrow')}
              title={t('home.access.title')}
              description={t('home.access.description')}
            />
            <h3 id="notice-heading" className="sr-only">
              {t('home.notice.heading')}
            </h3>
            <Notice tone="warning" title={t('home.notice.title')} className="mt-8 max-w-xl">
              {t('home.notice.body')}
            </Notice>
          </div>
          <ul className="grid content-start gap-x-8 gap-y-7 sm:grid-cols-2">
            {ACCESS_POINTS.map(({ icon: Icon, key }) => (
              <li key={key} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <Icon aria-hidden="true" className="size-5 text-brand-700" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{t(`home.access.${key}.title`)}</h3>
                  <p className="mt-1 text-slate-700">{t(`home.access.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="staff-heading" className="border-y border-line bg-canvas-muted py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-2">
          <SectionHeading
            id="staff-heading"
            eyebrow={t('home.teams.eyebrow')}
            title={t('home.teams.title')}
            description={t('home.teams.description')}
          />
          <ul className="grid gap-4">
            {STAFF_POINTS.map(({ icon: Icon, key }) => (
              <li key={key} className="hover-card flex gap-4 rounded-xl border border-line bg-white p-5">
                <Icon aria-hidden="true" className="hover-icon mt-0.5 size-6 shrink-0 text-brand-700" />
                <div>
                  <h3 className="font-semibold text-slate-900">{t(`home.teams.${key}.title`)}</h3>
                  <p className="mt-1 text-slate-700">{t(`home.teams.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="cta-heading" className="py-16 sm:py-24">
        <Container>
          <div className="flex flex-col gap-8 rounded-2xl border border-brand-200 bg-brand-50 px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h2 id="cta-heading" className="text-3xl font-bold tracking-tight text-balance text-slate-900">
                {t('home.cta.title')}
              </h2>
              <p className="mt-3 text-lg text-pretty text-slate-700">
                {isAuthenticated ? t('home.cta.signedInDescription') : t('home.cta.description')}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <ButtonLink to={PATHS.dashboard} className="landing-cta min-h-12 px-6 shadow-raised">
                  {t('home.goToDashboard')}
                  <ArrowRight aria-hidden="true" className="landing-cta-arrow size-5" />
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to={PATHS.registerPatient} className="landing-cta min-h-12 px-6 shadow-raised">
                    {t('auth.registerTitle')}
                    <ArrowRight aria-hidden="true" className="landing-cta-arrow size-5" />
                  </ButtonLink>
                  <ButtonLink to={PATHS.login} variant="secondary" className="landing-cta min-h-12 px-6">
                    {t('layout.signIn')}
                  </ButtonLink>
                </>
              )}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}

import { ArrowDown, ArrowRight, Accessibility, Languages, LayoutDashboard, ListOrdered, QrCode } from 'lucide-react';
import { Link } from 'react-router';
import { ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { Notice } from '../components/feedback/Notice';
import { JourneyNetwork } from '../features/landing/JourneyNetwork';
import { AssistIllustration, QueueIllustration, RouteIllustration } from '../features/landing/StoryIllustrations';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useLandingReveal } from '../hooks/useLandingReveal';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';
import { cn } from '../utils/cn';

const INK = 'text-[#17221d]';
const EYEBROW = 'text-xs font-semibold tracking-[0.14em] text-brand-700 uppercase';

// Story sections: text keys under home.story.<key>; illustrations alternate sides on wide screens.
const STORY = [
  { key: 'find', Illustration: RouteIllustration, link: { to: PATHS.navigation, labelKey: 'home.story.find.link' } },
  { key: 'queue', Illustration: QueueIllustration },
  { key: 'help', Illustration: AssistIllustration },
];

const FEATURES = [
  { key: 'languages', icon: Languages },
  { key: 'qr', icon: QrCode },
  { key: 'staff', icon: ListOrdered },
  { key: 'admin', icon: LayoutDashboard },
];

function scrollToSection(event, id, reducedMotion) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  target.focus({ preventScroll: true });
  window.history.replaceState(window.history.state, '', `#${id}`);
}

function PrimaryCta({ isAuthenticated, className }) {
  const { t } = useTranslation();
  return (
    <ButtonLink to={isAuthenticated ? PATHS.dashboard : PATHS.registerPatient} className={cn('landing-cta px-6', className)}>
      {isAuthenticated ? t('home.goToDashboard') : t('home.hero.start')}
      <ArrowRight aria-hidden="true" className="landing-cta-arrow size-5" />
    </ButtonLink>
  );
}

function StorySection({ index, storyKey, Illustration, link, reducedMotion }) {
  const { t } = useTranslation();
  const flip = index % 2 === 1;
  return (
    <section aria-labelledby={`story-${storyKey}`} className="py-14 sm:py-20">
      <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={cn('max-w-xl', flip && 'lg:order-2 lg:justify-self-end')}>
          <p className={EYEBROW}>
            <span aria-hidden="true" className="mr-2 tabular-nums">0{index + 1}</span>
            {t(`home.story.${storyKey}.eyebrow`)}
          </p>
          <h3 id={`story-${storyKey}`} className={cn('mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl', INK)}>
            {t(`home.story.${storyKey}.title`)}
          </h3>
          <p className="mt-4 text-lg text-slate-700">{t(`home.story.${storyKey}.body`)}</p>
          <ul className="mt-6 space-y-2 border-l-2 border-brand-200 pl-4 text-slate-700">
            {['point1', 'point2', 'point3'].map((point) => (
              <li key={point}>{t(`home.story.${storyKey}.${point}`)}</li>
            ))}
          </ul>
          {link && (
            <Link to={link.to} className="mt-5 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-800 underline underline-offset-4">
              {t(link.labelKey)}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          )}
        </div>
        <div className={cn('mx-auto w-full max-w-md lg:max-w-lg', flip && 'lg:order-1')}>
          <Illustration reducedMotion={reducedMotion} />
        </div>
      </Container>
    </section>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('home.documentTitle'));
  const { isAuthenticated } = useAuth();
  const reducedMotion = useReducedMotion();
  // First open of the site on "/": hero text rises in and the journey network plays its opening
  // sequence. On later visits the network starts settled (it can be replayed).
  const reveal = useLandingReveal();
  const riseClass = reveal ? 'intro-rise' : undefined;
  const riseDelay = (ms) => (reveal ? { '--intro-delay': `${ms}ms` } : undefined);

  return (
    <>
      <section aria-labelledby="hero-heading" className="border-b border-line bg-[#f8f6f0]">
        <Container className="grid items-center gap-8 py-8 sm:gap-10 sm:py-10 md:grid-cols-[0.92fr_1.08fr] md:gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:py-8">
          <div className="max-w-xl">
            <p className={cn(EYEBROW, riseClass)} style={riseDelay(0)}>{t('home.hero.eyebrow')}</p>
            <h1
              id="hero-heading"
              className={cn('mt-5 text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.35rem]', INK, riseClass)}
              style={riseDelay(80)}
            >
              {t('home.hero.title')}
            </h1>
            <p className={cn('mt-5 text-lg text-slate-700', riseClass)} style={riseDelay(160)}>
              {t('home.hero.intro')}
            </p>
            <div className={cn('mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap', riseClass)} style={riseDelay(240)}>
              <PrimaryCta isAuthenticated={isAuthenticated} />
              <a
                href="#how-it-works"
                onClick={(event) => scrollToSection(event, 'how-it-works', reducedMotion)}
                className="landing-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-700 bg-white px-6 py-2.5 text-base font-semibold text-brand-800 hover:bg-brand-50"
              >
                {t('home.hero.explore')}
                <ArrowDown aria-hidden="true" className="landing-cta-arrow size-5" />
              </a>
            </div>
            <p className={cn('mt-5 flex items-center gap-2 text-sm text-slate-600', riseClass)} style={riseDelay(300)}>
              <Accessibility aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
              {t('home.hero.support')}
            </p>
            <LanguageSelector className="mt-5 flex-wrap" />
          </div>

          <div className="mx-auto w-full max-w-xl lg:max-w-none">
            <JourneyNetwork intro={reveal} reducedMotion={reducedMotion} />
          </div>
        </Container>
      </section>

      <section id="how-it-works" tabIndex={-1} aria-labelledby="story-heading" className="pt-14 sm:pt-20">
        <Container>
          <p className={EYEBROW}>{t('home.story.eyebrow')}</p>
          <h2 id="story-heading" className={cn('mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl', INK)}>
            {t('home.story.title')}
          </h2>
        </Container>
        {STORY.map(({ key, Illustration, link }, index) => (
          <StorySection key={key} index={index} storyKey={key} Illustration={Illustration} link={link} reducedMotion={reducedMotion} />
        ))}
      </section>

      <section id="features" tabIndex={-1} aria-labelledby="features-heading" className="border-y border-line bg-canvas-muted py-14 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className={EYEBROW}>{t('home.features.eyebrow')}</p>
            <h2 id="features-heading" className={cn('mt-3 text-3xl font-semibold tracking-tight', INK)}>{t('home.features.title')}</h2>
            <p className="mt-3 text-slate-700">{t('home.features.description')}</p>
          </div>
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {FEATURES.map(({ key, icon: Icon }) => (
              <li key={key} className="border-t border-line py-5">
                <h3 className={cn('flex items-center gap-2 font-semibold', INK)}>
                  <Icon aria-hidden="true" className="size-5 text-brand-700" />
                  {t(`home.features.${key}.title`)}
                </h3>
                <p className="mt-1.5 text-slate-700">{t(`home.features.${key}.description`)}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="closing-heading" className="py-16 sm:py-24">
        <Container className="flex flex-col items-start gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 id="closing-heading" className={cn('text-3xl font-semibold tracking-tight text-balance sm:text-4xl', INK)}>
              {t('home.closing.title')}
            </h2>
            <p className="mt-3 text-lg text-slate-700">{t('home.closing.body')}</p>
          </div>
          <div className="flex flex-col items-start gap-2">
            <PrimaryCta isAuthenticated={isAuthenticated} />
            {!isAuthenticated && (
              <Link to={PATHS.login} className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4">
                {t('home.closing.signIn')}
              </Link>
            )}
          </div>
        </Container>
      </section>

      <section aria-labelledby="notice-heading" className="pb-16 sm:pb-20">
        <Container>
          <h2 id="notice-heading" className="sr-only">
            {t('home.notice.heading')}
          </h2>
          <Notice tone="warning" title={t('home.notice.title')}>
            {t('home.notice.body')}
          </Notice>
        </Container>
      </section>
    </>
  );
}

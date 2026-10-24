import {
  ArrowRight,
  BellRing,
  ClipboardList,
  Clock,
  Languages,
  LayoutDashboard,
  ListOrdered,
  Map as MapIcon,
  MapPin,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { Notice } from '../components/feedback/Notice';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';

// Text lives in the dictionaries under home.*; only icons and keys are listed here.
const FEATURES = [
  { icon: Ticket, key: 'tokens' },
  { icon: MapIcon, key: 'maps' },
  { icon: BellRing, key: 'help' },
];

const STEPS = [
  { icon: Languages, key: 'register' },
  { icon: ClipboardList, key: 'department' },
  { icon: MapPin, key: 'track' },
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

function ExampleTokenCard() {
  const { t } = useTranslation();
  return (
    <figure className="rounded-xl border border-line bg-white p-6 shadow-raised sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-600">Demo OPD</p>
        <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
          {t('status.waiting.label')}
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-600">{t('home.example.yourToken')}</p>
      <p className="text-5xl font-bold tracking-tight text-slate-900">OPD-101</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6">
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-slate-600">
            <Users aria-hidden="true" className="size-4" />
            {t('queue.patientsAhead')}
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">4</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-slate-600">
            <Clock aria-hidden="true" className="size-4" />
            {t('queue.estimatedWait')}
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">{t('estimate.aboutMinutes', { count: 20 })}</dd>
          <dd className="text-xs font-medium text-slate-600">{t('queue.simulatedEstimate')}</dd>
        </div>
      </dl>
      <figcaption className="mt-6 rounded-lg bg-canvas-muted px-3 py-2 text-sm text-slate-700">
        {t('home.example.caption')}
      </figcaption>
    </figure>
  );
}

export function HomePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('home.documentTitle'));
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section aria-labelledby="hero-heading" className="border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
              <ShieldCheck aria-hidden="true" className="size-4" />
              {t('home.badge')}
            </p>
            <h1
              id="hero-heading"
              className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl"
            >
              {t('home.title')}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-700">
              {t('home.intro')}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <ButtonLink to={PATHS.dashboard} className="px-6">
                  {t('home.goToDashboard')}
                  <ArrowRight aria-hidden="true" className="size-5" />
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to={PATHS.registerPatient} className="px-6">
                    {t('auth.registerTitle')}
                    <ArrowRight aria-hidden="true" className="size-5" />
                  </ButtonLink>
                  <ButtonLink to={PATHS.login} variant="secondary" className="px-6">
                    {t('layout.signIn')}
                  </ButtonLink>
                </>
              )}
            </div>
            <LanguageSelector className="mt-5 flex-wrap" />
          </div>

          <ExampleTokenCard />
        </Container>
      </section>

      <section id="features" tabIndex={-1} aria-labelledby="features-heading" className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            id="features-heading"
            eyebrow={t('nav.features')}
            title={t('home.features.title')}
            description={t('home.features.description')}
          />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, key }) => (
              <li key={key} className="rounded-xl border border-line bg-white p-6">
                <span className="flex size-11 items-center justify-center rounded-lg bg-brand-50">
                  <Icon aria-hidden="true" className="size-6 text-brand-700" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{t(`home.features.${key}.title`)}</h3>
                <p className="mt-2 text-slate-700">{t(`home.features.${key}.description`)}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section
        id="how-it-works"
        tabIndex={-1}
        aria-labelledby="how-heading"
        className="border-y border-line bg-canvas-muted py-16 sm:py-20"
      >
        <Container>
          <SectionHeading id="how-heading" eyebrow={t('nav.howItWorks')} title={t('home.steps.title')} />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, key }, index) => (
              <li key={key} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Icon aria-hidden="true" className="size-5 text-brand-700" />
                    {t(`home.steps.${key}.title`)}
                  </h3>
                  <p className="mt-1 text-slate-700">{t(`home.steps.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="staff-heading" className="py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-2">
          <SectionHeading
            id="staff-heading"
            eyebrow={t('home.teams.eyebrow')}
            title={t('home.teams.title')}
            description={t('home.teams.description')}
          />
          <ul className="grid gap-4">
            {STAFF_POINTS.map(({ icon: Icon, key }) => (
              <li key={key} className="flex gap-4 rounded-xl border border-line bg-white p-5">
                <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-brand-700" />
                <div>
                  <h3 className="font-semibold text-slate-900">{t(`home.teams.${key}.title`)}</h3>
                  <p className="mt-1 text-slate-700">{t(`home.teams.${key}.description`)}</p>
                </div>
              </li>
            ))}
          </ul>
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

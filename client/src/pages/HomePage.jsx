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
import { Notice } from '../components/feedback/Notice';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS } from '../routes/paths';

const FEATURES = [
  {
    icon: Ticket,
    title: 'Queue tokens and status',
    description:
      'Choose your department and receive a token. See how many people are ahead of you and a simulated waiting-time estimate, without standing in line to ask.',
  },
  {
    icon: MapIcon,
    title: 'Accessible floor maps',
    description:
      'Find departments, rooms, and facilities on simple 2D floor maps, with the same information also available as a text list.',
  },
  {
    icon: BellRing,
    title: 'Ask staff for help',
    description:
      'Send a request for assistance to hospital staff in your department, and see when it has been acknowledged.',
  },
];

const STEPS = [
  {
    icon: Languages,
    title: 'Register and choose your language',
    description: 'Create a patient account with a username and pick the language you are most comfortable with.',
  },
  {
    icon: ClipboardList,
    title: 'Select a department',
    description: 'Pick the OPD department you need and receive your queue token.',
  },
  {
    icon: MapPin,
    title: 'Track your turn and find your way',
    description: 'Follow your place in the queue and use the floor map to reach the right room.',
  },
];

const STAFF_POINTS = [
  {
    icon: ListOrdered,
    title: 'For hospital staff',
    description:
      'View your department’s queue, call the next patient, update consultation status, and acknowledge assistance requests.',
  },
  {
    icon: LayoutDashboard,
    title: 'For administrators',
    description: 'Monitor queues across departments with basic aggregate statistics.',
  },
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
  return (
    <figure className="rounded-xl border border-line bg-white p-6 shadow-raised sm:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-600">Demo OPD</p>
        <span className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
          Waiting
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-600">Your token</p>
      <p className="text-5xl font-bold tracking-tight text-slate-900">OPD-101</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-6">
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-slate-600">
            <Users aria-hidden="true" className="size-4" />
            Patients ahead
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">4</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-sm text-slate-600">
            <Clock aria-hidden="true" className="size-4" />
            Estimated wait
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">~20 min</dd>
          <dd className="text-xs font-medium text-slate-600">Simulated estimate</dd>
        </div>
      </dl>
      <figcaption className="mt-6 rounded-lg bg-canvas-muted px-3 py-2 text-sm text-slate-700">
        Example only — this shows how a queue token will look. It is not live data.
      </figcaption>
    </figure>
  );
}

export function HomePage() {
  useDocumentTitle('Hospital queues and navigation');
  const { isAuthenticated } = useAuth();

  return (
    <>
      <section aria-labelledby="hero-heading" className="border-b border-line">
        <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-800">
              <ShieldCheck aria-hidden="true" className="size-4" />
              For government hospital OPDs
            </p>
            <h1
              id="hero-heading"
              className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl"
            >
              Know your turn. Find your way. Get help when you need it.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-700">
              SehatDarsak makes OPD visits less uncertain. Get a queue token, follow your place in
              line, find departments on a simple floor map, and ask hospital staff for assistance —
              in the language you prefer.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {isAuthenticated ? (
                <ButtonLink to={PATHS.dashboard} className="px-6">
                  Go to your dashboard
                  <ArrowRight aria-hidden="true" className="size-5" />
                </ButtonLink>
              ) : (
                <>
                  <ButtonLink to={PATHS.register} className="px-6">
                    Register as a patient
                    <ArrowRight aria-hidden="true" className="size-5" />
                  </ButtonLink>
                  <ButtonLink to={PATHS.login} variant="secondary" className="px-6">
                    Sign in
                  </ButtonLink>
                </>
              )}
            </div>
          </div>

          <ExampleTokenCard />
        </Container>
      </section>

      <section id="features" tabIndex={-1} aria-labelledby="features-heading" className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            id="features-heading"
            eyebrow="Features"
            title="Built around a patient’s hospital visit"
            description="Three simple tools for the moments that cause the most confusion during an OPD visit."
          />
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="rounded-xl border border-line bg-white p-6">
                <span className="flex size-11 items-center justify-center rounded-lg bg-brand-50">
                  <Icon aria-hidden="true" className="size-6 text-brand-700" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-slate-700">{description}</p>
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
          <SectionHeading id="how-heading" eyebrow="How it works" title="Three steps for patients" />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-700 font-bold text-white"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Icon aria-hidden="true" className="size-5 text-brand-700" />
                    {title}
                  </h3>
                  <p className="mt-1 text-slate-700">{description}</p>
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
            eyebrow="For hospital teams"
            title="A small, focused view for staff and administrators"
            description="Staff see only their own department. Every action is checked by the hospital service, not just hidden in the app."
          />
          <ul className="grid gap-4">
            {STAFF_POINTS.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4 rounded-xl border border-line bg-white p-5">
                <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-brand-700" />
                <div>
                  <h3 className="font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-slate-700">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="notice-heading" className="pb-16 sm:pb-20">
        <Container>
          <h2 id="notice-heading" className="sr-only">
            Important information
          </h2>
          <Notice tone="warning" title="Not an emergency service">
            Waiting times are simulated estimates. Assistance requests are sent to hospital staff
            and are not a guaranteed emergency medical response. In a medical emergency, go directly
            to the hospital&apos;s emergency department.
          </Notice>
        </Container>
      </section>
    </>
  );
}

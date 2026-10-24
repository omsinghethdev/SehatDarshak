import { ArrowLeft, ArrowRight, Briefcase, HeartPulse, LogIn, ShieldCheck, UserPlus, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { ButtonLink } from '../components/common/Button';
import { Notice } from '../components/feedback/Notice';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { ACCOUNT_TYPE_KEYS, ACCOUNT_TYPES } from '../features/auth/accountTypes';
import { DemoAuthNotice } from '../features/auth/DemoAuthNotice';
import { RegisterForm } from '../features/auth/RegisterForm';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS, REGISTER_PATHS } from '../routes/paths';

const ICONS = { patient: UserRound, staff_opd: HeartPulse, staff_med: Briefcase, admin: ShieldCheck };
const LINK_CLASS = 'inline-flex min-h-11 min-w-11 items-center gap-2 font-semibold text-brand-800 underline underline-offset-4';

/**
 * How a category can be registered in this build:
 *   "real"     — through the auth service's public registration (patients only)
 *   "demo"     — as a development-only mock account
 *   "disabled" — mock mode, but not allowed in this build (administrators outside `npm run dev`)
 *   "hospital" — API mode: only the hospital can create these accounts
 */
function useRegistrationAvailability(kind) {
  const { registerDemoAccount, demoRegistrationKinds } = useAuth();
  if (kind === 'patient') return 'real';
  if (!registerDemoAccount) return 'hospital';
  return demoRegistrationKinds.includes(kind) ? 'demo' : 'disabled';
}

const BADGE_KEYS = { demo: 'register.badges.demoOnly', disabled: 'register.badges.demoSignInOnly', hospital: 'register.badges.hospitalOnly' };

function AccountTypeCard({ kind }) {
  const { t } = useTranslation();
  const location = useLocation();
  const availability = useRegistrationAvailability(kind);
  const Icon = ICONS[kind];
  return (
    <li>
      <Link
        to={REGISTER_PATHS[kind]}
        state={location.state}
        className="flex h-full gap-3 rounded-xl border border-line bg-white p-4 hover:border-brand-600 hover:bg-brand-50/40 sm:gap-4"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-brand-50">
          <Icon aria-hidden="true" className="size-6 text-brand-700" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 font-semibold text-slate-900">
            {t(`register.kinds.${kind}.title`)}
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
          </span>
          <span className="mt-0.5 block text-sm text-slate-700">{t(`register.kinds.${kind}.description`)}</span>
          {BADGE_KEYS[availability] && (
            <span className="mt-2 inline-block rounded border border-amber-300 bg-amber-50 px-1.5 text-xs font-semibold text-amber-950">
              {t(BADGE_KEYS[availability])}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function SignInLink() {
  const { t } = useTranslation();
  const location = useLocation();
  return (
    <p className="border-t border-line pt-6 text-sm">
      {t('auth.haveAccount')}{' '}
      <Link to={PATHS.login} state={location.state} className={LINK_CLASS}>
        {t('layout.signIn')}
      </Link>
    </p>
  );
}

/**
 * /register — who can create an account. Patients register themselves (the primary action);
 * staff and administrator accounts are created by the hospital, so they are explained, not
 * offered. Only in mock mode are the demo staff/admin accounts that really work listed, under a
 * clearly labelled demo heading. (The header, footer, and landing page link straight to the
 * patient form; this page is reached from "Not a patient?" links.)
 */
export function RegisterPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const { registerDemoAccount, demoRegistrationKinds } = useAuth();
  useDocumentTitle(t('register.chooseTitle'));
  const demoKinds = registerDemoAccount
    ? ACCOUNT_TYPE_KEYS.filter((kind) => kind !== 'patient' && demoRegistrationKinds.includes(kind))
    : [];

  return (
    <StatusPageLayout icon={UserPlus} title={t('register.chooseTitle')}>
      <p>{t('register.chooseIntro')}</p>
      <DemoAuthNotice />

      <section aria-labelledby="register-patient-heading" className="space-y-3 rounded-xl border border-line bg-white p-5">
        <h2 id="register-patient-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <UserRound aria-hidden="true" className="size-5 text-brand-700" />
          {t('register.kinds.patient.title')}
        </h2>
        <p className="text-slate-700">{t('register.kinds.patient.description')}</p>
        <ButtonLink to={PATHS.registerPatient} state={location.state} className="w-full">
          <UserPlus aria-hidden="true" className="size-5" />
          {t('register.patientAction')}
        </ButtonLink>
      </section>

      <Notice tone="info" title={t('register.staffTitle')}>
        {t('register.staffBody')}
      </Notice>

      {demoKinds.length > 0 && (
        <section aria-labelledby="register-demo-heading" className="space-y-3">
          <h2 id="register-demo-heading" className="font-semibold text-slate-900">
            {t('register.demoKindsTitle')}
          </h2>
          <p className="text-sm text-slate-700">{t('register.demoKindsBody')}</p>
          <ul className="space-y-3">
            {demoKinds.map((kind) => (
              <AccountTypeCard key={kind} kind={kind} />
            ))}
          </ul>
        </section>
      )}

      <SignInLink />
    </StatusPageLayout>
  );
}

/** /register/<category> — the form (or an honest explanation) for one account category. */
export function RegisterAccountPage({ kind }) {
  const { t } = useTranslation();
  const location = useLocation();
  const availability = useRegistrationAvailability(kind);
  const title = kind === 'patient' ? t('auth.registerTitle') : t(`register.kinds.${kind}.title`);
  const category = t(`register.kinds.${kind}.label`);
  useDocumentTitle(title);

  let body;
  if (availability === 'real') {
    body = (
      <>
        <p>{t('auth.registerIntro')}</p>
        <DemoAuthNotice />
        <RegisterForm kind={kind} />
      </>
    );
  } else if (availability === 'demo') {
    body = (
      <>
        <p>{t(`register.kinds.${kind}.description`)}</p>
        <Notice tone="warning" title={t('register.demoTitle')}>
          {t('register.demoBody', { category })}
          {ACCOUNT_TYPES[kind].role === 'admin' && <> {t('register.adminDevNote')}</>}
        </Notice>
        <RegisterForm kind={kind} />
      </>
    );
  } else {
    const [noticeTitle, noticeBody] =
      availability === 'disabled'
        ? [t('register.adminDisabledTitle'), t('register.adminDisabledBody')]
        : [t('register.hospitalOnlyTitle'), t(ACCOUNT_TYPES[kind].role === 'admin' ? 'register.hospitalOnlyAdmin' : 'register.hospitalOnlyStaff')];
    body = (
      <>
        <Notice tone="info" title={noticeTitle}>
          {noticeBody}
        </Notice>
        <ButtonLink to={PATHS.login} state={location.state} className="w-full">
          <LogIn aria-hidden="true" className="size-5" />
          {t('register.goToSignIn')}
        </ButtonLink>
      </>
    );
  }

  return (
    <StatusPageLayout icon={UserPlus} title={title}>
      <Link to={PATHS.register} state={location.state} className={`${LINK_CLASS} text-sm`}>
        <ArrowLeft aria-hidden="true" className="size-4" />
        {kind === 'patient' ? t('register.notPatient') : t('register.backToChoices')}
      </Link>
      {body}
      <SignInLink />
    </StatusPageLayout>
  );
}

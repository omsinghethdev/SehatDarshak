import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button, ButtonLink } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { PATHS } from '../../routes/paths';
import { cn } from '../../utils/cn';

export function AuthActions({ stacked = false, onNavigate }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, tx } = useTranslation();

  async function handleSignOut() {
    onNavigate?.();
    // Commit the move away from any protected page before clearing the session; otherwise
    // the route guard would see the signed-out state first and redirect to sign-in.
    await navigate(PATHS.home, { flushSync: true });
    logout();
  }

  if (isAuthenticated) {
    return (
      <div className={cn('flex gap-2', stacked ? 'flex-col items-stretch' : 'min-w-0 items-center')}>
        <p
          title={stacked ? undefined : user.name}
          className={cn('min-w-0 items-center gap-2 px-2 text-sm text-slate-700', stacked ? 'flex' : 'hidden xl:flex')}
        >
          <UserRound aria-hidden="true" className="size-4 shrink-0" />
          {/* On one line in the header; a long name is shortened with "…" (full text stays readable to screen readers). */}
          <span className={stacked ? undefined : 'truncate'}>
            {tx('layout.signedInAs', { name: <span className="font-semibold text-slate-900">{user.name}</span> })}
          </span>
        </p>
        <Button variant="secondary" onClick={handleSignOut} className={stacked ? undefined : 'shrink-0 whitespace-nowrap'}>
          <LogOut aria-hidden="true" className="size-4" />
          {t('layout.signOut')}
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', stacked ? 'flex-col items-stretch' : 'items-center')}>
      <ButtonLink to={PATHS.login} variant="ghost" onClick={onNavigate} className={stacked ? undefined : 'whitespace-nowrap'}>
        {t('layout.signIn')}
      </ButtonLink>
      <ButtonLink to={PATHS.registerPatient} onClick={onNavigate} className={stacked ? undefined : 'whitespace-nowrap'}>
        {t('layout.register')}
      </ButtonLink>
    </div>
  );
}

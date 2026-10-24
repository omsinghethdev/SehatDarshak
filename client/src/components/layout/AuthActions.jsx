import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button, ButtonLink } from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { PATHS } from '../../routes/paths';
import { cn } from '../../utils/cn';

export function AuthActions({ stacked = false, onNavigate }) {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    onNavigate?.();
    // Commit the move away from any protected page before clearing the session; otherwise
    // the route guard would see the signed-out state first and redirect to sign-in.
    await navigate(PATHS.home, { flushSync: true });
    logout();
  }

  if (isAuthenticated) {
    return (
      <div className={cn('flex gap-2', stacked ? 'flex-col items-stretch' : 'items-center')}>
        <p className={cn('items-center gap-2 px-2 text-sm text-slate-700', stacked ? 'flex' : 'hidden xl:flex')}>
          <UserRound aria-hidden="true" className="size-4" />
          <span>
            Signed in as <span className="font-semibold text-slate-900">{user.name}</span>
          </span>
        </p>
        <Button variant="secondary" onClick={handleSignOut}>
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', stacked ? 'flex-col items-stretch' : 'items-center')}>
      <ButtonLink to={PATHS.login} variant="ghost" onClick={onNavigate}>
        Sign in
      </ButtonLink>
      <ButtonLink to={PATHS.register} onClick={onNavigate}>
        Register
      </ButtonLink>
    </div>
  );
}

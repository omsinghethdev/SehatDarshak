import { Notice } from '../../components/feedback/Notice';
import { useAuth } from '../../hooks/useAuth';

/** Shown on auth forms in mock mode so demo sign-in is never mistaken for the real service. */
export function DemoAuthNotice() {
  const { isMockAuth } = useAuth();
  if (!isMockAuth) return null;

  return (
    <Notice tone="warning" title="Demo sign-in (development only)">
      Accounts are stored only in this browser and are not sent to a hospital server. This mode is
      not secure. Use fictional details only — never a real name or a password you use elsewhere.
    </Notice>
  );
}

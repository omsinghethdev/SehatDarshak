import { FlaskConical } from 'lucide-react';
import { Container } from '../common/Container';
import { useAuth } from '../../hooks/useAuth';

/** Site-wide label shown whenever development-only mock authentication is active. */
export function DemoModeBanner() {
  const { isMockAuth } = useAuth();
  if (!isMockAuth) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-950">
      <Container className="flex items-start gap-2 py-2 text-sm sm:items-center">
        <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-700 sm:mt-0" />
        <p>
          <strong>Demo mode:</strong> sign-in uses development-only mock accounts stored in this
          browser. It is not secure and not connected to the hospital service.
        </p>
      </Container>
    </div>
  );
}

import { MapPinOff } from 'lucide-react';
import { ButtonLink } from '../components/common/Button';
import { StatusPageLayout } from '../components/layout/StatusPageLayout';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS } from '../routes/paths';

export function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <StatusPageLayout
      icon={MapPinOff}
      eyebrow="Error 404"
      title="We couldn't find that page"
      actions={<ButtonLink to={PATHS.home}>Back to home</ButtonLink>}
    >
      <p>The link may be incorrect, or the page may have moved.</p>
    </StatusPageLayout>
  );
}

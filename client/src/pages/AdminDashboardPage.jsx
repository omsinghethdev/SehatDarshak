import { useCallback } from 'react';
import { HandHelping, ListOrdered, RefreshCw } from 'lucide-react';
import { Button, ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { PageHeader } from '../components/layout/PageHeader';
import { OperationalSummary } from '../features/admin/OperationalSummary';
import { loadAdminOverview } from '../features/admin/adminOverviewService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS } from '../routes/paths';

function formatTime(value) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function AdminDashboardPage() {
  useDocumentTitle('Operations overview');
  const load = useCallback((signal) => loadAdminOverview({ signal }), []);
  const overview = useAsyncData(load);

  let content;
  if (overview.status === 'error') {
    content = <ErrorState error={overview.error} onRetry={overview.reload} />;
  } else if (!overview.data) {
    content = <LoadingState label="Calculating the overview…" />;
  } else {
    const { source, summary } = overview.data;
    content = (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>
            Calculated at <time dateTime={summary.calculatedAt}>{formatTime(summary.calculatedAt)}</time>{' '}
            {source === 'api' ? 'by the hospital queue service.' : 'from the demo data in this browser.'}
          </p>
          <Button variant="ghost" onClick={overview.reload} aria-disabled={overview.status === 'loading' || undefined}>
            <RefreshCw aria-hidden="true" className={overview.status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
            {source === 'api' ? 'Refresh' : 'Recalculate'}
          </Button>
        </div>
        {summary.departments.length === 0 ? (
          <Notice tone="info" title="No departments to show">
            There are no active departments yet, so there are no queues to summarise.
          </Notice>
        ) : (
          <OperationalSummary summary={summary} />
        )}
      </div>
    );
  }

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <PageHeader
        eyebrow="Administration"
        title="Operations overview"
        description="Current queue and assistance-request counts for monitoring. Aggregate counts only — no patient details."
      />

      {overview.data?.source === 'mock-summary' && (
        <Notice tone="warning" title="Demo figures — frontend-only summary">
          These numbers are calculated in your browser from fictional demo data. They do not describe
          a real hospital, and this summary is not the server&apos;s statistics format.
        </Notice>
      )}

      <div className="flex flex-wrap gap-3">
        <ButtonLink to={PATHS.staffQueue} variant="secondary">
          <ListOrdered aria-hidden="true" className="size-5" />
          Monitor queues
        </ButtonLink>
        <ButtonLink to={PATHS.staffAssistance} variant="secondary">
          <HandHelping aria-hidden="true" className="size-5" />
          Assistance requests
        </ButtonLink>
      </div>

      {content}
    </Container>
  );
}

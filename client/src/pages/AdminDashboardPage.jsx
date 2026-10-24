import { useCallback } from 'react';
import { HandHelping, ListOrdered, RefreshCw } from 'lucide-react';
import { Button, ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
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
  } else if (overview.data.source === 'mock-summary') {
    const { summary } = overview.data;
    content = (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>
            Calculated at <time dateTime={summary.calculatedAt}>{formatTime(summary.calculatedAt)}</time> from the
            demo data in this browser.
          </p>
          <Button variant="ghost" onClick={overview.reload} aria-disabled={overview.status === 'loading' || undefined}>
            <RefreshCw aria-hidden="true" className={overview.status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
            Recalculate
          </Button>
        </div>
        <OperationalSummary summary={summary} />
      </div>
    );
  } else {
    content = (
      <Notice tone="info" title="Statistics format not agreed yet">
        The server returned statistics, but the API contract does not yet define their format, so
        they are not shown here. Once the team agrees the response shape, this page can display it.
      </Notice>
    );
  }

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">Administration</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Operations overview</h1>
        <p className="mt-2 max-w-2xl text-slate-700">
          Current queue and assistance-request counts for monitoring. Aggregate counts only — no
          patient details.
        </p>
      </div>

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

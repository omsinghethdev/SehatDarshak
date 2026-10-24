import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, Ticket } from 'lucide-react';
import { useParams } from 'react-router';
import { Button, ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { departmentService } from '../features/departments/departmentService';
import { DemoQueueControls } from '../features/queue/DemoQueueControls';
import { StatusBadge } from '../features/queue/StatusBadge';
import { StatusLegend } from '../features/queue/StatusLegend';
import { TokenMetrics } from '../features/queue/TokenMetrics';
import { isActiveStatus } from '../features/queue/queueStatus';
import { QUEUE_POLL_INTERVAL_MS, queueService } from '../features/queue/queueService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { PATHS, bookTokenPath } from '../routes/paths';
import { API_ERROR_CODES } from '../services/apiClient';

// Refresh failures that retrying cannot fix: the token is gone or no longer visible to this user.
const PERMANENT_REFRESH_ERRORS = [
  API_ERROR_CODES.NOT_FOUND,
  API_ERROR_CODES.FORBIDDEN,
  API_ERROR_CODES.UNAUTHORIZED,
];

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Keeps an active token fresh by polling the patient-safe status endpoint. Polling pauses
 * while the tab is hidden and stops once the token reaches a terminal status.
 */
function useTokenStatusPolling(token, onStatus) {
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [refreshError, setRefreshError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const tokenId = token?.id;
  const active = token ? isActiveStatus(token.status) : false;
  const permanentError = PERMANENT_REFRESH_ERRORS.includes(refreshError?.code);

  const refresh = useCallback(async () => {
    if (!tokenId || inFlight.current) return;
    inFlight.current = true;
    setRefreshing(true);
    try {
      onStatus(await queueService.getTokenStatus(tokenId));
      setLastUpdated(new Date());
      setRefreshError(null);
    } catch (error) {
      setRefreshError(error);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
    }
  }, [tokenId, onStatus]);

  useEffect(() => {
    if (!active || permanentError) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, QUEUE_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, permanentError, refresh]);

  return { lastUpdated, setLastUpdated, refreshError, permanentError, refreshing, refresh };
}

export function TokenStatusPage() {
  const { tokenId } = useParams();
  const { isMockAuth } = useAuth();

  const load = useCallback(
    async (signal) => {
      const token = await queueService.getToken(tokenId, { signal });
      // The department name is helpful but not essential; show the token even if it fails.
      const department = await departmentService
        .getDepartment(token.departmentId, { signal })
        .catch((error) => {
          if (error?.name === 'AbortError') throw error;
          return null;
        });
      return { token, department };
    },
    [tokenId],
  );
  const { status, data, error, reload, setData } = useAsyncData(load);
  const token = data?.token;
  useDocumentTitle(token ? `Token ${token.displayNumber}` : 'Queue status');

  const applyStatus = useCallback(
    (update) => setData((current) => (current ? { ...current, token: { ...current.token, ...update } } : current)),
    [setData],
  );
  const { lastUpdated, setLastUpdated, refreshError, permanentError, refreshing, refresh } =
    useTokenStatusPolling(token, applyStatus);

  // A permanent refresh failure (e.g. the token no longer exists) is shown like a failed load
  // instead of a stale status with a "we will keep trying" message.
  if (status === 'error' || permanentError) {
    return (
      <Container className="max-w-3xl space-y-6 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Queue status</h1>
        <ErrorState error={status === 'error' ? error : refreshError} onRetry={status === 'error' ? reload : refresh} />
        <ButtonLink to={PATHS.dashboard} variant="secondary">
          <ArrowLeft aria-hidden="true" className="size-5" />
          Back to dashboard
        </ButtonLink>
      </Container>
    );
  }

  if (!token) {
    return (
      <Container className="max-w-3xl py-10 sm:py-14">
        <LoadingState label="Loading your token…" />
      </Container>
    );
  }

  const active = isActiveStatus(token.status);

  return (
    <Container className="max-w-3xl space-y-6 py-10 sm:py-14">
      <ButtonLink to={PATHS.dashboard} variant="ghost" className="-ml-3">
        <ArrowLeft aria-hidden="true" className="size-5" />
        Back to dashboard
      </ButtonLink>

      <section
        aria-labelledby="token-heading"
        className={
          active
            ? 'rounded-2xl border border-line bg-white p-6 shadow-sm sm:p-8'
            : 'rounded-2xl border border-dashed border-slate-300 bg-canvas-muted p-6 sm:p-8'
        }
      >
        <p className="text-sm font-medium text-slate-600">{data.department?.name ?? 'Department'}</p>
        <h1 id="token-heading" className="mt-1">
          <span className="block text-sm font-semibold tracking-wide text-brand-700 uppercase">
            Queue token
          </span>
          <span className="text-5xl font-bold tracking-tight text-slate-900">{token.displayNumber}</span>
        </h1>

        {/* Announces status and position changes to screen readers as they happen. */}
        <div aria-live="polite" className="mt-6 space-y-4 border-t border-line pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">Status:</span>
            <StatusBadge status={token.status} />
            {!active && <span className="text-sm font-medium text-slate-700">No longer active</span>}
          </div>
          <TokenMetrics token={token} size="lg" />
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Last updated {formatTime(lastUpdated)}
            {active && ` · updates automatically every ${QUEUE_POLL_INTERVAL_MS / 1000} seconds`}
          </p>
          {active && (
            <Button variant="ghost" onClick={refresh} aria-disabled={refreshing || undefined} className="self-start">
              <RefreshCw aria-hidden="true" className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
              {refreshing ? 'Refreshing…' : 'Refresh now'}
            </Button>
          )}
        </div>
      </section>

      {refreshError && (
        <Notice tone="warning" role="alert" title="Could not refresh the status">
          Showing the last known status. We will keep trying automatically.
        </Notice>
      )}

      {!active && (
        <Notice tone="info" title="This token is no longer active">
          If you still need to see a doctor in this department, you can book a new token.
          <div className="mt-3">
            <ButtonLink to={bookTokenPath(token.departmentId)}>
              <Ticket aria-hidden="true" className="size-5" />
              Book a new token
            </ButtonLink>
          </div>
        </Notice>
      )}

      <Notice tone={isMockAuth ? 'warning' : 'info'} title={isMockAuth ? 'Demo data' : 'About waiting times'}>
        {isMockAuth
          ? 'This token, its queue position, and its waiting time are simulated and stored only in this browser. They do not reflect a real hospital queue.'
          : 'Waiting times are simulated estimates and may change. Please stay near the department.'}
      </Notice>

      <DemoQueueControls
        token={token}
        onUpdated={(updated) => {
          applyStatus(updated);
          setLastUpdated(new Date());
        }}
      />

      <StatusLegend />
    </Container>
  );
}

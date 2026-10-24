import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Building2, Database, RefreshCw } from 'lucide-react';
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
import { TokenNextStep } from '../features/queue/TokenNextStep';
import { TurnAlert } from '../features/queue/TurnAlert';
import { WaitingGuidance } from '../features/queue/WaitingGuidance';
import { useTurnAlerts } from '../features/queue/useTurnAlerts';
import { isActiveStatus } from '../features/queue/queueStatus';
import { QUEUE_POLL_INTERVAL_MS, queueService } from '../features/queue/queueService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useTranslation } from '../hooks/useTranslation';
import { ListenButton } from '../components/common/ListenButton';
import { estimateLabel, formatEstimate, getWaitEstimate, isReliableCount } from '../features/queue/waitEstimate';
import { PATHS } from '../routes/paths';
import { getErrorContent } from '../utils/errorMessages';

function formatTime(date, locale) {
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Plain-language summary of the token for the "Listen" button. */
function tokenSpeech(token, departmentName, t) {
  const parts = [
    t('tokenSpeech.number', { number: token.displayNumber }),
    t('tokenSpeech.department', { department: departmentName ?? t('queue.yourDepartment') }),
    t('tokenSpeech.status', { status: t(`status.${token.status}.label`) }),
  ];
  if (token.status === 'waiting') {
    if (isReliableCount(token.patientsAhead)) parts.push(t('alerts.approaching.ahead', { count: token.patientsAhead }));
    const estimate = getWaitEstimate(token);
    if (estimate.kind === 'service' || estimate.kind === 'calculated') {
      parts.push(t('tokenSpeech.wait', { wait: formatEstimate(estimate.minutes, t), label: estimateLabel(estimate, t) }));
    }
  } else {
    parts.push(t(`status.${token.status}.description`));
  }
  return parts.join(' ');
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
    if (!active) return undefined;
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, QUEUE_POLL_INTERVAL_MS);
    // Polling pauses while the tab is hidden; catch up as soon as the patient returns.
    function handleVisibility() {
      if (!document.hidden) refresh();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active, refresh]);

  return { lastUpdated, setLastUpdated, refreshError, refreshing, refresh };
}

export function TokenStatusPage() {
  const { tokenId } = useParams();
  const { isMockAuth } = useAuth();
  const { t, language } = useTranslation();

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
  const token = data?.token?.id === tokenId ? data.token : undefined;
  useDocumentTitle(token ? `${t('queue.token')} ${token.displayNumber}` : t('queue.statusTitle'));

  const applyStatus = useCallback(
    (update) => setData((current) => (current ? { ...current, token: { ...current.token, ...update } } : current)),
    [setData],
  );
  const { lastUpdated, setLastUpdated, refreshError, refreshing, refresh } = useTokenStatusPolling(token, applyStatus);
  const { alert, dismiss: dismissAlert } = useTurnAlerts(token);

  if (status === 'error') {
    return (
      <Container className="max-w-3xl space-y-6 py-10 sm:py-14">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('queue.statusTitle')}</h1>
        <ErrorState error={error} onRetry={reload} />
        <ButtonLink to={PATHS.dashboard} variant="secondary">
          <ArrowLeft aria-hidden="true" className="size-5" />
          {t('common.backToDashboard')}
        </ButtonLink>
      </Container>
    );
  }

  if (!token) {
    return (
      <Container className="max-w-3xl py-10 sm:py-14">
        <LoadingState label={t('queue.loadingToken')} />
      </Container>
    );
  }

  const active = isActiveStatus(token.status);
  const departmentName = data.department?.name;

  return (
    <Container className="max-w-3xl space-y-6 py-10 sm:py-14">
      <ButtonLink to={PATHS.dashboard} variant="ghost" className="-ml-3">
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t('common.backToDashboard')}
      </ButtonLink>

      <TurnAlert alert={alert} departmentName={departmentName} onDismiss={dismissAlert} />

      <section
        aria-labelledby="token-heading"
        className={
          active
            ? 'rounded-xl border border-line bg-white p-5 shadow-raised sm:p-8'
            : 'rounded-xl border border-dashed border-slate-300 bg-canvas-muted p-5 sm:p-8'
        }
      >
        <h1 id="token-heading">
          <span className="block text-sm font-semibold tracking-wide text-brand-700 uppercase">
            {t('queue.yourToken')}
          </span>
          <span className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">{token.displayNumber}</span>
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-lg font-medium text-slate-800">
          <Building2 aria-hidden="true" className="size-5 text-slate-500" />
          {departmentName ?? t('queue.departmentUnavailable')}
        </p>

        {/* Status changes and turn alerts are announced by <TurnAlert>, not by this panel,
            so screen-reader users hear each important update once. */}
        <div className="mt-6 space-y-4 border-t border-line pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">{t('queue.statusLabel')}</span>
            <StatusBadge status={token.status} />
            {!active && <span className="text-sm font-medium text-slate-700">{t('queue.noLongerActive')}</span>}
          </div>
          <TokenMetrics token={token} size="lg" showBasis showStatusDescription={false} />
          {token.status === 'waiting' && (
            <p className="text-sm text-slate-600">{t('queue.estimateDisclaimer')}</p>
          )}
          <ListenButton text={() => tokenSpeech(token, departmentName, t)} label={t('speech.listenStatus')} />
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>
              {t('queue.lastUpdated', { time: formatTime(lastUpdated, language.locale) })}
              {active && ` · ${t('queue.autoUpdates', { seconds: QUEUE_POLL_INTERVAL_MS / 1000 })}`}
            </p>
            <p className="flex items-center gap-1.5">
              <Database aria-hidden="true" className="size-4 shrink-0" />
              {isMockAuth ? t('queue.sourceDemo') : t('queue.sourceService')}
            </p>
          </div>
          {active && (
            <Button variant="ghost" onClick={refresh} aria-disabled={refreshing || undefined} className="-ml-5 self-start sm:ml-0 sm:-mr-5 sm:self-auto">
              <RefreshCw aria-hidden="true" className={refreshing ? 'size-4 animate-spin' : 'size-4'} />
              {refreshing ? t('queue.refreshing') : t('queue.refreshNow')}
            </Button>
          )}
        </div>
      </section>

      {refreshError && (
        <Notice tone="warning" role="alert" title={t('queue.outOfDateTitle')}>
          {getErrorContent(refreshError, t, language.code).description}{' '}
          {t('queue.outOfDateBody', { time: formatTime(lastUpdated, language.locale) })}
          {active && ` ${t('queue.keepTrying')}`}
        </Notice>
      )}

      <TokenNextStep token={token} departmentName={departmentName} />

      {(token.status === 'waiting' || token.status === 'called') && (
        <WaitingGuidance token={token} department={data.department} />
      )}

      <Notice tone={isMockAuth ? 'warning' : 'info'} title={isMockAuth ? t('demo.dataTitle') : t('queue.aboutWaitingTitle')}>
        {isMockAuth ? t('demo.tokenBody') : t('queue.aboutWaitingBody')}
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

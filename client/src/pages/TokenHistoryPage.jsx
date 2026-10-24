import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, History, RefreshCw, Ticket } from 'lucide-react';
import { Button, ButtonLink } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { PageHeader } from '../components/layout/PageHeader';
import { departmentService } from '../features/departments/departmentService';
import { TokenHistoryCard } from '../features/queue/TokenHistoryCard';
import { queueService } from '../features/queue/queueService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { usePagedList } from '../hooks/usePagedList';
import { useTranslation } from '../hooks/useTranslation';
import { PATHS } from '../routes/paths';

const PAGE_SIZE = 10;

/**
 * The patient's finished tokens (completed, skipped, cancelled), newest first. Active tokens
 * stay on the dashboard. Older pages are appended with "Show older tokens"; usePagedList drops
 * any entry already shown, so a token finishing meanwhile cannot appear twice.
 */
export function TokenHistoryPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('queue.history.title'));
  const { isMockAuth } = useAuth();

  const fetchPage = useCallback((options) => queueService.listTokenHistory(options), []);
  const { status, items, error, reload, hasMore, loadMore, loadingMore, moreError, meta } = usePagedList(fetchPage, PAGE_SIZE);

  // Department names are helpful but not essential; the history still shows if they fail.
  const loadDepartments = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const departments = useAsyncData(loadDepartments);
  const departmentsById = useMemo(
    () => (departments.data ? new Map(departments.data.map((item) => [item.id, item])) : null),
    [departments.data],
  );
  const departmentNameFor = (departmentId) => {
    if (departments.status === 'error') return null;
    if (!departmentsById) return undefined;
    return departmentsById.get(departmentId)?.name ?? null;
  };

  // After "Show older tokens", move focus to the first newly added entry so keyboard and
  // screen-reader users continue from there (the button may disappear on the last page).
  const itemRefs = useRef(new Map());
  const [focusIndex, setFocusIndex] = useState(null);
  useEffect(() => {
    if (focusIndex === null) return;
    if (moreError) {
      setFocusIndex(null); // focus stays on the page; the error and its Retry button are shown
      return;
    }
    if (items.length <= focusIndex) return;
    itemRefs.current.get(items[focusIndex].id)?.focus();
    setFocusIndex(null);
  }, [focusIndex, items, moreError]);

  function handleLoadMore() {
    if (loadingMore) return;
    setFocusIndex(items.length);
    loadMore();
  }

  let content;
  if (status === 'error') {
    content = <ErrorState error={error} onRetry={reload} />;
  } else if (status === 'loading' && items.length === 0) {
    content = <LoadingState label={t('queue.history.loading')} />;
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={History}
        title={t('queue.history.emptyTitle')}
        description={t('queue.history.emptyBody')}
        action={
          <ButtonLink to={PATHS.dashboard} variant="secondary">
            <Ticket aria-hidden="true" className="size-5" />
            {t('queue.history.activeLink')}
          </ButtonLink>
        }
      />
    );
  } else {
    content = (
      <div className="space-y-4">
        <ul className="space-y-4">
          {items.map((token) => (
            <li key={token.id}>
              <TokenHistoryCard
                ref={(node) => {
                  if (node) itemRefs.current.set(token.id, node);
                  else itemRefs.current.delete(token.id);
                }}
                token={token}
                departmentName={departmentNameFor(token.departmentId)}
              />
            </li>
          ))}
        </ul>
        {moreError && <ErrorState error={moreError} onRetry={handleLoadMore} />}
        {hasMore && (
          <Button variant="secondary" onClick={handleLoadMore} aria-disabled={loadingMore || undefined}>
            {loadingMore ? t('common.loading') : t('queue.history.showOlder')}
          </Button>
        )}
        {meta?.total > 0 && (
          <p aria-live="polite" className="text-sm text-slate-600">
            {t('queue.history.showingCount', { shown: items.length, total: meta.total })}
          </p>
        )}
      </div>
    );
  }

  return (
    <Container className="max-w-3xl space-y-8 py-10 sm:py-14">
      <ButtonLink to={PATHS.dashboard} variant="ghost" className="-ml-3">
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t('common.backToDashboard')}
      </ButtonLink>

      <PageHeader
        eyebrow={t('queue.history.eyebrow')}
        title={t('queue.history.title')}
        description={t('queue.history.intro')}
        actions={
          status !== 'error' && (
            <Button variant="ghost" onClick={reload} aria-disabled={status === 'loading' || undefined}>
              <RefreshCw aria-hidden="true" className={status === 'loading' ? 'size-4 animate-spin' : 'size-4'} />
              {t('common.refresh')}
            </Button>
          )
        }
      />

      {isMockAuth && (
        <Notice tone="warning" title={t('demo.dataTitle')}>
          {t('queue.history.demoBody')}
        </Notice>
      )}

      <section aria-labelledby="history-list-heading" className="space-y-4">
        <h2 id="history-list-heading" className="sr-only">
          {t('queue.history.listLabel')}
        </h2>
        {content}
      </section>
    </Container>
  );
}

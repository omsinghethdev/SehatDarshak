import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchLoadedPages } from '../lib/autoRefresh';

/**
 * A paginated list loaded page by page. `fetchPage({ page, limit, signal })` must resolve to
 * `{ items, meta: { page, limit, total } }` and be stable (useCallback); changing it reloads.
 *
 * `refresh(signal)` re-reads the pages already shown, in the background (e.g. from
 * useAutoRefresh): items stay on screen while it runs and are left as they are if it fails (the
 * error is thrown to the caller). A reload or "load more" that starts meanwhile wins: the
 * refresh result is then dropped, so it can never overwrite newer data.
 */
export function usePagedList(fetchPage, pageSize = 10) {
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const controllerRef = useRef(null);
  // Bumped by every first-page load and "load more"; a refresh applies only if it is unchanged.
  const versionRef = useRef(0);
  const stateRef = useRef(state);
  const loadingMoreRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
    loadingMoreRef.current = loadingMore;
  });

  const loadFirstPage = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    versionRef.current += 1;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    setMoreError(null);
    try {
      const { items, meta } = await fetchPage({ page: 1, limit: pageSize, signal: controller.signal });
      if (!controller.signal.aborted) setState({ status: 'success', items, meta, error: null });
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') return;
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, [fetchPage, pageSize]);

  useEffect(() => {
    loadFirstPage();
    return () => controllerRef.current?.abort();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !state.meta) return;
    versionRef.current += 1;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const { items, meta } = await fetchPage({ page: state.meta.page + 1, limit: pageSize });
      setState((current) => {
        const known = new Set(current.items.map((item) => item.id));
        return { ...current, items: [...current.items, ...items.filter((item) => !known.has(item.id))], meta };
      });
    } catch (error) {
      setMoreError(error);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, pageSize, loadingMore, state.meta]);

  const refresh = useCallback(
    async (signal) => {
      const current = stateRef.current;
      // Nothing to refresh before the first page has loaded (its own error state has Retry).
      if (current.status !== 'success' || loadingMoreRef.current) return;
      const version = versionRef.current;
      const { items, meta } = await fetchLoadedPages(fetchPage, { loadedPages: current.meta?.page ?? 1, pageSize, signal });
      if (signal?.aborted || version !== versionRef.current) return;
      setState((latest) => ({ ...latest, status: 'success', items, meta, error: null }));
    },
    [fetchPage, pageSize],
  );

  const replaceItem = useCallback((updated) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    }));
  }, []);

  const total = state.meta?.total;
  const hasMore = typeof total === 'number' && state.items.length < total;

  return { ...state, hasMore, loadingMore, moreError, reload: loadFirstPage, refresh, loadMore, replaceItem };
}

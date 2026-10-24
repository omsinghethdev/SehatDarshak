import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A paginated list loaded page by page. `fetchPage({ page, limit, signal })` must resolve to
 * `{ items, meta: { page, limit, total } }` and be stable (useCallback); changing it reloads.
 */
export function usePagedList(fetchPage, pageSize = 10) {
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(null);
  const controllerRef = useRef(null);

  const loadFirstPage = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
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

  const replaceItem = useCallback((updated) => {
    setState((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
    }));
  }, []);

  const total = state.meta?.total;
  const hasMore = typeof total === 'number' && state.items.length < total;

  return { ...state, hasMore, loadingMore, moreError, reload: loadFirstPage, loadMore, replaceItem };
}

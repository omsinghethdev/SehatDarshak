import { useCallback, useEffect, useRef, useState } from 'react';
import { assistanceService } from './assistanceService';

const PAGE_SIZE = 10;

/**
 * The signed-in patient's assistance requests, loaded page by page
 * (GET /api/assistance-requests/me?page=&limit=), newest first.
 */
export function useAssistanceHistory() {
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
      const { items, meta } = await assistanceService.listMyRequests({ page: 1, limit: PAGE_SIZE, signal: controller.signal });
      if (!controller.signal.aborted) setState({ status: 'success', items, meta, error: null });
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') return;
      setState({ status: 'error', items: [], meta: null, error });
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
    return () => controllerRef.current?.abort();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !state.meta) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const { items, meta } = await assistanceService.listMyRequests({ page: state.meta.page + 1, limit: PAGE_SIZE });
      setState((current) => {
        const known = new Set(current.items.map((item) => item.id));
        return { ...current, items: [...current.items, ...items.filter((item) => !known.has(item.id))], meta };
      });
    } catch (error) {
      setMoreError(error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, state.meta]);

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

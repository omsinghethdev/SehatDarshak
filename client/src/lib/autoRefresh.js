/**
 * Browser tab visibility, as used by the scheduler below. Tests pass their own implementation.
 *   isHidden()          → boolean
 *   subscribe(listener) → unsubscribe function
 */
export const documentVisibility = Object.freeze({
  isHidden: () => typeof document !== 'undefined' && document.hidden,
  subscribe(listener) {
    if (typeof document === 'undefined') return () => {};
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
  },
});

/**
 * Framework-free background refresh (React wrapper: hooks/useAutoRefresh.js).
 *
 * - At most one `run(signal)` is in flight. `refresh()` while one is running returns that same
 *   promise, so a manual refresh never races a scheduled one.
 * - One timer at a time: the next scheduled refresh is `intervalMs` after the previous one
 *   finished (a manual refresh restarts the countdown), so requests are never back to back.
 * - While the tab is hidden, scheduled refreshes are skipped and no timer is kept; when the tab
 *   becomes visible again it refreshes at once and the schedule resumes.
 * - Nothing runs at creation, so React Strict Mode's mount/unmount/mount sends no extra request.
 * - `stop()` clears the timer and listener and aborts a running request; callbacks are never
 *   called after it.
 *
 * Callbacks: onStart(), onSuccess(), onError(error) — AbortErrors are ignored — and onSettled().
 */
export function createAutoRefresh({ run, intervalMs, onStart, onSuccess, onError, onSettled, visibility = documentVisibility }) {
  let stopped = false;
  let timer = null;
  let inFlight = null;
  let controller = null;

  function schedule() {
    clearTimeout(timer);
    timer = stopped ? null : setTimeout(tick, intervalMs);
  }

  function tick() {
    timer = null;
    // Hidden: skip, and wait for the visibility listener instead of keeping a timer running.
    if (!visibility.isHidden()) refresh();
  }

  function refresh() {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;

    clearTimeout(timer);
    timer = null;
    controller = new AbortController();
    const { signal } = controller;
    onStart?.();

    inFlight = Promise.resolve()
      .then(() => run(signal))
      .then(
        () => {
          if (!stopped && !signal.aborted) onSuccess?.();
        },
        (error) => {
          if (stopped || signal.aborted || error?.name === 'AbortError') return;
          onError?.(error);
        },
      )
      .finally(() => {
        inFlight = null;
        if (stopped) return;
        onSettled?.();
        if (!visibility.isHidden()) schedule();
      });
    return inFlight;
  }

  const unsubscribe = visibility.subscribe(() => {
    if (!visibility.isHidden()) refresh();
  });
  schedule();

  return {
    refresh,
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      unsubscribe();
      controller?.abort();
    },
  };
}

/**
 * Re-reads every page of a list that is already on screen, so a refresh shows current data for
 * all visible items, not just the first page. Uses one request (page 1 with a larger limit) when
 * the server's maximum page size allows it, otherwise one request per loaded page. The returned
 * meta keeps `page` as the number of loaded pages at `pageSize`, so "load more" continues correctly.
 * `fetchPage({ page, limit, signal })` must resolve to `{ items, meta: { page, limit, total } }`.
 */
export async function fetchLoadedPages(fetchPage, { loadedPages, pageSize, signal, maxLimit = 100 }) {
  const pages = Math.max(1, loadedPages);
  let items = [];
  let meta;

  if (pages * pageSize <= maxLimit) {
    ({ items, meta } = await fetchPage({ page: 1, limit: pages * pageSize, signal }));
  } else {
    for (let page = 1; page <= pages; page += 1) {
      const result = await fetchPage({ page, limit: pageSize, signal });
      items.push(...result.items);
      meta = result.meta;
    }
  }

  const seen = new Set();
  const unique = items.filter((item) => !seen.has(item.id) && seen.add(item.id));
  return { items: unique, meta: { ...meta, page: pages, limit: pageSize } };
}

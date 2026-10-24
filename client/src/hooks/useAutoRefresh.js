import { useCallback, useEffect, useRef, useState } from 'react';
import { createAutoRefresh } from '../lib/autoRefresh';

/**
 * Refreshes data in the background every `intervalMs` while `enabled` (see lib/autoRefresh.js
 * for the scheduling, visibility, and overlap rules). `run(signal)` should update the page's
 * data itself and leave it untouched on failure, so the last good data stays on screen.
 *
 * Returns `refresh()` for a manual Refresh button (it shares the same in-flight request),
 * `refreshing`, and `error`: the last failed refresh, cleared by the next successful one.
 * Session expiry needs no special case: the API client already signs the user out on a 401.
 */
export function useAutoRefresh(run, { intervalMs, enabled = true }) {
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const pollerRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;
    const poller = createAutoRefresh({
      run: (signal) => runRef.current(signal),
      intervalMs,
      onStart: () => setRefreshing(true),
      onSuccess: () => setError(null),
      onError: setError,
      onSettled: () => setRefreshing(false),
    });
    pollerRef.current = poller;
    return () => {
      poller.stop();
      pollerRef.current = null;
      setRefreshing(false);
    };
  }, [enabled, intervalMs]);

  const refresh = useCallback(() => pollerRef.current?.refresh() ?? Promise.resolve(), []);

  return { refresh, refreshing, error };
}

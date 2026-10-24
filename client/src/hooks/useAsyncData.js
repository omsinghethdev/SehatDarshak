import { useCallback, useEffect, useState } from 'react';

/**
 * Load data with an AbortSignal and track loading/success/error.
 * `load` must be stable (wrap it in useCallback); it re-runs when it changes or on `reload()`.
 * Previous data is kept while reloading so the UI does not flash.
 *
 * @returns {{ status: 'loading'|'success'|'error', data: any, error: any, reload: () => void, setData: Function }}
 */
export function useAsyncData(load) {
  const [state, setState] = useState({ status: 'loading', data: undefined, error: null });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: null }));

    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data, error: null });
      },
      (error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        setState({ status: 'error', data: undefined, error });
      },
    );

    return () => controller.abort();
  }, [load, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const setData = useCallback(
    (updater) =>
      setState((current) => ({
        ...current,
        data: typeof updater === 'function' ? updater(current.data) : updater,
      })),
    [],
  );

  return { ...state, reload, setData };
}

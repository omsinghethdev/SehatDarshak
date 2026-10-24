import { useCallback, useEffect, useRef } from 'react';

/**
 * Keeps keyboard users' place after an action whose control disappears (e.g. a status button
 * replaced once the list refreshes). Call the returned `arm()` when an action runs; on the next
 * change of `dependency` (the refreshed data), if focus was lost to the page body, focus `ref`
 * (typically the feedback message) instead. Focus that is still on a control is left alone.
 */
export function useFocusWhenLost(ref, dependency) {
  const armed = useRef(false);

  useEffect(() => {
    if (!armed.current) return;
    armed.current = false;
    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) ref.current?.focus();
  }, [ref, dependency]);

  return useCallback(() => {
    armed.current = true;
  }, []);
}

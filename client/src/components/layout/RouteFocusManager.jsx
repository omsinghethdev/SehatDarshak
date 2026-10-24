import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Restores a predictable reading position on client-side navigation:
 * hash links scroll to and focus their target; page changes move focus to <main>
 * so screen-reader and keyboard users start at the new content.
 */
export function RouteFocusManager({ mainRef }) {
  const { pathname, hash } = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    const firstRender = isFirstRender.current;
    isFirstRender.current = false;

    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        target.focus({ preventScroll: true });
        return;
      }
    }

    if (firstRender) return;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, hash, mainRef]);

  return null;
}

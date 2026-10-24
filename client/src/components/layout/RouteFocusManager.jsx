import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

/**
 * Restores a predictable reading position on client-side navigation:
 * hash links scroll to and focus their target; page changes move focus to <main>
 * so screen-reader and keyboard users start at the new content.
 */
export function RouteFocusManager({ mainRef }) {
  const { pathname, hash } = useLocation();
  // The location this effect last handled. Comparing locations (instead of a "first render"
  // flag) keeps React StrictMode's development-only second effect run from treating the
  // initial page load as a navigation and moving focus past the skip link.
  const lastLocation = useRef(null);

  useEffect(() => {
    const location = `${pathname}${hash}`;
    const previous = lastLocation.current;
    if (previous === location) return;
    lastLocation.current = location;

    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target) {
        target.scrollIntoView({ block: 'start' });
        target.focus({ preventScroll: true });
        return;
      }
    }

    if (previous === null) return; // Initial page load: leave focus where the browser put it.
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, hash, mainRef]);

  return null;
}

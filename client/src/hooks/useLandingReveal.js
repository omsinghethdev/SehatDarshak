import { useEffect, useState } from 'react';

/**
 * The opening reveal plays only when the site is first opened on the landing page (`/`), once
 * per page load: not when arriving from another route, and not again when navigating back home.
 * Read once at startup, before any client-side navigation.
 */
export const OPENED_ON_LANDING = typeof window !== 'undefined' && window.location.pathname === '/';

let heroRevealPlayed = false;

/** True for the first landing-page render after the site opens on `/`; false afterwards. */
export function useLandingReveal() {
  // The initializer only reads the flag, so StrictMode's double render gives the same answer.
  const [reveal] = useState(() => OPENED_ON_LANDING && !heroRevealPlayed);
  useEffect(() => {
    heroRevealPlayed = true;
  }, []);
  return reveal;
}

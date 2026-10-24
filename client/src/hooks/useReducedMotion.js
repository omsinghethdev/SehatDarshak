import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** True when the user prefers reduced motion; follows changes to the setting live. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return undefined;
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

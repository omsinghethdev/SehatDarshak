import { useEffect, useRef, useState } from 'react';

/**
 * `[ref, inView]`: inView becomes true the first time the element is at least `threshold`
 * visible and then stays true (animations that play once on scroll). Without
 * IntersectionObserver support it is true straight away.
 */
export function useInView({ threshold = 0.35 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(() => typeof window !== 'undefined' && !('IntersectionObserver' in window));
  useEffect(() => {
    if (inView || !ref.current) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        observer.disconnect();
      }
    }, { threshold });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [inView, threshold]);
  return [ref, inView];
}

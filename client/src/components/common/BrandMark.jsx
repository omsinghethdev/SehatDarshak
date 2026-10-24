import { cn } from '../../utils/cn';

/**
 * The Sehat Darshak mark: the same rounded square and pulse line as public/favicon.svg, so the
 * tab icon and the on-page logo match. Decorative only; the surrounding link carries the name.
 * `animated` draws the pulse line once (see .brand-pulse-draw in styles/index.css).
 */
export function BrandMark({ className, animated = false }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0 text-brand-700', className)}
    >
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M6 17h5l2.5-5 4 9 2.5-4H26"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? 'brand-pulse-draw' : undefined}
      />
    </svg>
  );
}

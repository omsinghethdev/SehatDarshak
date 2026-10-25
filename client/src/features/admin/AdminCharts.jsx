import { useId, useState } from 'react';
import { Link } from 'react-router';
import { formatServiceDate } from '../../lib/serviceDates';
import { countOf, formatCount, textLink } from './adminUi';

/*
 * Dependency-free charts for the admin pages. Single series, one brand hue, thin marks on a
 * recessive baseline, values written as text. Each chart has a text alternative: the
 * distribution list is itself text, and the trend chart has a "Show as table" view.
 */

const BAR = 'var(--color-brand-700)';

/**
 * Horizontal bars, one row per item, largest first. Every bar sits next to its number, so the
 * list reads correctly without the bars.
 */
export function DistributionList({ rows, unit, emptyText }) {
  if (rows.length === 0 || rows.every((row) => row.value === 0)) {
    return <p className="rounded-lg border border-dashed border-line bg-white p-4 text-sm text-slate-700">{emptyText}</p>;
  }
  const max = Math.max(...rows.map((row) => row.value), 1);
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  return (
    <ul className="space-y-3">
      {sorted.map((row) => (
        <li key={row.id}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate font-medium text-slate-900">
              {row.href ? <Link to={row.href} className={textLink}>{row.label}</Link> : row.label}
            </span>
            <span className="shrink-0 text-sm text-slate-700 tabular-nums">
              <span className="font-semibold text-slate-900">{formatCount(row.value)}</span> {row.value === 1 ? unit.replace(/s$/, '') : unit}
              {row.detail && <span className="text-slate-600"> · {row.detail}</span>}
            </span>
          </div>
          <div aria-hidden="true" className="mt-1 h-2 rounded-full bg-canvas-muted">
            <div className="h-2 rounded-full" style={{ width: `${(row.value / max) * 100}%`, minWidth: row.value > 0 ? '4px' : 0, background: BAR }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function niceMax(value) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

/**
 * Columns per day. Hovering a column shows its date and value; the same data is available as a
 * table for keyboard and screen-reader users.
 */
export function TrendChart({ points, seriesLabel, unit }) {
  const [hover, setHover] = useState(null);
  const captionId = useId();
  const width = 640;
  const height = 180;
  const left = 32;
  const bottom = 22;
  const top = 8;
  const max = niceMax(Math.max(...points.map((point) => point.value), 0));
  const plotWidth = width - left;
  const plotHeight = height - bottom - top;
  const slot = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.max(Math.min(slot - 2, 28), 2);
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const peak = points.reduce((best, point) => (point.value > (best?.value ?? -1) ? point : best), null);
  const labelEvery = Math.ceil(points.length / 6);

  const summary = points.length === 0
    ? `No ${unit} data.`
    : `${seriesLabel}: ${countOf(total, unit)} in total from ${formatServiceDate(points[0].date)} to ${formatServiceDate(points.at(-1).date)}${peak && peak.value > 0 ? `; highest ${countOf(peak.value, unit)} on ${formatServiceDate(peak.date)}` : ''}.`;

  return (
    <figure className="space-y-2">
      <figcaption id={captionId} className="text-sm text-slate-700">{summary}</figcaption>
      <div className="relative">
        <p aria-hidden="true" className="h-5 text-sm text-slate-900">
          {hover !== null && points[hover] && (
            <>
              <span className="font-semibold">{formatServiceDate(points[hover].date)}</span>: {formatCount(points[hover].value)} {unit}
            </>
          )}
        </p>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby={captionId}
          className="h-auto w-full"
          onMouseLeave={() => setHover(null)}
        >
          {[0, max / 2, max].map((tick) => {
            const y = top + plotHeight - (tick / max) * plotHeight;
            return (
              <g key={tick}>
                <line x1={left} x2={width} y1={y} y2={y} stroke="var(--color-line)" strokeWidth="1" />
                <text x={left - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#475569">{tick}</text>
              </g>
            );
          })}
          {points.map((point, index) => {
            const barHeight = (point.value / max) * plotHeight;
            const x = left + index * slot + (slot - barWidth) / 2;
            return (
              <g key={point.date} onMouseEnter={() => setHover(index)}>
                {/* Full-height hit target, larger than the bar. */}
                <rect x={left + index * slot} y={top} width={slot} height={plotHeight} fill="transparent" />
                {point.value > 0 && (
                  <rect
                    x={x}
                    y={top + plotHeight - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={Math.min(4, barWidth / 2)}
                    fill={BAR}
                    opacity={hover === null || hover === index ? 1 : 0.55}
                  />
                )}
                {(index % labelEvery === 0 || index === points.length - 1) && (
                  <text x={left + index * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="#475569">
                    {point.date.slice(5).replace('-', '/')}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <details className="text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-800">Show as table</summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left">
            <caption className="sr-only">{seriesLabel} by day</caption>
            <thead className="sticky top-0 bg-canvas-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Date</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">{seriesLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {points.map((point) => (
                <tr key={point.date}>
                  <th scope="row" className="px-3 py-1.5 font-normal">{formatServiceDate(point.date)}</th>
                  <td className="px-3 py-1.5 text-right">{formatCount(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

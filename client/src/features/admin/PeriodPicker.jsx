import { useId, useMemo, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '../../components/common/Button';
import { TextField } from '../../components/forms/TextField';
import { describePeriod, resolvePeriod } from '../../lib/serviceDates';
import { cn } from '../../utils/cn';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'last7Days', label: 'Last 7 days' },
  { key: 'last30Days', label: 'Last 30 days' },
  { key: 'custom', label: 'Custom range' },
];

/**
 * The report period from the URL (`?period=&from=&to=`), so a period can be bookmarked and the
 * back button works. Returns `{ period, error }`; an invalid custom range in the URL yields an
 * error instead of silently using another period.
 */
export function usePeriod(defaultPeriod = 'last7Days') {
  const [searchParams] = useSearchParams();
  const key = searchParams.get('period') || defaultPeriod;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  // Stable while the URL period is unchanged, so data loaders keyed on it do not re-run.
  return useMemo(() => {
    const resolved = resolvePeriod({ period: key, from, to });
    return resolved.error ? { period: null, error: resolved.error } : { period: resolved, error: null };
  }, [key, from, to]);
}

/** Today / Last 7 days / Last 30 days / Custom range, applied to the URL. */
export function PeriodPicker({ defaultPeriod = 'last7Days' }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { period, error } = usePeriod(defaultPeriod);
  const current = searchParams.get('period') || defaultPeriod;
  const [showCustom, setShowCustom] = useState(current === 'custom');
  const [from, setFrom] = useState(searchParams.get('from') ?? '');
  const [to, setTo] = useState(searchParams.get('to') ?? '');
  const [formError, setFormError] = useState(null);
  const groupId = useId();

  function apply(next) {
    const params = new URLSearchParams(searchParams);
    params.set('period', next.period);
    params.delete('page');
    if (next.period === 'custom') {
      params.set('from', next.from);
      params.set('to', next.to);
    } else {
      params.delete('from');
      params.delete('to');
    }
    setSearchParams(params);
  }

  function applyCustom(event) {
    event.preventDefault();
    const resolved = resolvePeriod({ period: 'custom', from, to });
    if (resolved.error) {
      setFormError(resolved.error);
      return;
    }
    setFormError(null);
    apply({ period: 'custom', from, to });
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p id={groupId} className="flex items-center gap-2 font-semibold text-slate-900">
          <CalendarRange aria-hidden="true" className="size-5 text-brand-700" />
          Period
        </p>
        <div role="group" aria-labelledby={groupId} className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const selected = preset.key === 'custom' ? showCustom || current === 'custom' : !showCustom && current === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (preset.key === 'custom') {
                    setShowCustom(true);
                  } else {
                    setShowCustom(false);
                    setFormError(null);
                    apply({ period: preset.key });
                  }
                }}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold whitespace-nowrap',
                  selected ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-400 bg-white text-slate-800 hover:border-brand-700 hover:bg-brand-50',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {showCustom && (
        <form noValidate onSubmit={applyCustom} className="flex flex-wrap items-end gap-3">
          <TextField id="period-from" label="From" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-full sm:w-44" />
          <TextField id="period-to" label="To" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-full sm:w-44" />
          <Button type="submit" variant="secondary">Apply range</Button>
          {formError && (
            <p role="alert" className="w-full text-sm font-medium text-red-700">{formError}</p>
          )}
        </form>
      )}

      <p className="text-sm text-slate-700" aria-live="polite">
        {period ? <>Showing <strong>{describePeriod(period)}</strong>, by hospital date (India Standard Time).</> : null}
        {error ? <span className="font-medium text-red-700">{error}</span> : null}
      </p>
    </div>
  );
}

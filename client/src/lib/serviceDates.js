/*
 * Calendar dates ("YYYY-MM-DD") in the hospital time zone, matching the server's report periods
 * (server/ADMIN_API.md → Time zone and periods). Used by the period picker and the mock admin
 * service, so mock reports count days the same way the API does.
 */

export const HOSPITAL_TIME_ZONE = 'Asia/Kolkata';
export const MAX_PERIOD_DAYS = 366;
export const PERIOD_KEYS = Object.freeze(['today', 'last7Days', 'last30Days', 'custom']);
const PERIOD_DAYS = { today: 1, last7Days: 7, last30Days: 30 };

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(instant, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, Number(value)]));
}

export function toServiceDate(instant, timeZone = HOSPITAL_TIME_ZONE) {
  const { year, month, day } = parts(new Date(instant), timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isValidCalendarDate(value) {
  const match = typeof value === 'string' ? datePattern.exec(value) : null;
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function addDays(date, days) {
  const [, year, month, day] = datePattern.exec(date).map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function daysBetweenInclusive(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function listDates(from, to) {
  const dates = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/**
 * `{ key, from, to, days }` for a period, or `{ error }` describing why a custom range is invalid.
 * Same rules as the server: custom ranges are inclusive, from ≤ to, at most 366 days.
 */
export function resolvePeriod({ period = 'last7Days', from, to } = {}, { now = new Date(), timeZone = HOSPITAL_TIME_ZONE } = {}) {
  if (!PERIOD_KEYS.includes(period)) return { error: 'Choose a period.' };
  if (period !== 'custom') {
    const today = toServiceDate(now, timeZone);
    const days = PERIOD_DAYS[period];
    return { key: period, from: addDays(today, -(days - 1)), to: today, days };
  }
  if (!isValidCalendarDate(from) || !isValidCalendarDate(to)) return { error: 'Enter both a start and an end date.' };
  if (from > to) return { error: 'The start date must be on or before the end date.' };
  const days = daysBetweenInclusive(from, to);
  if (days > MAX_PERIOD_DAYS) return { error: `Choose a range of at most ${MAX_PERIOD_DAYS} days.` };
  return { key: 'custom', from, to, days };
}

export function previousPeriod({ from, days }) {
  const to = addDays(from, -1);
  return { key: 'previous', from: addDays(to, -(days - 1)), to, days };
}

// Display helpers (dates are shown in the hospital time zone so they match the reports).
export function formatServiceDate(date) {
  if (!isValidCalendarDate(date)) return '—';
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value, timeZone = HOSPITAL_TIME_ZONE) {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Date(value).toLocaleString(undefined, { timeZone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function describePeriod(period) {
  if (!period) return '';
  const labels = { today: 'Today', last7Days: 'Last 7 days', last30Days: 'Last 30 days' };
  const range = period.from === period.to
    ? formatServiceDate(period.from)
    : `${formatServiceDate(period.from)} – ${formatServiceDate(period.to)}`;
  return labels[period.key] ? `${labels[period.key]} (${range})` : range;
}

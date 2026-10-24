import { validationError } from './httpError.js';

// Calendar dates are "YYYY-MM-DD" strings in the hospital time zone. Instants are JS Dates (UTC).

const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const millisecondsPerDay = 24 * 60 * 60 * 1000;
export const maxReportDays = 366;

const formatters = new Map();
function partsFormatter(timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }));
  }
  return formatters.get(timeZone);
}

function zonedParts(instant, timeZone) {
  const parts = Object.fromEntries(
    partsFormatter(timeZone).formatToParts(instant).map(({ type, value }) => [type, Number(value)]),
  );
  return parts;
}

// The calendar date of an instant in the given zone.
export function toServiceDate(instant, timeZone) {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Offset of the zone from UTC at an instant, in milliseconds.
function zoneOffset(instant, timeZone) {
  const { year, month, day, hour, minute, second } = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// The instant at which a calendar date starts in the zone (handles DST changes).
export function startOfServiceDate(date, timeZone) {
  const [, year, month, day] = datePattern.exec(date).map(Number);
  const guess = Date.UTC(year, month - 1, day);
  let instant = guess - zoneOffset(new Date(guess), timeZone);
  const corrected = guess - zoneOffset(new Date(instant), timeZone);
  if (corrected !== instant) {
    instant = corrected;
  }
  return new Date(instant);
}

export function addDays(date, days) {
  const [, year, month, day] = datePattern.exec(date).map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function daysBetweenInclusive(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / millisecondsPerDay) + 1;
}

export function listDates(from, to) {
  const dates = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}

export function isValidCalendarDate(value) {
  const match = typeof value === 'string' ? datePattern.exec(value) : null;
  if (!match) {
    return false;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function fieldError(field, message) {
  return validationError(`${field}: ${message}`, [{ field, message }]);
}

function parseCalendarDate(value, field) {
  if (!isValidCalendarDate(value)) {
    throw fieldError(field, 'Must be a calendar date in YYYY-MM-DD format');
  }
  return value;
}

export const reportPeriods = ['today', 'last7Days', 'last30Days', 'custom'];

/**
 * Resolves a report period to inclusive calendar dates in the hospital zone and the matching
 * half-open UTC instant range [start, end).
 *   today      — the current local date
 *   last7Days  — the current local date and the six days before it
 *   last30Days — the current local date and the 29 days before it
 *   custom     — `from` and `to` (YYYY-MM-DD, inclusive, at most 366 days)
 * `allowAll` adds `all` (no date restriction) for record lists.
 */
export function parseReportPeriod(query, { timeZone, now = new Date(), defaultPeriod = 'last7Days', allowAll = false } = {}) {
  const allowed = allowAll ? [...reportPeriods, 'all'] : reportPeriods;
  const key = query.period === undefined || query.period === '' ? defaultPeriod : query.period;
  if (typeof key !== 'string' || !allowed.includes(key)) {
    throw fieldError('period', `Must be one of: ${allowed.join(', ')}`);
  }

  const hasFrom = query.from !== undefined && query.from !== '';
  const hasTo = query.to !== undefined && query.to !== '';
  if (key !== 'custom' && (hasFrom || hasTo)) {
    throw fieldError(hasFrom ? 'from' : 'to', 'Only allowed when period is custom');
  }

  if (key === 'all') {
    return { key, from: null, to: null, days: null, start: null, end: null };
  }

  const today = toServiceDate(now, timeZone);
  let from;
  let to;
  if (key === 'custom') {
    if (!hasFrom) throw fieldError('from', 'Required when period is custom');
    if (!hasTo) throw fieldError('to', 'Required when period is custom');
    from = parseCalendarDate(query.from, 'from');
    to = parseCalendarDate(query.to, 'to');
    if (from > to) {
      throw fieldError('from', 'Must not be after to');
    }
    if (daysBetweenInclusive(from, to) > maxReportDays) {
      throw fieldError('to', `The period can cover at most ${maxReportDays} days`);
    }
  } else {
    const days = { today: 1, last7Days: 7, last30Days: 30 }[key];
    to = today;
    from = addDays(today, -(days - 1));
  }

  return resolveDates(key, from, to, timeZone);
}

export function resolveDates(key, from, to, timeZone) {
  return {
    key,
    from,
    to,
    days: daysBetweenInclusive(from, to),
    start: startOfServiceDate(from, timeZone),
    end: startOfServiceDate(addDays(to, 1), timeZone),
  };
}

// The period of the same length that ends the day before `period` starts.
export function previousPeriod(period, timeZone) {
  const to = addDays(period.from, -1);
  const from = addDays(to, -(period.days - 1));
  return resolveDates('previous', from, to, timeZone);
}

// ISO 8601 timestamp filter values (as used by the audit endpoints); inclusive bounds.
export function parseOptionalTimestamp(value, field) {
  if (value === undefined || value === '') {
    return undefined;
  }
  const time = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(value)
    ? Date.parse(value)
    : NaN;
  if (Number.isNaN(time)) {
    throw fieldError(field, 'Must be an ISO 8601 timestamp');
  }
  return new Date(time);
}

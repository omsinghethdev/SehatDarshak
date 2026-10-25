import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HospitalConfigurationError, getHospitalTimeZone } from '../src/config/hospital.js';
import {
  addDays,
  isValidCalendarDate,
  parseReportPeriod,
  previousPeriod,
  startOfServiceDate,
  toServiceDate,
} from '../src/utils/dates.js';

describe('hospital-time-zone dates', () => {
  test('service dates follow the hospital zone, not UTC', () => {
    // 00:10 on 3 March in India is still 2 March in UTC.
    const instant = new Date('2026-03-02T18:40:00Z');
    assert.equal(toServiceDate(instant, 'Asia/Kolkata'), '2026-03-03');
    assert.equal(toServiceDate(instant, 'UTC'), '2026-03-02');
  });

  test('start of a service date is local midnight, including across DST changes', () => {
    assert.equal(startOfServiceDate('2026-03-03', 'Asia/Kolkata').toISOString(), '2026-03-02T18:30:00.000Z');
    assert.equal(startOfServiceDate('2026-03-03', 'UTC').toISOString(), '2026-03-03T00:00:00.000Z');
    // New York: EST (UTC-5) before 8 March 2026, EDT (UTC-4) from 8 March.
    assert.equal(startOfServiceDate('2026-03-08', 'America/New_York').toISOString(), '2026-03-08T05:00:00.000Z');
    assert.equal(startOfServiceDate('2026-03-09', 'America/New_York').toISOString(), '2026-03-09T04:00:00.000Z');
  });

  test('periods resolve to inclusive local dates and half-open instants', () => {
    const now = new Date('2026-03-02T19:00:00Z'); // 00:30 on 3 March in India
    const today = parseReportPeriod({ period: 'today' }, { timeZone: 'Asia/Kolkata', now });
    assert.deepEqual([today.from, today.to, today.days], ['2026-03-03', '2026-03-03', 1]);
    assert.equal(today.start.toISOString(), '2026-03-02T18:30:00.000Z');
    assert.equal(today.end.toISOString(), '2026-03-03T18:30:00.000Z');

    const week = parseReportPeriod({}, { timeZone: 'Asia/Kolkata', now });
    assert.deepEqual([week.key, week.from, week.to, week.days], ['last7Days', '2026-02-25', '2026-03-03', 7]);

    const previous = previousPeriod(week, 'Asia/Kolkata');
    assert.deepEqual([previous.from, previous.to, previous.days], ['2026-02-18', '2026-02-24', 7]);
  });

  test('calendar validation and date arithmetic', () => {
    assert.equal(isValidCalendarDate('2028-02-29'), true);
    assert.equal(isValidCalendarDate('2026-02-29'), false);
    assert.equal(isValidCalendarDate('2026-3-1'), false);
    assert.equal(addDays('2026-02-28', 1), '2026-03-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  });

  test('HOSPITAL_TIMEZONE defaults to Asia/Kolkata and rejects unknown zones', () => {
    assert.equal(getHospitalTimeZone(''), 'Asia/Kolkata');
    assert.equal(getHospitalTimeZone('UTC'), 'UTC');
    assert.throws(() => getHospitalTimeZone('Mars/Olympus'), HospitalConfigurationError);
  });
});

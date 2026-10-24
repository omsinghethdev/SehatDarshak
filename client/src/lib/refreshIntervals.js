/**
 * Background refresh intervals for patient pages (used with hooks/useAutoRefresh.js). The open
 * token page polls faster (QUEUE_POLL_INTERVAL_MS in features/queue/queueService.js) because
 * that is where a patient follows their turn; these pages are overviews.
 */

/** Patient dashboard: active tokens. */
export const DASHBOARD_REFRESH_INTERVAL_MS = 30_000;

/** Assistance page: the patient's request history, so staff acknowledgements appear. */
export const ASSISTANCE_REFRESH_INTERVAL_MS = 30_000;

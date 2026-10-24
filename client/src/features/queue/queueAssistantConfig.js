function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/**
 * Average minutes per consultation, used ONLY when the service does not supply its own
 * `estimatedWaitMinutes` (and by the mock queue to simulate one). Override with
 * VITE_QUEUE_AVERAGE_SERVICE_MINUTES. It is an assumption, not hospital data.
 */
export const AVERAGE_SERVICE_MINUTES = positiveNumber(import.meta.env.VITE_QUEUE_AVERAGE_SERVICE_MINUTES, 5);

/**
 * "Turn approaching" alerts fire when the number of patients ahead drops to or below one of
 * these values (largest first). Each threshold alerts once per crossing.
 */
export const TURN_ALERT_THRESHOLDS = Object.freeze([3, 1]);

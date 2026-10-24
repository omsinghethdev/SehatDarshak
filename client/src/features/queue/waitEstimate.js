import { englishTranslator } from '../../i18n/translate';
import { AVERAGE_SERVICE_MINUTES } from './queueAssistantConfig';

/** A queue count we can show: a whole number, zero or more. */
export function isReliableCount(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Work out what waiting-time estimate (if any) to show for a token.
 *
 * 1. `service`     — the service's own `estimatedWaitMinutes` (docs/API_CONTRACT.md), shown with
 *                    the service's `estimateLabel`. Preferred whenever it is a valid number.
 * 2. `calculated`  — the service gave a reliable `patientsAhead` but no usable estimate, so we
 *                    calculate patientsAhead × AVERAGE_SERVICE_MINUTES on this device.
 * 3. `unavailable` — neither is usable; we say so rather than guessing.
 * 4. `notWaiting`  — the token is not waiting, so a waiting estimate does not apply.
 */
export function getWaitEstimate(token, averageServiceMinutes = AVERAGE_SERVICE_MINUTES) {
  if (token?.status !== 'waiting') return { kind: 'notWaiting' };

  const minutes = token.estimatedWaitMinutes;
  if (typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 0) {
    return { kind: 'service', minutes: Math.round(minutes), serviceLabel: token.estimateLabel || null };
  }
  if (isReliableCount(token.patientsAhead)) {
    return {
      kind: 'calculated',
      minutes: token.patientsAhead * averageServiceMinutes,
      patientsAhead: token.patientsAhead,
      averageMinutes: averageServiceMinutes,
    };
  }
  return { kind: 'unavailable' };
}

/**
 * Label for an estimate. The service's documented label "Simulated estimate" is shown in the
 * patient's language; any other service label is shown as received.
 */
export function estimateLabel(estimate, t = englishTranslator.t) {
  if (estimate.kind === 'calculated') return t('estimate.calculatedLabel');
  if (estimate.serviceLabel === 'Simulated estimate') return t('queue.simulatedEstimate');
  return estimate.serviceLabel ?? t('estimate.serviceLabel');
}

/** Approximate, human wording. Never a clock time, so it cannot be read as an appointment. */
export function formatEstimate(minutes, t = englishTranslator.t) {
  if (minutes <= 0) return t('estimate.anyMoment');
  if (minutes < 60) return t('estimate.aboutMinutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? t('estimate.aboutHoursMinutes', { hours, minutes: rest }) : t('estimate.aboutHours', { count: hours });
}

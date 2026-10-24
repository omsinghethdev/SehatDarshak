import { useCallback, useEffect, useRef, useState } from 'react';
import { TURN_ALERT_THRESHOLDS } from './queueAssistantConfig';
import { isReliableCount } from './waitEstimate';

/**
 * Decide whether a change from `before` to `after` deserves an alert. Pure, so it is easy to
 * reason about: alerts come only from genuine transitions, never from the initial load.
 */
export function getTurnAlert(before, after, thresholds = TURN_ALERT_THRESHOLDS) {
  if (!before || before.id !== after.id) return null;

  if (after.status !== before.status) {
    if (after.status === 'called') return { kind: 'called' };
    if (after.status === 'skipped') return { kind: 'skipped' };
    // Other changes (e.g. consultation started, completed) are announced but not shown as an
    // alert box — the page's next-step panel already shows them.
    return { kind: 'status', status: after.status };
  }

  if (after.status === 'waiting' && before.ahead !== null && after.ahead !== null && after.ahead < before.ahead) {
    // The most urgent threshold crossed by this change (e.g. 4 → 1 crosses 3 and 1 → alert once for 1).
    const crossed = thresholds.filter((t) => before.ahead > t && after.ahead <= t);
    if (crossed.length > 0) return { kind: 'approaching', ahead: after.ahead };
  }
  return null;
}

function snapshot(token) {
  return { id: token.id, status: token.status, ahead: isReliableCount(token.patientsAhead) ? token.patientsAhead : null };
}

/**
 * In-app alerts for a patient's token: "turn approaching", "called", and "skipped".
 * The first value seen is only a baseline, and the effect re-runs only when the id, status,
 * or position actually changes — so polling or re-rendering the same data never repeats an alert.
 */
export function useTurnAlerts(token) {
  const previous = useRef(null);
  const [alert, setAlert] = useState(null);
  const sequence = useRef(0);

  const id = token?.id;
  const status = token?.status;
  const ahead = token?.patientsAhead;

  useEffect(() => {
    if (!id) return;
    const after = snapshot({ id, status, patientsAhead: ahead });
    const before = previous.current;
    previous.current = after;

    const next = getTurnAlert(before, after);
    if (next) {
      // A newer alert replaces any older one (e.g. "approaching" once consultation starts).
      sequence.current += 1;
      setAlert({ ...next, key: sequence.current });
    }
  }, [id, status, ahead]);

  const dismiss = useCallback(() => setAlert(null), []);
  return { alert, dismiss };
}

import { BellRing, CheckCircle2, Clock, SkipForward, Stethoscope, XCircle } from 'lucide-react';

/** Status vocabulary and transitions from docs/API_CONTRACT.md → Queue tokens. */
export const QUEUE_STATUSES = Object.freeze([
  'waiting',
  'called',
  'in_consultation',
  'completed',
  'skipped',
  'cancelled',
]);

export const ACTIVE_STATUSES = Object.freeze(['waiting', 'called', 'in_consultation']);
export const TERMINAL_STATUSES = Object.freeze(['completed', 'skipped', 'cancelled']);

export const STATUS_TRANSITIONS = Object.freeze({
  waiting: ['called', 'cancelled'],
  called: ['in_consultation', 'skipped', 'cancelled'],
  in_consultation: ['completed', 'cancelled'],
  completed: [],
  skipped: [],
  cancelled: [],
});

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

/**
 * Every status has a text label, a description, and an icon, so meaning never relies on colour.
 * The UI shows translated labels/descriptions (status.* in src/i18n/locales); these English
 * values remain for mock server messages and staff tools.
 */
export const STATUS_DETAILS = Object.freeze({
  waiting: {
    label: 'Waiting',
    description: 'You are in the queue. Please stay near the department.',
    icon: Clock,
    badgeClass: 'border-sky-300 bg-sky-50 text-sky-900',
  },
  called: {
    label: 'Called',
    description: 'It is your turn. Please go to the department’s consultation room now.',
    icon: BellRing,
    badgeClass: 'border-amber-400 bg-amber-50 text-amber-950',
  },
  in_consultation: {
    label: 'In consultation',
    description: 'Your consultation is in progress.',
    icon: Stethoscope,
    badgeClass: 'border-brand-200 bg-brand-50 text-brand-900',
  },
  completed: {
    label: 'Completed',
    description: 'Your consultation is complete. This token is no longer active.',
    icon: CheckCircle2,
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-800',
  },
  skipped: {
    label: 'Skipped',
    description:
      'Your token was skipped because you were not present when called. Please speak to staff at the department desk.',
    icon: SkipForward,
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-800',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'This token was cancelled and is no longer active.',
    icon: XCircle,
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-800',
  },
});

export function formatWaitMinutes(minutes) {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return '—';
  if (minutes <= 0) return 'Any moment now';
  return `About ${minutes} min`;
}

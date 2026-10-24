import { CheckCircle2, Clock } from 'lucide-react';

/** Safety wording shown near the form and after every submission. */
export const ASSISTANCE_SAFETY_NOTICE =
  "Assistance requests are for non-emergency help. Sending a request does not guarantee an immediate response. For emergencies, contact hospital staff directly or use the hospital's designated emergency process.";

/*
 * Client-side length limits. The contract does not define limits, so these are sensible
 * UI defaults (mirrored by the mock service); the server remains the authority.
 */
export const LOCATION_MIN = 3;
export const LOCATION_MAX = 120;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 500;

/** Validate the documented request fields: departmentId, location, message. */
export function validateAssistanceRequest({ departmentId, location, message }) {
  const errors = {};
  if (!departmentId) errors.departmentId = 'Choose the department you need help with.';

  const trimmedLocation = location.trim();
  if (!trimmedLocation) errors.location = 'Tell us where you are or where help is needed.';
  else if (trimmedLocation.length < LOCATION_MIN) errors.location = `Use at least ${LOCATION_MIN} characters.`;
  else if (trimmedLocation.length > LOCATION_MAX) errors.location = `Use ${LOCATION_MAX} characters or fewer.`;

  const trimmedMessage = message.trim();
  if (!trimmedMessage) errors.message = 'Describe the help you need.';
  else if (trimmedMessage.length < MESSAGE_MIN) errors.message = `Please add a little more detail (at least ${MESSAGE_MIN} characters).`;
  else if (trimmedMessage.length > MESSAGE_MAX) errors.message = `Use ${MESSAGE_MAX} characters or fewer.`;

  return errors;
}

/** The two documented statuses (open → acknowledged), each with text and an icon. */
export const ASSISTANCE_STATUS_DETAILS = Object.freeze({
  open: {
    label: 'Open',
    description: 'Not yet acknowledged by hospital staff.',
    icon: Clock,
    badgeClass: 'border-amber-400 bg-amber-50 text-amber-950',
  },
  acknowledged: {
    label: 'Acknowledged',
    description: 'A staff member has acknowledged this request.',
    icon: CheckCircle2,
    badgeClass: 'border-brand-200 bg-brand-50 text-brand-900',
  },
});

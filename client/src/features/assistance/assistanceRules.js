import { CheckCircle2, Clock } from 'lucide-react';
import { englishTranslator } from '../../i18n/translate';

/**
 * Safety wording shown near the form and after every submission. Patient pages show the
 * translated version (assistance.safety); staff tools use this English text.
 */
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

/**
 * Validate the documented request fields: departmentId, location, message.
 * `t` defaults to English (used by the mock to imitate server messages); forms pass messageRef.
 */
export function validateAssistanceRequest({ departmentId, location, message }, t = englishTranslator.t) {
  const errors = {};
  if (!departmentId) errors.departmentId = t('validation.assistanceDepartment');

  const trimmedLocation = location.trim();
  if (!trimmedLocation) errors.location = t('validation.locationRequired');
  else if (trimmedLocation.length < LOCATION_MIN) errors.location = t('validation.tooShort', { min: LOCATION_MIN });
  else if (trimmedLocation.length > LOCATION_MAX) errors.location = t('validation.tooLong', { max: LOCATION_MAX });

  const trimmedMessage = message.trim();
  if (!trimmedMessage) errors.message = t('validation.messageRequired');
  else if (trimmedMessage.length < MESSAGE_MIN) errors.message = t('validation.messageTooShort', { min: MESSAGE_MIN });
  else if (trimmedMessage.length > MESSAGE_MAX) errors.message = t('validation.tooLong', { max: MESSAGE_MAX });

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

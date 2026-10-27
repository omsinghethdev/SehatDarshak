/** Strip everything except digits and a leading "+" so the value is safe in tel:/sms: links. */
function normalisePhone(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits ? `${trimmed.startsWith('+') ? '+' : ''}${digits}` : '';
}

/** India's national ambulance number unless overridden with VITE_AMBULANCE_PHONE. */
export const AMBULANCE_PHONE = normalisePhone(import.meta.env.VITE_AMBULANCE_PHONE) || '108';

/**
 * The hospital's emergency line. There is no safe default — dialling a made-up number in an
 * emergency would be worse than no button — so "Call hospital" stays disabled until it is set.
 */
export const HOSPITAL_PHONE = normalisePhone(import.meta.env.VITE_HOSPITAL_PHONE);

// The hospital's local time zone. Service dates ("which day was this visit?"), report periods such
// as "today" or "last 7 days", and daily trends are all calculated in this zone, so a visit at
// 00:30 local time is counted on the local day, not the UTC day.
const defaultTimeZone = 'Asia/Kolkata';

export class HospitalConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HospitalConfigurationError';
  }
}

export function getHospitalTimeZone(value = process.env.HOSPITAL_TIMEZONE) {
  const timeZone = value?.trim() || defaultTimeZone;

  try {
    // Throws a RangeError for unknown IANA zone names.
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
  } catch {
    throw new HospitalConfigurationError(
      'HOSPITAL_TIMEZONE must be an IANA time zone name such as Asia/Kolkata.',
    );
  }

  return timeZone;
}

import { PATHS } from '../../routes/paths';

/*
 * Sehat Darshak QR payload contract (frontend only, version 1)
 * -----------------------------------------------------------
 * Every QR code contains an app URL to the /scan route — so a phone's own camera app can open it
 * directly — with exactly these query parameters:
 *
 *   /scan?type=hospital&v=1                     Hospital entry / general information
 *   /scan?type=department&id=<departmentId>&v=1 A department (e.g. dept_demo_opd)
 *   /scan?type=location&id=<locationId>&v=1     A mapped place (e.g. room_registration)
 *   /scan?type=queue&id=<departmentId>&v=1      A department's queue entry point
 *
 * IDs are the existing department / map-location IDs from the services. `v` is optional and must
 * be "1". The URL's origin must be this app's own origin (or VITE_PUBLIC_APP_URL). Anything else —
 * another site, another path, unknown parameters, malformed IDs — is rejected, and the app never
 * redirects to a URL taken from a QR code: it only navigates to paths it builds itself.
 */

export const QR_PAYLOAD_VERSION = '1';
export const QR_TYPES = Object.freeze(['hospital', 'department', 'location', 'queue']);
const TYPES_WITH_ID = new Set(['department', 'location', 'queue']);
const ID_PATTERN = /^[a-z0-9_]{1,64}$/;
const MAX_LENGTH = 512;

/** Public base URL for generated QR codes (VITE_PUBLIC_APP_URL), if it is a valid http(s) URL. */
export function publicAppOrigin() {
  const raw = (import.meta.env?.VITE_PUBLIC_APP_URL ?? '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
  } catch {
    return null;
  }
}

function allowedOrigins() {
  return new Set([window.location.origin, publicAppOrigin()].filter(Boolean));
}

const fail = (reason) => ({ ok: false, reason });

/**
 * Validate scanned or typed QR content. Returns `{ ok: true, payload: { type, id? } }` or
 * `{ ok: false, reason }` where reason is one of: empty, tooLong, notUrl, externalUrl,
 * unsupportedRoute, unsupportedType, unsupportedVersion, missingId, invalidId, unexpectedParam.
 * Only checks the format; whether the ID exists is checked when the destination is loaded.
 */
export function parseQrPayload(input) {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return fail('empty');
  if (text.length > MAX_LENGTH) return fail('tooLong');

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(text);
  if (!hasScheme && !text.startsWith('/')) return fail('notUrl');

  let url;
  try {
    url = new URL(text, window.location.origin);
  } catch {
    return fail('notUrl');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return fail('notUrl');
  if (url.username || url.password) return fail('externalUrl');
  // Checked for relative input too: "//other.site/scan" and "/\other.site" resolve off-site.
  if (!allowedOrigins().has(url.origin)) return fail('externalUrl');
  if (url.pathname.replace(/\/+$/, '') !== PATHS.scan) return fail('unsupportedRoute');
  if (url.hash) return fail('unexpectedParam');

  const params = url.searchParams;
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length) return fail('unexpectedParam');

  const type = params.get('type');
  if (!type) return fail('unsupportedType');
  if (!QR_TYPES.includes(type)) return fail('unsupportedType');

  const allowed = new Set(['type', 'v', ...(TYPES_WITH_ID.has(type) ? ['id'] : [])]);
  if (keys.some((key) => !allowed.has(key))) return fail('unexpectedParam');
  if (params.has('v') && params.get('v') !== QR_PAYLOAD_VERSION) return fail('unsupportedVersion');

  if (!TYPES_WITH_ID.has(type)) return { ok: true, payload: { type } };
  const id = params.get('id');
  if (!id) return fail('missingId');
  if (!ID_PATTERN.test(id)) return fail('invalidId');
  return { ok: true, payload: { type, id } };
}

/** The in-app path for a validated payload (the only thing the app ever navigates to). */
export function buildScanPath({ type, id }) {
  const params = new URLSearchParams({ type });
  if (id) params.set('id', id);
  params.set('v', QR_PAYLOAD_VERSION);
  return `${PATHS.scan}?${params}`;
}

/** Absolute URL to encode in a QR code. */
export function buildQrUrl(payload, origin) {
  return `${origin}${buildScanPath(payload)}`;
}

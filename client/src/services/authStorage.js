export const SESSION_STORAGE_KEY = 'sehatdarsak.session';

const ROLES = ['patient', 'staff', 'admin'];

/**
 * A session is only accepted if it has the shape returned by the auth endpoints
 * in docs/API_CONTRACT.md: `{ accessToken, user: { id, name, role } }`, where staff users also
 * carry `departmentId` (a string, or null when unassigned). Staff sessions saved before the
 * API returned a department are rejected, so those users simply sign in again.
 */
export function isValidSession(session) {
  const user = session?.user;
  return Boolean(
    session &&
      typeof session.accessToken === 'string' &&
      session.accessToken.length > 0 &&
      user &&
      typeof user.id === 'string' &&
      typeof user.name === 'string' &&
      ROLES.includes(user.role) &&
      (user.role !== 'staff' || user.departmentId === null || typeof user.departmentId === 'string'),
  );
}

export function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return isValidSession(session) ? session : null;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can be unavailable (private mode, quota). The in-memory session still works.
  }
}

export function clearStoredSession() {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function getAccessToken() {
  return readSession()?.accessToken ?? null;
}

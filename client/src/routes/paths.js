export const PATHS = Object.freeze({
  home: '/',
  login: '/login',
  register: '/register',
  dashboard: '/dashboard',
  departments: '/departments',
  navigation: '/navigation',
  assistance: '/assistance',
  staffQueue: '/staff/queue',
  staffAssistance: '/staff/assistance',
  admin: '/admin',
  bookToken: '/queue/book',
  tokenStatus: '/queue/tokens/:tokenId',
  unauthorized: '/unauthorized',
});

export function tokenStatusPath(tokenId) {
  return `/queue/tokens/${encodeURIComponent(tokenId)}`;
}

export function bookTokenPath(departmentId) {
  return departmentId
    ? `${PATHS.bookToken}?department=${encodeURIComponent(departmentId)}`
    : PATHS.bookToken;
}

/** Assistance page, optionally pre-selecting a department (the patient can still change it). */
export function assistancePath(departmentId) {
  return departmentId
    ? `${PATHS.assistance}?department=${encodeURIComponent(departmentId)}`
    : PATHS.assistance;
}

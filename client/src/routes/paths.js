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
  scan: '/scan',
  qrCodes: '/qr-codes',
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

/** Hospital map with one location selected (the map page's existing deep link). */
export function mapLocationPath(floorId, locationId) {
  return `${PATHS.navigation}?${new URLSearchParams({ floor: floorId, location: locationId })}`;
}

/** Assistance page, optionally pre-selecting a department (the patient can still change it). */
export function assistancePath(departmentId) {
  return departmentId
    ? `${PATHS.assistance}?department=${encodeURIComponent(departmentId)}`
    : PATHS.assistance;
}

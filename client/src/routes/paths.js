export const PATHS = Object.freeze({
  home: '/',
  login: '/login',
  register: '/register',
  registerPatient: '/register/patient',
  registerStaffOpd: '/register/staff-opd',
  registerStaffMed: '/register/staff-general-medicine',
  registerAdmin: '/register/admin',
  dashboard: '/dashboard',
  departments: '/departments',
  navigation: '/navigation',
  assistance: '/assistance',
  staffQueue: '/staff/queue',
  staffAssistance: '/staff/assistance',
  admin: '/admin',
  adminDoctors: '/admin/doctors',
  adminDoctorNew: '/admin/doctors/new',
  adminDoctor: '/admin/doctors/:staffId',
  adminStaff: '/admin/staff',
  adminStaffNew: '/admin/staff/new',
  adminStaffMember: '/admin/staff/:staffId',
  adminVisits: '/admin/visits',
  adminVisit: '/admin/visits/:visitId',
  adminPatient: '/admin/patients/:patientId',
  adminDepartments: '/admin/departments',
  adminDepartment: '/admin/departments/:departmentId',
  adminWard: '/admin/wards/:wardId',
  adminActivity: '/admin/activity',
  scan: '/scan',
  qrCodes: '/qr-codes',
  bookToken: '/queue/book',
  tokenStatus: '/queue/tokens/:tokenId',
  unauthorized: '/unauthorized',
});

/** Registration form for each account category (see features/auth/accountTypes.js). */
export const REGISTER_PATHS = Object.freeze({
  patient: PATHS.registerPatient,
  staff_opd: PATHS.registerStaffOpd,
  staff_med: PATHS.registerStaffMed,
  admin: PATHS.registerAdmin,
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

/** Admin record pages. Doctors and general staff are one account type with separate sections. */
export const adminStaffPath = (staffType, staffId) =>
  `${staffType === 'doctor' ? PATHS.adminDoctors : PATHS.adminStaff}/${encodeURIComponent(staffId)}`;
export const adminVisitPath = (visitId) => `${PATHS.adminVisits}/${encodeURIComponent(visitId)}`;
export const adminPatientPath = (patientId) => `/admin/patients/${encodeURIComponent(patientId)}`;
export const adminDepartmentPath = (departmentId) => `${PATHS.adminDepartments}/${encodeURIComponent(departmentId)}`;
export const adminWardPath = (wardId) => `/admin/wards/${encodeURIComponent(wardId)}`;

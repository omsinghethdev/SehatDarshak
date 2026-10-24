/*
 * DEVELOPMENT-ONLY simulated demo accounts for mock mode. They have no passwords and exist
 * only so each role can be demonstrated. Never treat them as production authentication.
 *
 * The demo patient (`user_demo_01`, Asha Devi) is canonical (docs/SHARED_INTEGRATION_CONTRACT.md §6).
 * The staff and admin accounts are additional fictional accounts. A staff member's department
 * assignment is server-only data in the contract; here it is mock-internal and is never
 * returned in the public user object.
 */
export const MOCK_DEMO_ACCOUNTS = Object.freeze([
  {
    key: 'patient',
    buttonLabel: 'Continue as demo patient',
    description: 'Asha Devi — patient',
    identifier: 'demo.patient',
    user: { id: 'user_demo_01', name: 'Asha Devi', role: 'patient' },
  },
  {
    key: 'staff_opd',
    buttonLabel: 'Continue as demo staff (Demo OPD)',
    description: 'Staff assigned to Demo OPD',
    identifier: 'demo.staff.opd',
    user: { id: 'user_demo_staff_opd', name: 'Demo Staff (OPD)', role: 'staff' },
    departmentId: 'dept_demo_opd',
  },
  {
    key: 'staff_med',
    buttonLabel: 'Continue as demo staff (General Medicine)',
    description: 'Staff assigned to General Medicine',
    identifier: 'demo.staff.med',
    user: { id: 'user_demo_staff_med', name: 'Demo Staff (Medicine)', role: 'staff' },
    departmentId: 'dept_demo_med',
  },
  {
    key: 'admin',
    buttonLabel: 'Continue as demo administrator',
    description: 'Administrator — statistics and queue monitoring',
    identifier: 'demo.admin',
    user: { id: 'user_demo_admin', name: 'Demo Administrator', role: 'admin' },
  },
]);

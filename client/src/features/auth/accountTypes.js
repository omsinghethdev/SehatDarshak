/**
 * The account categories offered on the registration page. An account's role and staff
 * department come only from this table, looked up by the category the user chose — never from
 * form fields — so registration cannot grant arbitrary roles or departments.
 *
 * Only `patient` can be registered against the real API (docs/API_CONTRACT.md: public
 * registration always creates a patient and must not accept a role or department). The other
 * categories exist only as development-only mock accounts; see mockAuthService.registerDemoAccount.
 */
export const ACCOUNT_TYPES = Object.freeze({
  patient: Object.freeze({ role: 'patient', departmentId: null }),
  staff_opd: Object.freeze({ role: 'staff', departmentId: 'dept_demo_opd' }),
  staff_med: Object.freeze({ role: 'staff', departmentId: 'dept_demo_med' }),
  admin: Object.freeze({ role: 'admin', departmentId: null }),
});

export const ACCOUNT_TYPE_KEYS = Object.freeze(Object.keys(ACCOUNT_TYPES));

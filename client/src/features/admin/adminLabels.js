// Human-readable labels for admin records and audit entries.

export const STAFF_TYPE_LABELS = { doctor: 'Doctor', staff: 'Staff member' };

export const ACTION_LABELS = {
  staff_created: 'Account created',
  staff_profile_updated: 'Profile updated',
  staff_assignment_changed: 'Assignment changed',
  staff_deactivated: 'Account deactivated',
  staff_reactivated: 'Account reactivated',
  staff_password_reset: 'Temporary password issued',
  password_changed: 'Password changed by the user',
  visit_metadata_corrected: 'Visit details corrected',
  ward_created: 'Ward created',
  ward_updated: 'Ward updated',
  ward_deactivated: 'Ward deactivated',
  ward_reactivated: 'Ward reactivated',
};

export const TARGET_LABELS = { staff: 'Staff account', account: 'Account', visit: 'Visit', ward: 'Ward' };

export const FIELD_LABELS = {
  name: 'Name',
  code: 'Code',
  departmentId: 'Department',
  wardId: 'Ward',
  floorId: 'Floor',
  staffType: 'Role type',
  isActive: 'Status',
  phone: 'Phone',
  email: 'Email',
  designation: 'Designation',
  specialization: 'Specialization',
  registrationNumber: 'Registration number',
  adminNote: 'Administrative note',
  description: 'Description',
};

export const VISIT_STATUS_OPTIONS = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'not_completed', label: 'Not completed' },
];

/**
 * One audit change as text. The server records only the field name for personal or free-text
 * fields (phone, email, registration number, notes), so those read "changed (value not recorded)".
 */
export function describeChange(change, names = {}) {
  const label = FIELD_LABELS[change.field] ?? change.field;
  if (!('from' in change) && !('to' in change)) return `${label} changed (value not recorded)`;
  const show = (value) => {
    if (value === null || value === undefined) return 'none';
    if (change.field === 'isActive') return value ? 'active' : 'deactivated';
    if (change.field === 'staffType') return STAFF_TYPE_LABELS[value] ?? value;
    if (change.field === 'departmentId') return names.departments?.get(value) ?? value;
    if (change.field === 'wardId') return names.wards?.get(value) ?? value;
    return String(value);
  };
  return `${label}: ${show(change.from)} → ${show(change.to)}`;
}

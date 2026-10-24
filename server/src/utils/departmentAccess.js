// Admins may act on any department; staff only on their assigned department.
export function canManageDepartment(user, departmentId) {
  if (user.role === 'admin') {
    return true;
  }

  return user.role === 'staff' && Boolean(user.departmentId) && user.departmentId === departmentId;
}

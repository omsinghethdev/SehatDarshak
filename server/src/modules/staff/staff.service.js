import { randomBytes } from 'node:crypto';
import { auditEntry, diffFields } from '../audit/auditEntry.schema.js';
import { Department } from '../departments/department.model.js';
import { User, isActiveAccount, staffTypeOf } from '../users/user.model.js';
import { Ward } from '../wards/ward.model.js';
import { hashPassword } from '../../utils/password.js';
import { conflictError, notFoundError, validationError } from '../../utils/httpError.js';
import { escapeRegex } from '../../utils/requestValidation.js';
import { doctorOnlyFields, profileFields } from './staff.validation.js';

/*
 * Admin management of staff accounts (role `staff`), including doctors (`staffType: "doctor"`).
 * These operations never create admins, never change a user's role, and never touch patients:
 * every query is restricted to `role: "staff"`, so other users are reported as not found.
 * Accounts are deactivated, never deleted, so tokens, visits, and audit history stay intact.
 */

const duplicateKeyErrorCode = 11000;

// Contact details and registration numbers are personal data: the audit trail records that they
// changed, but not their values.
const valueRedactedFields = new Set(['phone', 'email', 'registrationNumber']);

const staffNotFound = () => notFoundError('Staff account not found');

async function namesFor(users) {
  const departmentIds = [...new Set(users.map((user) => user.departmentId).filter(Boolean))];
  const wardIds = [...new Set(users.map((user) => user.wardId).filter(Boolean))];
  const [departments, wards] = await Promise.all([
    departmentIds.length ? Department.find({ _id: { $in: departmentIds } }).select('name').lean() : [],
    wardIds.length ? Ward.find({ _id: { $in: wardIds } }).select('name').lean() : [],
  ]);
  return {
    departments: new Map(departments.map((department) => [department._id, department.name])),
    wards: new Map(wards.map((ward) => [ward._id, ward.name])),
  };
}

// Admin-only account shape. Extends the contract's StaffAccount fields; never includes
// passwordHash, audit entries, or token data.
export function toStaffAccount(user, names = { departments: new Map(), wards: new Map() }) {
  return {
    id: String(user._id),
    name: user.name,
    identifier: user.identifier,
    role: 'staff',
    staffType: staffTypeOf(user),
    departmentId: user.departmentId ?? null,
    departmentName: names.departments.get(user.departmentId) ?? null,
    wardId: user.wardId ?? null,
    wardName: names.wards.get(user.wardId) ?? null,
    isActive: isActiveAccount(user),
    ...Object.fromEntries(profileFields.filter((field) => user[field]).map((field) => [field, user[field]])),
    mustChangePassword: Boolean(user.mustChangePassword),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function presentOne(user) {
  return toStaffAccount(user, await namesFor([user]));
}

async function requireActiveDepartment(departmentId) {
  if (!(await Department.exists({ _id: departmentId, isActive: true }))) {
    throw notFoundError('Department not found');
  }
}

async function requireActiveWard(wardId) {
  if (!(await Ward.exists({ _id: wardId, isActive: true }))) {
    throw notFoundError('Ward not found');
  }
}

function auditChanges(changes) {
  return changes.map((change) => (valueRedactedFields.has(change.field) ? { field: change.field } : change));
}

export async function listStaff({ departmentId, wardId, staffType, isActive, search, pagination }) {
  const filter = {
    role: 'staff',
    ...(departmentId ? { departmentId } : {}),
    ...(wardId ? { wardId } : {}),
    // Accounts created before staffType existed are general staff.
    ...(staffType === 'doctor' ? { staffType: 'doctor' } : {}),
    ...(staffType === 'staff' ? { staffType: { $ne: 'doctor' } } : {}),
    // Accounts created before isActive existed are active.
    ...(isActive === true ? { isActive: { $ne: false } } : {}),
    ...(isActive === false ? { isActive: false } : {}),
  };
  if (search) {
    const pattern = escapeRegex(search);
    filter.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { identifier: { $regex: `^${escapeRegex(search.toLowerCase())}` } },
      { specialization: { $regex: pattern, $options: 'i' } },
    ];
  }

  const { page, limit, skip } = pagination;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const names = await namesFor(users);
  return { data: users.map((user) => toStaffAccount(user, names)), meta: { page, limit, total } };
}

export async function getStaff(staffId) {
  const user = await User.findOne({ _id: staffId, role: 'staff' }).lean();
  if (!user) {
    throw staffNotFound();
  }
  return presentOne(user);
}

export async function createStaff(admin, input) {
  await requireActiveDepartment(input.departmentId);
  if (input.wardId) {
    await requireActiveWard(input.wardId);
  }
  if (await User.exists({ identifier: input.identifier })) {
    throw conflictError('Username is already taken');
  }

  const { password, ...fields } = input;
  const initialValues = ['name', 'departmentId', 'staffType', 'wardId', 'designation', 'specialization']
    .filter((field) => fields[field] !== undefined)
    .map((field) => ({ field, from: null, to: fields[field] }));

  let user;
  try {
    user = await User.create({
      ...fields,
      role: 'staff',
      isActive: true,
      passwordHash: await hashPassword(password),
      auditTrail: [auditEntry(admin, 'staff_created', initialValues)],
    });
  } catch (error) {
    if (error?.code === duplicateKeyErrorCode) {
      throw conflictError('Username is already taken');
    }
    throw error;
  }

  return presentOne(user.toObject());
}

// Groups field changes into audit actions, so deactivation and re-assignment are easy to find.
function auditEntriesFor(admin, changes) {
  const groups = {
    staff_assignment_changed: changes.filter((change) => ['departmentId', 'wardId', 'staffType'].includes(change.field)),
    staff_profile_updated: changes.filter((change) => ['name', ...profileFields].includes(change.field)),
  };
  const entries = Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([action, list]) => auditEntry(admin, action, auditChanges(list)));

  const status = changes.find((change) => change.field === 'isActive');
  if (status) {
    entries.push(auditEntry(admin, status.to ? 'staff_reactivated' : 'staff_deactivated', [status]));
  }
  return entries;
}

export async function updateStaff(admin, staffId, input) {
  const before = await User.findOne({ _id: staffId, role: 'staff' }).lean();
  if (!before) {
    throw staffNotFound();
  }

  if (input.departmentId !== undefined) {
    await requireActiveDepartment(input.departmentId);
  }
  if (input.wardId) {
    await requireActiveWard(input.wardId);
  }

  // Current values, with defaults for accounts created before these fields existed.
  const current = { ...before, staffType: staffTypeOf(before), isActive: isActiveAccount(before) };
  const next = { ...input };
  const resultingType = next.staffType ?? current.staffType;
  if (resultingType !== 'doctor') {
    const invalid = doctorOnlyFields.filter((field) => next[field]);
    if (invalid.length > 0) {
      throw validationError(`${invalid[0]}: Only allowed for doctors (staffType "doctor")`,
        invalid.map((field) => ({ field, message: 'Only allowed for doctors (staffType "doctor")' })));
    }
    // A doctor changed to general staff no longer keeps doctor-only details.
    for (const field of doctorOnlyFields) {
      if (current[field] && next[field] === undefined) next[field] = null;
    }
  }

  const changes = diffFields(current, next, Object.keys(next));
  if (changes.length === 0) {
    return presentOne(before);
  }

  const $set = {};
  const $unset = {};
  for (const { field, to } of changes) {
    if (to === null) $unset[field] = '';
    else $set[field] = to;
  }

  // Compare-and-set on the previous stored values of the changed fields, so two admins editing
  // the same account at once cannot silently overwrite each other (or audit a stale "from").
  const filter = { _id: staffId, role: 'staff' };
  for (const { field } of changes) {
    filter[field] = before[field] ?? null;
  }

  const updated = await User.findOneAndUpdate(
    filter,
    {
      ...(Object.keys($set).length ? { $set } : {}),
      ...(Object.keys($unset).length ? { $unset } : {}),
      $push: { auditTrail: { $each: auditEntriesFor(admin, changes) } },
    },
    { new: true, lean: true },
  );
  if (!updated) {
    throw conflictError('This staff account was changed by another request. Reload and try again.');
  }
  return presentOne(updated);
}

// Issues a random temporary password, shown to the admin once and never stored or logged in
// plain text. Existing sessions of the account end immediately (tokens issued before the reset
// are rejected), and the account is flagged to choose a new password via
// POST /api/auth/change-password.
export async function resetStaffPassword(admin, staffId) {
  const temporaryPassword = randomBytes(12).toString('base64url');
  const updated = await User.findOneAndUpdate(
    { _id: staffId, role: 'staff' },
    {
      $set: {
        passwordHash: await hashPassword(temporaryPassword),
        passwordChangedAt: new Date(),
        mustChangePassword: true,
      },
      $push: { auditTrail: auditEntry(admin, 'staff_password_reset') },
    },
    { new: true, lean: true },
  );
  if (!updated) {
    throw staffNotFound();
  }

  return { temporaryPassword, mustChangePassword: true };
}

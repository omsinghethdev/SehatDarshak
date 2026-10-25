import {
  checkIdentifier,
  checkName,
  checkNewPassword,
  collectUnknownFields,
  requireObjectBody,
  throwIfInvalid,
} from '../auth/auth.validation.js';
import { staffTypes } from '../users/user.model.js';
import {
  isValidResourceId,
  parseOptionalBooleanQuery,
  parseOptionalEnumValue,
  parseOptionalResourceId,
  parseOptionalSearch,
  parsePagination,
} from '../../utils/requestValidation.js';

// Optional profile fields. Professional details are free text the app cannot verify, so none is
// mandatory and none affects permissions.
const profileRules = {
  phone: { maxLength: 20, pattern: /^\+?[0-9][0-9 -]{5,18}[0-9]$/, message: 'Must be a phone number (digits, spaces, hyphens, optional leading +)' },
  email: { maxLength: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Must be an email address' },
  designation: { maxLength: 100 },
  specialization: { maxLength: 100 },
  registrationNumber: { maxLength: 40, pattern: /^[A-Za-z0-9/.-]+$/, message: 'Use letters, numbers, slashes, dots, or hyphens' },
};
export const profileFields = Object.keys(profileRules);
export const doctorOnlyFields = ['specialization', 'registrationNumber'];

const createFields = ['name', 'identifier', 'password', 'departmentId', 'staffType', 'wardId', ...profileFields];
const updateFields = ['name', 'departmentId', 'wardId', 'staffType', 'isActive', ...profileFields];

function checkProfileField(field, value, details, { nullable }) {
  if (value === undefined) return undefined;
  if (value === null || (typeof value === 'string' && !value.trim())) {
    if (nullable) return null;
    return undefined; // Blank optional values on create are simply not stored.
  }
  if (typeof value !== 'string') {
    details.push({ field, message: 'Must be text' });
    return undefined;
  }
  const text = value.trim();
  const rule = profileRules[field];
  if (text.length > rule.maxLength) {
    details.push({ field, message: `Must be at most ${rule.maxLength} characters` });
  } else if (rule.pattern && !rule.pattern.test(text)) {
    details.push({ field, message: rule.message });
  }
  return field === 'email' ? text.toLowerCase() : text;
}

function checkResourceId(field, value, details, { nullable }) {
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (!isValidResourceId(value)) {
    details.push({ field, message: nullable ? 'Must be a valid ID or null' : 'Must be a valid ID' });
  }
  return value;
}

function checkStaffType(value, details) {
  if (value === undefined) return undefined;
  if (!staffTypes.includes(value)) {
    details.push({ field: 'staffType', message: `Must be one of: ${staffTypes.join(', ')}` });
  }
  return value;
}

function checkDoctorOnlyFields(values, staffType, details) {
  if (staffType === 'doctor') return;
  for (const field of doctorOnlyFields) {
    if (values[field]) {
      details.push({ field, message: 'Only allowed for doctors (staffType "doctor")' });
    }
  }
}

// `role`, `isActive`, and any other server-controlled field are rejected as unknown fields.
export function validateCreateStaffInput(body) {
  requireObjectBody(body);
  const details = [];
  collectUnknownFields(body, createFields, details);

  const values = {
    name: checkName(body.name, details),
    identifier: checkIdentifier(body.identifier, details),
    password: checkNewPassword(body.password, details),
    departmentId: checkResourceId('departmentId', body.departmentId, details, { nullable: false }),
    staffType: checkStaffType(body.staffType, details) ?? 'staff',
    wardId: checkResourceId('wardId', body.wardId, details, { nullable: false }),
  };
  if (body.departmentId === undefined) {
    details.push({ field: 'departmentId', message: 'Required' });
  }
  for (const field of profileFields) {
    values[field] = checkProfileField(field, body[field], details, { nullable: false });
  }
  checkDoctorOnlyFields(values, values.staffType, details);

  throwIfInvalid(details);
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

// Returns only the provided fields. `null` clears a ward or profile field; a department is
// required for staff, so `departmentId: null` is rejected (docs/API_CONTRACT.md → Update staff).
export function validateUpdateStaffInput(body) {
  requireObjectBody(body);
  const details = [];
  collectUnknownFields(body, updateFields, details);

  const values = {};
  if (body.name !== undefined) values.name = checkName(body.name, details);
  if (body.departmentId !== undefined) {
    values.departmentId = checkResourceId('departmentId', body.departmentId, details, { nullable: false });
  }
  if (body.wardId !== undefined) values.wardId = checkResourceId('wardId', body.wardId, details, { nullable: true });
  if (body.staffType !== undefined) values.staffType = checkStaffType(body.staffType, details);
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') {
      details.push({ field: 'isActive', message: 'Must be true or false' });
    }
    values.isActive = body.isActive;
  }
  for (const field of profileFields) {
    if (body[field] !== undefined) values[field] = checkProfileField(field, body[field], details, { nullable: true });
  }

  if (details.length === 0 && Object.keys(values).length === 0) {
    details.push({ field: 'body', message: `Provide at least one of: ${updateFields.join(', ')}` });
  }

  throwIfInvalid(details);
  return values;
}

export function parseStaffListQuery(query) {
  return {
    departmentId: parseOptionalResourceId(query.departmentId, 'departmentId'),
    wardId: parseOptionalResourceId(query.wardId, 'wardId'),
    staffType: parseOptionalEnumValue(query.staffType, 'staffType', staffTypes),
    isActive: parseOptionalBooleanQuery(query.isActive, 'isActive'),
    search: parseOptionalSearch(query.q),
    pagination: parsePagination(query),
  };
}

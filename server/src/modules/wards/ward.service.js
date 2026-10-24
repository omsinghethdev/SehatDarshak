import { auditEntry, diffFields } from '../audit/auditEntry.schema.js';
import { Department } from '../departments/department.model.js';
import { Floor } from '../map/floor.model.js';
import { User } from '../users/user.model.js';
import { Visit } from '../visits/visit.model.js';
import { conflictError, notFoundError, validationError } from '../../utils/httpError.js';
import {
  parseBoolean,
  parseNullableResourceId,
  parseObjectBody,
  parseOptionalBooleanQuery,
  parseOptionalResourceId,
  parseOptionalText,
  parsePagination,
  parseRequiredText,
} from '../../utils/requestValidation.js';
import { Ward, wardCodePattern, wardIdFromCode } from './ward.model.js';

const duplicateKeyErrorCode = 11000;
const nameMaxLength = 100;
const descriptionMaxLength = 300;
const wardNotFound = () => notFoundError('Ward not found');

export function parseWardListQuery(query) {
  return {
    departmentId: parseOptionalResourceId(query.departmentId, 'departmentId'),
    isActive: parseOptionalBooleanQuery(query.isActive, 'isActive'),
    pagination: parsePagination(query),
  };
}

export function validateCreateWardInput(body) {
  parseObjectBody(body, ['name', 'code', 'description', 'departmentId', 'floorId']);
  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : body.code;
  if (typeof code !== 'string' || !wardCodePattern.test(code)) {
    throw validationError('code: Must be 2-16 characters using letters, numbers, or hyphens', [
      { field: 'code', message: 'Must be 2-16 characters using letters, numbers, or hyphens' },
    ]);
  }
  return {
    name: parseRequiredText(body.name, 'name', nameMaxLength),
    code,
    description: parseOptionalText(body.description, 'description', descriptionMaxLength, { nullable: true }) ?? undefined,
    departmentId: parseNullableResourceId(body.departmentId, 'departmentId') ?? undefined,
    floorId: parseNullableResourceId(body.floorId, 'floorId') ?? undefined,
  };
}

// The code (and therefore the ID) is permanent; other fields can change. `null` clears the
// optional department, floor, or description.
export function validateUpdateWardInput(body) {
  parseObjectBody(body, ['name', 'description', 'departmentId', 'floorId', 'isActive']);
  const values = {};
  if (body.name !== undefined) values.name = parseRequiredText(body.name, 'name', nameMaxLength);
  if (body.description !== undefined) {
    values.description = parseOptionalText(body.description, 'description', descriptionMaxLength, { nullable: true });
  }
  if (body.departmentId !== undefined) values.departmentId = parseNullableResourceId(body.departmentId, 'departmentId');
  if (body.floorId !== undefined) values.floorId = parseNullableResourceId(body.floorId, 'floorId');
  if (body.isActive !== undefined) values.isActive = parseBoolean(body.isActive, 'isActive');

  if (Object.keys(values).length === 0) {
    throw validationError('body: Provide at least one of: name, description, departmentId, floorId, isActive', [
      { field: 'body', message: 'Provide at least one of: name, description, departmentId, floorId, isActive' },
    ]);
  }
  return values;
}

async function requireReferences({ departmentId, floorId }) {
  if (departmentId && !(await Department.exists({ _id: departmentId, isActive: true }))) {
    throw notFoundError('Department not found');
  }
  if (floorId && !(await Floor.exists({ _id: floorId, isActive: true }))) {
    throw notFoundError('Floor not found');
  }
}

async function present(wards) {
  const ids = wards.map((ward) => ward._id);
  const departmentIds = [...new Set(wards.map((ward) => ward.departmentId).filter(Boolean))];
  const floorIds = [...new Set(wards.map((ward) => ward.floorId).filter(Boolean))];
  const [departments, floors, staffCounts] = await Promise.all([
    Department.find({ _id: { $in: departmentIds } }).select('name').lean(),
    Floor.find({ _id: { $in: floorIds } }).select('displayName').lean(),
    User.aggregate([
      { $match: { role: 'staff', wardId: { $in: ids }, isActive: { $ne: false } } },
      { $group: { _id: { wardId: '$wardId', doctor: { $eq: ['$staffType', 'doctor'] } }, count: { $sum: 1 } } },
    ]),
  ]);
  const departmentNames = new Map(departments.map((item) => [item._id, item.name]));
  const floorNames = new Map(floors.map((item) => [item._id, item.displayName]));
  const counts = new Map();
  for (const { _id: { wardId, doctor }, count } of staffCounts) {
    const entry = counts.get(wardId) ?? { doctors: 0, staff: 0 };
    entry[doctor ? 'doctors' : 'staff'] += count;
    counts.set(wardId, entry);
  }

  return wards.map((ward) => ({
    id: ward._id,
    name: ward.name,
    code: ward.code,
    ...(ward.description ? { description: ward.description } : {}),
    departmentId: ward.departmentId ?? null,
    departmentName: departmentNames.get(ward.departmentId) ?? null,
    floorId: ward.floorId ?? null,
    floorName: floorNames.get(ward.floorId) ?? null,
    isActive: ward.isActive !== false,
    activeAssignedStaff: counts.get(ward._id) ?? { doctors: 0, staff: 0 },
    createdAt: ward.createdAt.toISOString(),
    updatedAt: ward.updatedAt.toISOString(),
  }));
}

export async function listWards({ departmentId, isActive, pagination }) {
  const filter = {
    ...(departmentId ? { departmentId } : {}),
    ...(isActive === true ? { isActive: { $ne: false } } : {}),
    ...(isActive === false ? { isActive: false } : {}),
  };
  const { page, limit, skip } = pagination;
  const [wards, total] = await Promise.all([
    Ward.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    Ward.countDocuments(filter),
  ]);
  return { data: await present(wards), meta: { page, limit, total } };
}

export async function getWard(wardId) {
  const ward = await Ward.findById(wardId).lean();
  if (!ward) {
    throw wardNotFound();
  }
  const [item] = await present([ward]);
  // All-time count of visits recorded against the ward (filter by date via /api/admin/visits).
  return { ...item, visitsRecorded: await Visit.countDocuments({ wardId }) };
}

export async function createWard(admin, input) {
  await requireReferences(input);
  const _id = wardIdFromCode(input.code);
  const fields = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
  const initial = Object.entries(fields)
    .filter(([field]) => field !== 'description')
    .map(([field, to]) => ({ field, from: null, to }));

  try {
    const ward = await Ward.create({ _id, ...fields, isActive: true, auditTrail: [auditEntry(admin, 'ward_created', initial)] });
    const [item] = await present([ward.toObject()]);
    return item;
  } catch (error) {
    if (error?.code === duplicateKeyErrorCode) {
      throw conflictError('A ward with this code already exists');
    }
    throw error;
  }
}

export async function updateWard(admin, wardId, input) {
  const before = await Ward.findById(wardId).lean();
  if (!before) {
    throw wardNotFound();
  }
  await requireReferences(input);

  const current = { ...before, isActive: before.isActive !== false };
  const changes = diffFields(current, input, Object.keys(input));
  if (changes.length === 0) {
    const [item] = await present([before]);
    return item;
  }

  const $set = {};
  const $unset = {};
  for (const { field, to } of changes) {
    if (to === null) $unset[field] = '';
    else $set[field] = to;
  }
  const filter = { _id: wardId };
  for (const { field } of changes) {
    filter[field] = before[field] ?? null;
  }

  const entries = [];
  const details = changes.filter((change) => change.field !== 'isActive');
  if (details.length > 0) entries.push(auditEntry(admin, 'ward_updated', details));
  const status = changes.find((change) => change.field === 'isActive');
  if (status) entries.push(auditEntry(admin, status.to ? 'ward_reactivated' : 'ward_deactivated', [status]));

  const updated = await Ward.findOneAndUpdate(
    filter,
    {
      ...(Object.keys($set).length ? { $set } : {}),
      ...(Object.keys($unset).length ? { $unset } : {}),
      $push: { auditTrail: { $each: entries } },
    },
    { new: true, lean: true },
  );
  if (!updated) {
    throw conflictError('This ward was changed by another request. Reload and try again.');
  }
  const [item] = await present([updated]);
  return item;
}

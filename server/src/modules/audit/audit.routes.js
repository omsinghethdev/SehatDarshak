import { Router } from 'express';
import mongoose from 'mongoose';
import { QueueToken } from '../tokens/queueToken.model.js';
import { User } from '../users/user.model.js';
import { Visit } from '../visits/visit.model.js';
import { Ward } from '../wards/ward.model.js';
import { parseOptionalTimestamp } from '../../utils/dates.js';
import { validationError } from '../../utils/httpError.js';
import {
  parseOptionalEnumValue,
  parseOptionalResourceId,
  parseOptionalUserId,
  parsePagination,
} from '../../utils/requestValidation.js';
import { auditActions } from './auditEntry.schema.js';

// Mounted under /api/admin/audit; the admin router authenticates and requires the admin role.
// Read-only: there are no endpoints to create, edit, or delete audit entries.
export const auditAdminRouter = Router();

function parseTimeRange(query) {
  const from = parseOptionalTimestamp(query.from, 'from');
  const to = parseOptionalTimestamp(query.to, 'to');
  if (from && to && from > to) {
    throw validationError('from: Must not be after to', [{ field: 'from', message: 'Must not be after to' }]);
  }
  return {
    ...(from ? { $gte: from } : {}),
    ...(to ? { $lte: to } : {}),
  };
}

async function actorNames(entries) {
  const ids = [...new Set(entries.map((entry) => String(entry.actorId)))];
  const users = await User.find({ _id: { $in: ids } }).select('name').lean();
  return new Map(users.map((user) => [String(user._id), user.name]));
}

// docs/API_CONTRACT.md → Admin: queue-token status audit history. Entries contain no patient identity.
auditAdminRouter.get('/queue-token-status-changes', async (request, response) => {
  const { query } = request;
  const tokenId = parseOptionalResourceId(query.tokenId, 'tokenId');
  const departmentId = parseOptionalResourceId(query.departmentId, 'departmentId');
  const actorId = parseOptionalUserId(query.actorId, 'actorId');
  const occurredAt = parseTimeRange(query);
  const { page, limit, skip } = parsePagination(query);

  const entryFilter = {
    ...(actorId ? { 'statusHistory.actorId': new mongoose.Types.ObjectId(actorId) } : {}),
    ...(Object.keys(occurredAt).length ? { 'statusHistory.occurredAt': occurredAt } : {}),
  };

  const [result] = await QueueToken.aggregate([
    {
      $match: {
        ...(tokenId ? { _id: tokenId } : {}),
        ...(departmentId ? { departmentId } : {}),
        'statusHistory.0': { $exists: true },
        ...entryFilter,
      },
    },
    { $unwind: '$statusHistory' },
    { $match: entryFilter },
    { $sort: { 'statusHistory.occurredAt': -1, 'statusHistory._id': -1 } },
    {
      $facet: {
        data: [
          { $skip: skip },
          { $limit: limit },
          { $project: { displayNumber: 1, departmentId: 1, statusHistory: 1 } },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  response.status(200).json({
    data: result.data.map(({ _id, displayNumber, departmentId: department, statusHistory: entry }) => ({
      id: String(entry._id),
      tokenId: _id,
      displayNumber,
      departmentId: department,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      action: entry.action,
      actor: { id: String(entry.actorId), role: entry.actorRole },
      occurredAt: entry.occurredAt.toISOString(),
    })),
    meta: { page, limit, total: result.total[0]?.count ?? 0 },
  });
});

const targetTypes = ['staff', 'account', 'visit', 'ward'];

// Administrative actions on staff accounts, other accounts (own password changes), visits, and
// wards. Visit entries name only the visit ID; patient accounts are never named.
auditAdminRouter.get('/admin-actions', async (request, response) => {
  const { query } = request;
  const targetType = parseOptionalEnumValue(query.targetType, 'targetType', targetTypes);
  // Staff/account IDs (ObjectIds) and visit/ward IDs all match the resource-ID format.
  const targetId = parseOptionalResourceId(query.targetId, 'targetId');
  const actorId = parseOptionalUserId(query.actorId, 'actorId');
  const action = parseOptionalEnumValue(query.action, 'action', auditActions);
  const occurredAt = parseTimeRange(query);
  const { page, limit, skip } = parsePagination(query);

  const flatten = (type, nameExpression) => [
    { $match: { 'auditTrail.0': { $exists: true } } },
    { $unwind: '$auditTrail' },
    {
      $project: {
        _id: 0,
        targetType: type,
        targetId: { $toString: '$_id' },
        targetName: nameExpression,
        entry: '$auditTrail',
      },
    },
  ];

  const filter = {
    ...(targetType ? { targetType } : {}),
    ...(targetId ? { targetId } : {}),
    ...(actorId ? { 'entry.actorId': new mongoose.Types.ObjectId(actorId) } : {}),
    ...(action ? { 'entry.action': action } : {}),
    ...(Object.keys(occurredAt).length ? { 'entry.occurredAt': occurredAt } : {}),
  };

  const [result] = await User.aggregate([
    ...flatten(
      { $cond: [{ $eq: ['$role', 'staff'] }, 'staff', 'account'] },
      { $cond: [{ $eq: ['$role', 'patient'] }, null, '$name'] },
    ),
    { $unionWith: { coll: Visit.collection.name, pipeline: flatten('visit', null) } },
    { $unionWith: { coll: Ward.collection.name, pipeline: flatten('ward', '$name') } },
    { $match: filter },
    { $sort: { 'entry.occurredAt': -1, 'entry._id': -1 } },
    { $facet: { data: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'count' }] } },
  ]);

  const names = await actorNames(result.data.map(({ entry }) => entry));
  response.status(200).json({
    data: result.data.map(({ targetType: type, targetId: id, targetName, entry }) => ({
      id: String(entry._id),
      targetType: type,
      targetId: id,
      targetName: targetName ?? null,
      action: entry.action,
      actor: { id: String(entry.actorId), role: entry.actorRole, name: names.get(String(entry.actorId)) ?? null },
      occurredAt: entry.occurredAt.toISOString(),
      changes: entry.changes ?? [],
    })),
    meta: { page, limit, total: result.total[0]?.count ?? 0 },
  });
});

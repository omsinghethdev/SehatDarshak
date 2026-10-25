import mongoose from 'mongoose';
import { getHospitalTimeZone } from '../../config/hospital.js';
import { auditEntry, diffFields } from '../audit/auditEntry.schema.js';
import { Department } from '../departments/department.model.js';
import { QueueToken } from '../tokens/queueToken.model.js';
import { User, staffTypeOf } from '../users/user.model.js';
import { Ward } from '../wards/ward.model.js';
import { addDays, startOfServiceDate } from '../../utils/dates.js';
import { conflictError, notFoundError } from '../../utils/httpError.js';
import { Visit, parseVisitId, visitStatuses } from './visit.model.js';
import {
  consultedByExpression,
  countWhere,
  isActiveStatus,
  visitKeyExpression,
  visitStatusExpression,
} from './visitAggregation.js';

const visitNotFound = () => notFoundError('Visit not found');

export { visitStatuses };

async function lookupNames({ patientIds = [], departmentIds = [], wardIds = [], userIds = [] }) {
  const unique = (values) => [...new Set(values.filter(Boolean).map(String))];
  const [patients, departments, wards, users] = await Promise.all([
    User.find({ _id: { $in: unique(patientIds) } }).select('name identifier').lean(),
    Department.find({ _id: { $in: unique(departmentIds) } }).select('name code').lean(),
    Ward.find({ _id: { $in: unique(wardIds) } }).select('name').lean(),
    User.find({ _id: { $in: unique(userIds) } }).select('name role staffType').lean(),
  ]);
  return {
    patients: new Map(patients.map((item) => [String(item._id), item])),
    departments: new Map(departments.map((item) => [item._id, item])),
    wards: new Map(wards.map((item) => [item._id, item])),
    users: new Map(users.map((item) => [String(item._id), item])),
  };
}

const patientSummary = (names, patientId) => {
  const patient = names.patients.get(String(patientId));
  return { id: String(patientId), name: patient?.name ?? null, identifier: patient?.identifier ?? null };
};
const departmentRef = (names, id) => ({ id, name: names.departments.get(id)?.name ?? null });
const staffRef = (names, id) => {
  if (!id) return null;
  const user = names.users.get(String(id));
  return { id: String(id), name: user?.name ?? null, role: user?.role ?? null, ...(user?.role === 'staff' ? { staffType: staffTypeOf(user) } : {}) };
};

/**
 * Visits matching the filters, newest first. Each item is one encounter (patient + service date),
 * however many departments and tokens it involved.
 */
export async function listVisits({ period, patientId, departmentId, wardId, doctorId, status, pagination }) {
  const timeZone = getHospitalTimeZone();
  const { page, limit, skip } = pagination;

  const match = {
    ...(period.start ? { issuedAt: { $gte: period.start, $lt: period.end } } : {}),
    ...(patientId ? { patientId: new mongoose.Types.ObjectId(patientId) } : {}),
  };
  const filters = {
    ...(departmentId ? { departmentIds: departmentId } : {}),
    ...(wardId ? { wardId } : {}),
    ...(doctorId ? { doctorIds: new mongoose.Types.ObjectId(doctorId) } : {}),
    ...(status ? { status } : {}),
  };

  const [result] = await QueueToken.aggregate([
    { $match: match },
    {
      $project: {
        visitKey: visitKeyExpression(timeZone),
        patientId: 1,
        departmentId: 1,
        status: 1,
        issuedAt: 1,
        consultedBy: consultedByExpression,
      },
    },
    {
      $group: {
        _id: '$visitKey',
        patientId: { $first: '$patientId' },
        firstTokenAt: { $min: '$issuedAt' },
        departmentIds: { $addToSet: '$departmentId' },
        doctorIds: { $addToSet: '$consultedBy' },
        tokens: { $sum: 1 },
        activeTokens: countWhere(isActiveStatus),
        completedTokens: countWhere({ $eq: ['$status', 'completed'] }),
      },
    },
    { $addFields: { status: visitStatusExpression } },
    { $lookup: { from: Visit.collection.name, localField: '_id', foreignField: '_id', as: 'record' } },
    { $addFields: { wardId: { $first: '$record.wardId' }, adminNote: { $first: '$record.adminNote' } } },
    { $match: filters },
    { $sort: { firstTokenAt: -1, _id: -1 } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }, { $project: { record: 0 } }],
        total: [{ $count: 'count' }],
      },
    },
  ]);

  const visits = result.data;
  const names = await lookupNames({
    patientIds: visits.map((visit) => visit.patientId),
    departmentIds: visits.flatMap((visit) => visit.departmentIds),
    wardIds: visits.map((visit) => visit.wardId),
  });

  return {
    data: visits.map((visit) => ({
      id: visit._id,
      serviceDate: parseVisitId(visit._id)?.serviceDate ?? null,
      status: visit.status,
      patient: patientSummary(names, visit.patientId),
      departments: visit.departmentIds.sort().map((id) => departmentRef(names, id)),
      ward: visit.wardId ? { id: visit.wardId, name: names.wards.get(visit.wardId)?.name ?? null } : null,
      tokenCount: visit.tokens,
      consultationsCompleted: visit.completedTokens,
      firstTokenAt: visit.firstTokenAt.toISOString(),
    })),
    meta: { page, limit, total: result.total[0]?.count ?? 0 },
  };
}

// Tokens of one visit: those linked by visitId, plus pre-visit tokens of the same patient issued
// on the same service date.
async function findVisitTokens(visitId) {
  const parsed = parseVisitId(visitId);
  if (!parsed) {
    return { parsed: null, tokens: [] };
  }
  const timeZone = getHospitalTimeZone();
  const dayStart = startOfServiceDate(parsed.serviceDate, timeZone);
  const dayEnd = startOfServiceDate(addDays(parsed.serviceDate, 1), timeZone);
  const tokens = await QueueToken.find({
    $or: [
      { visitId },
      { visitId: { $exists: false }, patientId: parsed.patientId, issuedAt: { $gte: dayStart, $lt: dayEnd } },
    ],
  })
    .select('+statusHistory')
    .sort({ issuedAt: 1, _id: 1 })
    .lean();
  return { parsed, tokens };
}

function deriveStatus(tokens) {
  if (tokens.some((token) => ['waiting', 'called', 'in_consultation'].includes(token.status))) return 'in_progress';
  if (tokens.some((token) => token.status === 'completed')) return 'completed';
  return 'not_completed';
}

export async function getVisit(visitId) {
  const { parsed, tokens } = await findVisitTokens(visitId);
  if (!parsed || tokens.length === 0) {
    throw visitNotFound();
  }

  const record = await Visit.findById(visitId).lean();
  const consultedBy = (token) => {
    const starts = (token.statusHistory ?? []).filter((change) => change.toStatus === 'in_consultation');
    return starts.at(-1)?.actorId ?? null;
  };
  const names = await lookupNames({
    patientIds: [parsed.patientId],
    departmentIds: tokens.map((token) => token.departmentId),
    wardIds: [record?.wardId],
    userIds: tokens.flatMap((token) => (token.statusHistory ?? []).map((change) => change.actorId)),
  });
  const departmentIds = [...new Set(tokens.map((token) => token.departmentId))].sort();

  return {
    id: visitId,
    serviceDate: parsed.serviceDate,
    status: deriveStatus(tokens),
    patient: patientSummary(names, parsed.patientId),
    departments: departmentIds.map((id) => departmentRef(names, id)),
    ward: record?.wardId ? { id: record.wardId, name: names.wards.get(record.wardId)?.name ?? null } : null,
    adminNote: record?.adminNote ?? null,
    firstTokenAt: tokens[0].issuedAt.toISOString(),
    tokens: tokens.map((token) => ({
      id: token._id,
      displayNumber: token.displayNumber,
      department: departmentRef(names, token.departmentId),
      status: token.status,
      issuedAt: token.issuedAt.toISOString(),
      calledAt: token.calledAt?.toISOString() ?? null,
      completedAt: token.completedAt?.toISOString() ?? null,
      consultedBy: staffRef(names, consultedBy(token)),
      statusHistory: (token.statusHistory ?? []).map((change) => ({
        fromStatus: change.fromStatus,
        toStatus: change.toStatus,
        action: change.action,
        actor: staffRef(names, change.actorId),
        occurredAt: change.occurredAt.toISOString(),
      })),
    })),
  };
}

/**
 * Corrects a visit's administrative metadata: its ward and a short administrative note. Tokens,
 * statuses, dates, and patients are never editable here, so recorded queue history stays intact.
 * The note's text is not copied into the audit trail.
 */
export async function correctVisit(admin, visitId, input) {
  const { parsed, tokens } = await findVisitTokens(visitId);
  if (!parsed || tokens.length === 0) {
    throw visitNotFound();
  }
  if (input.wardId && !(await Ward.exists({ _id: input.wardId, isActive: true }))) {
    throw notFoundError('Ward not found');
  }

  // Visits from before visit records existed get their record now, derived from their tokens.
  try {
    await Visit.updateOne(
      { _id: visitId },
      {
        $setOnInsert: {
          patientId: parsed.patientId,
          serviceDate: parsed.serviceDate,
          firstTokenAt: tokens[0].issuedAt,
          source: 'correction',
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  const before = await Visit.findById(visitId).lean();
  const changes = diffFields(before, input, Object.keys(input));
  if (changes.length > 0) {
    const $set = {};
    const $unset = {};
    for (const { field, to } of changes) {
      if (to === null) $unset[field] = '';
      else $set[field] = to;
    }
    const filter = { _id: visitId };
    for (const { field } of changes) {
      filter[field] = before[field] ?? null;
    }
    const audited = changes.map((change) => (change.field === 'adminNote' ? { field: 'adminNote' } : change));

    const updated = await Visit.findOneAndUpdate(
      filter,
      {
        ...(Object.keys($set).length ? { $set } : {}),
        ...(Object.keys($unset).length ? { $unset } : {}),
        $push: { auditTrail: auditEntry(admin, 'visit_metadata_corrected', audited) },
      },
      { new: true },
    );
    if (!updated) {
      throw conflictError('This visit was changed by another request. Reload and try again.');
    }
  }

  return getVisit(visitId);
}

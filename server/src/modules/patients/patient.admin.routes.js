import { Router } from 'express';
import mongoose from 'mongoose';
import { getHospitalTimeZone } from '../../config/hospital.js';
import { AssistanceRequest } from '../assistance/assistanceRequest.model.js';
import { Department } from '../departments/department.model.js';
import { QueueToken } from '../tokens/queueToken.model.js';
import { User, isActiveAccount } from '../users/user.model.js';
import { countWhere, isActiveStatus, visitKeyExpression } from '../visits/visitAggregation.js';
import { parseVisitId } from '../visits/visit.model.js';
import { notFoundError } from '../../utils/httpError.js';
import {
  escapeRegex,
  parseOptionalSearch,
  parsePagination,
  parseUserId,
} from '../../utils/requestValidation.js';

/*
 * Admin patient lookup. Patients are found by the identifiers the system holds: their username,
 * their name, or their account ID. Only the stored registration fields are returned; the app
 * holds no medical records. Visit history is listed with GET /api/admin/visits?patientId=…
 */
export const patientAdminRouter = Router();

const objectIdPattern = /^[a-f0-9]{24}$/i;

function toAdminPatient(user) {
  return {
    id: String(user._id),
    name: user.name,
    identifier: user.identifier,
    ...(user.preferredLanguage ? { preferredLanguage: user.preferredLanguage } : {}),
    isActive: isActiveAccount(user),
    registeredAt: user.createdAt.toISOString(),
  };
}

patientAdminRouter.get('/', async (request, response) => {
  const search = parseOptionalSearch(request.query.q);
  const { page, limit, skip } = parsePagination(request.query);

  const filter = { role: 'patient' };
  if (search) {
    filter.$or = [
      { identifier: { $regex: `^${escapeRegex(search.toLowerCase())}` } },
      { name: { $regex: escapeRegex(search), $options: 'i' } },
      ...(objectIdPattern.test(search) ? [{ _id: new mongoose.Types.ObjectId(search) }] : []),
    ];
  }

  const [patients, total] = await Promise.all([
    User.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  response.status(200).json({ data: patients.map(toAdminPatient), meta: { page, limit, total } });
});

patientAdminRouter.get('/:patientId', async (request, response) => {
  const patientId = parseUserId(request.params.patientId, 'patientId');
  const patient = await User.findOne({ _id: patientId, role: 'patient' }).lean();
  if (!patient) {
    throw notFoundError('Patient not found');
  }

  const timeZone = getHospitalTimeZone();
  const objectId = new mongoose.Types.ObjectId(patientId);
  const [[summary], byDepartment, assistanceRequests] = await Promise.all([
    QueueToken.aggregate([
      { $match: { patientId: objectId } },
      { $project: { visitKey: visitKeyExpression(timeZone), status: 1 } },
      {
        $group: {
          _id: '$visitKey',
          tokens: { $sum: 1 },
          completed: countWhere({ $eq: ['$status', 'completed'] }),
          active: countWhere(isActiveStatus),
        },
      },
      {
        $group: {
          _id: null,
          visits: { $sum: 1 },
          visitIds: { $push: '$_id' },
          tokensIssued: { $sum: '$tokens' },
          consultationsCompleted: { $sum: '$completed' },
          activeTokens: { $sum: '$active' },
        },
      },
    ]),
    QueueToken.aggregate([
      { $match: { patientId: objectId } },
      { $project: { visitKey: visitKeyExpression(timeZone), departmentId: 1 } },
      { $group: { _id: { departmentId: '$departmentId', visitKey: '$visitKey' } } },
      { $group: { _id: '$_id.departmentId', departmentVisits: { $sum: 1 } } },
      { $sort: { departmentVisits: -1, _id: 1 } },
    ]),
    AssistanceRequest.countDocuments({ patientId: objectId }),
  ]);

  const departments = await Department.find({ _id: { $in: byDepartment.map((item) => item._id) } }).select('name').lean();
  const departmentNames = new Map(departments.map((item) => [item._id, item.name]));
  const serviceDates = (summary?.visitIds ?? []).map((id) => parseVisitId(id)?.serviceDate).filter(Boolean).sort();

  response.status(200).json({
    data: {
      ...toAdminPatient(patient),
      visitSummary: {
        totalVisits: summary?.visits ?? 0,
        firstVisitDate: serviceDates[0] ?? null,
        lastVisitDate: serviceDates.at(-1) ?? null,
        tokensIssued: summary?.tokensIssued ?? 0,
        consultationsCompleted: summary?.consultationsCompleted ?? 0,
        activeTokens: summary?.activeTokens ?? 0,
        assistanceRequests,
        departments: byDepartment.map((item) => ({
          id: item._id,
          name: departmentNames.get(item._id) ?? null,
          departmentVisits: item.departmentVisits,
        })),
      },
    },
  });
});

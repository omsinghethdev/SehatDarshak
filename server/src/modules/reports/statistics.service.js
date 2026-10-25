import { getHospitalTimeZone } from '../../config/hospital.js';
import { AssistanceRequest, assistanceStatuses } from '../assistance/assistanceRequest.model.js';
import { Department } from '../departments/department.model.js';
import { QueueToken, activeTokenStatuses, tokenStatuses } from '../tokens/queueToken.model.js';
import { User, staffTypeOf } from '../users/user.model.js';
import { Visit } from '../visits/visit.model.js';
import {
  consultedByExpression,
  countWhere,
  localDateExpression,
  visitKeyExpression,
} from '../visits/visitAggregation.js';
import { Ward } from '../wards/ward.model.js';
import { listDates, previousPeriod, resolveDates, toServiceDate } from '../../utils/dates.js';

/*
 * Admin statistics for a period of service dates in the hospital time zone. Definitions:
 *
 * - registered patients: patient accounts that exist now (`registeredTotal`), and those created
 *   during the period (`registeredInPeriod`).
 * - visit (encounter): one patient on one service date with at least one queue token. Several
 *   tokens and departments on the same day are one visit.
 * - unique visiting patients: distinct patients with at least one visit in the period. A patient
 *   who visits on three days is one unique patient and three visits (`repeatVisitors` counts
 *   patients with two or more visits in the period).
 * - department visit: one visit's use of one department (several tokens in the same department
 *   on the same visit count once).
 * - tokens issued: queue tokens issued in the period, broken down by their current status.
 * - consultations completed: tokens that staff moved to `completed` during the period (by
 *   `completedAt`). Issuing a token is never counted as a consultation.
 * - current queue: tokens waiting / called / in consultation right now, regardless of period.
 * - assistance requests: created in the period by current status, plus currently open requests.
 *
 * All values are aggregate counts. Patient names and identifiers are never included.
 */

const zeroCounts = (keys) => Object.fromEntries(keys.map((key) => [key, 0]));

async function tokenActivity(period, timeZone, departmentId) {
  const match = {
    issuedAt: { $gte: period.start, $lt: period.end },
    ...(departmentId ? { departmentId } : {}),
  };
  const [result] = await QueueToken.aggregate([
    { $match: match },
    {
      $project: {
        visitKey: visitKeyExpression(timeZone),
        day: localDateExpression('$issuedAt', timeZone),
        patientId: 1,
        departmentId: 1,
        status: 1,
      },
    },
    {
      $facet: {
        visits: [
          { $group: { _id: '$visitKey', patientId: { $first: '$patientId' } } },
          { $group: { _id: '$patientId', visits: { $sum: 1 } } },
          {
            $group: {
              _id: null,
              visits: { $sum: '$visits' },
              uniquePatients: { $sum: 1 },
              repeatVisitors: countWhere({ $gt: ['$visits', 1] }),
            },
          },
        ],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byDepartment: [
          {
            $group: {
              _id: { departmentId: '$departmentId', visitKey: '$visitKey' },
              patientId: { $first: '$patientId' },
              tokens: { $sum: 1 },
              skipped: countWhere({ $eq: ['$status', 'skipped'] }),
              cancelled: countWhere({ $eq: ['$status', 'cancelled'] }),
            },
          },
          {
            $group: {
              _id: { departmentId: '$_id.departmentId', patientId: '$patientId' },
              departmentVisits: { $sum: 1 },
              tokens: { $sum: '$tokens' },
              skipped: { $sum: '$skipped' },
              cancelled: { $sum: '$cancelled' },
            },
          },
          {
            $group: {
              _id: '$_id.departmentId',
              departmentVisits: { $sum: '$departmentVisits' },
              uniquePatients: { $sum: 1 },
              tokensIssued: { $sum: '$tokens' },
              skipped: { $sum: '$skipped' },
              cancelled: { $sum: '$cancelled' },
            },
          },
        ],
        byDay: [
          { $group: { _id: { day: '$day', visitKey: '$visitKey' }, patientId: { $first: '$patientId' }, tokens: { $sum: 1 } } },
          { $group: { _id: { day: '$_id.day', patientId: '$patientId' }, visits: { $sum: 1 }, tokens: { $sum: '$tokens' } } },
          { $group: { _id: '$_id.day', visits: { $sum: '$visits' }, uniquePatients: { $sum: 1 }, tokensIssued: { $sum: '$tokens' } } },
        ],
      },
    },
  ]);

  const totals = result.visits[0] ?? { visits: 0, uniquePatients: 0, repeatVisitors: 0 };
  const byStatus = zeroCounts(tokenStatuses);
  for (const { _id, count } of result.byStatus) {
    if (_id in byStatus) byStatus[_id] = count;
  }
  return {
    visits: totals.visits,
    uniquePatients: totals.uniquePatients,
    repeatVisitors: totals.repeatVisitors,
    tokensIssued: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    byStatus,
    byDepartment: new Map(result.byDepartment.map(({ _id, ...counts }) => [_id, counts])),
    byDay: new Map(result.byDay.map(({ _id, ...counts }) => [_id, counts])),
  };
}

async function consultationActivity(period, timeZone, departmentId) {
  const [result] = await QueueToken.aggregate([
    {
      $match: {
        status: 'completed',
        completedAt: { $gte: period.start, $lt: period.end },
        ...(departmentId ? { departmentId } : {}),
      },
    },
    {
      $project: {
        day: localDateExpression('$completedAt', timeZone),
        departmentId: 1,
        consultedBy: consultedByExpression,
      },
    },
    {
      $facet: {
        total: [{ $count: 'count' }],
        byDay: [{ $group: { _id: '$day', count: { $sum: 1 } } }],
        byDepartment: [{ $group: { _id: '$departmentId', count: { $sum: 1 } } }],
        byStaff: [{ $group: { _id: '$consultedBy', count: { $sum: 1 } } }],
      },
    },
  ]);
  return {
    total: result.total[0]?.count ?? 0,
    byDay: new Map(result.byDay.map(({ _id, count }) => [_id, count])),
    byDepartment: new Map(result.byDepartment.map(({ _id, count }) => [_id, count])),
    byStaff: new Map(result.byStaff.map(({ _id, count }) => [_id ? String(_id) : null, count])),
  };
}

async function currentQueue(departmentId) {
  const groups = await QueueToken.aggregate([
    { $match: { status: { $in: activeTokenStatuses }, ...(departmentId ? { departmentId } : {}) } },
    { $group: { _id: { departmentId: '$departmentId', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const overall = zeroCounts(activeTokenStatuses);
  const byDepartment = new Map();
  for (const { _id: { departmentId: id, status }, count } of groups) {
    overall[status] += count;
    if (!byDepartment.has(id)) byDepartment.set(id, zeroCounts(activeTokenStatuses));
    byDepartment.get(id)[status] += count;
  }
  return { overall, byDepartment };
}

async function assistanceActivity(period, departmentId) {
  const scope = departmentId ? { departmentId } : {};
  const [created, currentlyOpen] = await Promise.all([
    AssistanceRequest.aggregate([
      { $match: { ...scope, createdAt: { $gte: period.start, $lt: period.end } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AssistanceRequest.countDocuments({ ...scope, status: 'open' }),
  ]);
  const byStatus = zeroCounts(assistanceStatuses);
  for (const { _id, count } of created) {
    if (_id in byStatus) byStatus[_id] = count;
  }
  return {
    createdInPeriod: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
    byStatus,
    currentlyOpen,
  };
}

export async function workforceCounts(departmentId) {
  const groups = await User.aggregate([
    { $match: { role: 'staff', ...(departmentId ? { departmentId } : {}) } },
    {
      $group: {
        _id: { doctor: { $eq: ['$staffType', 'doctor'] }, inactive: { $eq: ['$isActive', false] } },
        count: { $sum: 1 },
      },
    },
  ]);
  const counts = { doctors: { active: 0, inactive: 0 }, staff: { active: 0, inactive: 0 } };
  for (const { _id: { doctor, inactive }, count } of groups) {
    counts[doctor ? 'doctors' : 'staff'][inactive ? 'inactive' : 'active'] += count;
  }
  return counts;
}

function comparison(current, previous) {
  return {
    current,
    previous,
    change: current - previous,
    // Null when there is nothing to compare against.
    changePercent: previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10,
  };
}

/** The admin dashboard statistics for a resolved period. */
export async function getAdminStatistics(period, { compare = true, now = new Date() } = {}) {
  const timeZone = getHospitalTimeZone();
  const today = toServiceDate(now, timeZone);
  const previous = compare ? previousPeriod(period, timeZone) : null;

  const [
    tokens,
    consultations,
    queue,
    assistance,
    workforce,
    registeredTotal,
    registeredInPeriod,
    todayActivity,
    wardGroups,
    departments,
    previousTokens,
    previousConsultations,
  ] = await Promise.all([
    tokenActivity(period, timeZone),
    consultationActivity(period, timeZone),
    currentQueue(),
    assistanceActivity(period),
    workforceCounts(),
    User.countDocuments({ role: 'patient' }),
    User.countDocuments({ role: 'patient', createdAt: { $gte: period.start, $lt: period.end } }),
    period.from <= today && today <= period.to
      ? null
      : tokenActivity(resolveDates('today', today, today, timeZone), timeZone),
    Visit.aggregate([
      { $match: { serviceDate: { $gte: period.from, $lte: period.to }, wardId: { $exists: true } } },
      { $group: { _id: '$wardId', visits: { $sum: 1 } } },
    ]),
    Department.find().select('name code isActive').sort({ name: 1, _id: 1 }).lean(),
    previous ? tokenActivity(previous, timeZone) : null,
    previous ? consultationActivity(previous, timeZone) : null,
  ]);

  const visitsToday = todayActivity ? todayActivity.visits : tokens.byDay.get(today)?.visits ?? 0;

  // Departments: every active department, plus inactive ones that had activity in the period.
  const byDepartment = departments
    .filter((department) => department.isActive !== false
      || tokens.byDepartment.has(department._id)
      || consultations.byDepartment.has(department._id))
    .map((department) => {
      const activity = tokens.byDepartment.get(department._id);
      const waiting = queue.byDepartment.get(department._id);
      return {
        id: department._id,
        name: department.name,
        code: department.code,
        isActive: department.isActive !== false,
        departmentVisits: activity?.departmentVisits ?? 0,
        uniquePatients: activity?.uniquePatients ?? 0,
        tokensIssued: activity?.tokensIssued ?? 0,
        skipped: activity?.skipped ?? 0,
        cancelled: activity?.cancelled ?? 0,
        consultationsCompleted: consultations.byDepartment.get(department._id) ?? 0,
        currentlyWaiting: waiting?.waiting ?? 0,
      };
    });

  const wardIds = wardGroups.map((group) => group._id);
  const [wards, doctors, staffIds] = await Promise.all([
    Ward.find({ _id: { $in: wardIds } }).select('name code').lean(),
    // Every active doctor (zero-filled), plus inactive doctors who completed consultations.
    User.find({
      role: 'staff',
      staffType: 'doctor',
      $or: [{ isActive: { $ne: false } }, { _id: { $in: [...consultations.byStaff.keys()].filter(Boolean) } }],
    }).select('name departmentId').sort({ name: 1, _id: 1 }).lean(),
    User.find({ _id: { $in: [...consultations.byStaff.keys()].filter(Boolean) } }).select('role staffType').lean(),
  ]);
  const wardNames = new Map(wards.map((ward) => [ward._id, ward]));
  const departmentNames = new Map(departments.map((department) => [department._id, department.name]));
  const doctorIds = new Set(staffIds.filter((user) => user.role === 'staff' && staffTypeOf(user) === 'doctor').map((user) => String(user._id)));
  const attributedToDoctors = [...consultations.byStaff.entries()]
    .filter(([id]) => id && doctorIds.has(id))
    .reduce((sum, [, count]) => sum + count, 0);

  const departmentVisits = byDepartment.reduce((sum, department) => sum + department.departmentVisits, 0);

  return {
    generatedAt: now.toISOString(),
    timeZone,
    period: { key: period.key, from: period.from, to: period.to, days: period.days },
    patients: {
      registeredTotal,
      registeredInPeriod,
      uniqueVisiting: tokens.uniquePatients,
      repeatVisitors: tokens.repeatVisitors,
    },
    visits: {
      total: tokens.visits,
      today: visitsToday,
      departmentVisits,
    },
    queueTokens: {
      issued: tokens.tokensIssued,
      issuedByCurrentStatus: tokens.byStatus,
      consultationsCompleted: consultations.total,
      currentlyWaiting: queue.overall.waiting,
      currentlyActive: Object.values(queue.overall).reduce((sum, count) => sum + count, 0),
    },
    assistanceRequests: assistance,
    workforce,
    trend: listDates(period.from, period.to).map((date) => ({
      date,
      visits: tokens.byDay.get(date)?.visits ?? 0,
      uniquePatients: tokens.byDay.get(date)?.uniquePatients ?? 0,
      tokensIssued: tokens.byDay.get(date)?.tokensIssued ?? 0,
      consultationsCompleted: consultations.byDay.get(date) ?? 0,
    })),
    byDepartment,
    byWard: wardGroups
      .map((group) => ({ id: group._id, name: wardNames.get(group._id)?.name ?? null, code: wardNames.get(group._id)?.code ?? null, visits: group.visits }))
      .sort((a, b) => b.visits - a.visits || String(a.name).localeCompare(String(b.name))),
    byDoctor: {
      doctors: doctors.map((doctor) => ({
        id: String(doctor._id),
        name: doctor.name,
        departmentId: doctor.departmentId ?? null,
        departmentName: departmentNames.get(doctor.departmentId) ?? null,
        consultationsCompleted: consultations.byStaff.get(String(doctor._id)) ?? 0,
      })),
      // Completed consultations whose start was not recorded by a doctor account (started by
      // general staff or an admin, or before status history was recorded).
      consultationsNotAttributedToDoctor: consultations.total - attributedToDoctors,
    },
    comparison: previous
      ? {
        previousPeriod: { from: previous.from, to: previous.to, days: previous.days },
        visits: comparison(tokens.visits, previousTokens.visits),
        uniqueVisiting: comparison(tokens.uniquePatients, previousTokens.uniquePatients),
        tokensIssued: comparison(tokens.tokensIssued, previousTokens.tokensIssued),
        consultationsCompleted: comparison(consultations.total, previousConsultations.total),
      }
      : null,
  };
}

/** Period activity for one department (used by the admin department detail). */
export async function getDepartmentActivity(departmentId, period) {
  const timeZone = getHospitalTimeZone();
  const [tokens, consultations, queue, assistance] = await Promise.all([
    tokenActivity(period, timeZone, departmentId),
    consultationActivity(period, timeZone, departmentId),
    currentQueue(departmentId),
    assistanceActivity(period, departmentId),
  ]);
  return {
    period: { key: period.key, from: period.from, to: period.to, days: period.days },
    departmentVisits: tokens.visits,
    uniquePatients: tokens.uniquePatients,
    tokensIssued: tokens.tokensIssued,
    issuedByCurrentStatus: tokens.byStatus,
    consultationsCompleted: consultations.total,
    currentQueue: queue.overall,
    assistanceRequests: assistance,
  };
}

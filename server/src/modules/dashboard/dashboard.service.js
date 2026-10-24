import { AssistanceRequest, assistanceStatuses } from '../assistance/assistanceRequest.model.js';
import { Department } from '../departments/department.model.js';
import { QueueToken, activeTokenStatuses, tokenStatuses } from '../tokens/queueToken.model.js';
import { estimateLabel, simulatedMinutesPerPatient } from '../tokens/queueToken.service.js';

// PROPOSED shape: docs/SHARED_INTEGRATION_CONTRACT.md marks the dashboard field names as a
// team decision. Only aggregate counts and display numbers are returned, never patient data.

const zeroCounts = (statuses) => Object.fromEntries(statuses.map((status) => [status, 0]));

// Turns [{ _id: { departmentId, status }, count }] into overall and per-department counts.
function tallyByStatus(groups, statuses) {
  const overall = zeroCounts(statuses);
  const byDepartment = new Map();

  for (const { _id: { departmentId, status }, count } of groups) {
    if (!(status in overall)) {
      continue;
    }
    overall[status] += count;
    if (!byDepartment.has(departmentId)) {
      byDepartment.set(departmentId, zeroCounts(statuses));
    }
    byDepartment.get(departmentId)[status] += count;
  }

  return { overall, byDepartment };
}

const sum = (counts, statuses = Object.keys(counts)) => statuses.reduce((total, status) => total + counts[status], 0);

const groupByDepartmentAndStatus = [
  { $group: { _id: { departmentId: '$departmentId', status: '$status' }, count: { $sum: 1 } } },
];

export async function getDashboardStatistics() {
  // Four queries regardless of data size: two aggregations plus two small lookups.
  const [tokenGroups, assistanceGroups, departments, calledTokens] = await Promise.all([
    QueueToken.aggregate(groupByDepartmentAndStatus),
    AssistanceRequest.aggregate(groupByDepartmentAndStatus),
    Department.find({ isActive: true }).select('name code').sort({ name: 1, _id: 1 }).lean(),
    QueueToken.find({ status: 'called' }).select('departmentId displayNumber').lean(),
  ]);

  const tokens = tallyByStatus(tokenGroups, tokenStatuses);
  const assistance = tallyByStatus(assistanceGroups, assistanceStatuses);
  const calledByDepartment = new Map(calledTokens.map((token) => [token.departmentId, token.displayNumber]));

  return {
    generatedAt: new Date().toISOString(),
    queueTokens: {
      total: sum(tokens.overall),
      active: sum(tokens.overall, activeTokenStatuses),
      byStatus: tokens.overall,
    },
    assistanceRequests: {
      total: sum(assistance.overall),
      byStatus: assistance.overall,
    },
    departments: departments.map((department) => {
      const queue = tokens.byDepartment.get(department._id) ?? zeroCounts(tokenStatuses);
      const requests = assistance.byDepartment.get(department._id) ?? zeroCounts(assistanceStatuses);

      return {
        id: department._id,
        name: department.name,
        code: department.code,
        queue: {
          waiting: queue.waiting,
          called: queue.called,
          in_consultation: queue.in_consultation,
          active: sum(queue, activeTokenStatuses),
          currentCalledDisplayNumber: calledByDepartment.get(department._id) ?? null,
          // Simulated: wait for a patient joining now, from the waiting count.
          estimatedWaitMinutes: queue.waiting * simulatedMinutesPerPatient,
          estimateLabel,
        },
        openAssistanceRequests: requests.open,
      };
    }),
  };
}

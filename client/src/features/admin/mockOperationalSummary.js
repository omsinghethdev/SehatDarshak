import { requireMockUser, simulateLatency } from '../../lib/mockBackend';
import { readMockAssistanceRequests } from '../assistance/mockAssistanceService';
import { MOCK_DEPARTMENTS } from '../departments/mockDepartments';
import { readMockQueueTokens } from '../queue/mockQueueService';

/*
 * FRONTEND-ONLY demo summary for the admin overview in mock mode.
 *
 * The contract leaves the GET /api/dashboard/statistics response shape as "TODO — team
 * decision", so this is deliberately NOT a guess at that schema. It is calculated in the
 * browser from the same mock queue and assistance stores the patient and staff views use,
 * and contains aggregate counts only (no patient data).
 */
export async function getMockOperationalSummary() {
  await simulateLatency();
  requireMockUser(['admin']);

  const tokens = readMockQueueTokens();
  const requests = readMockAssistanceRequests();
  const count = (list, predicate) => list.filter(predicate).length;

  const departments = MOCK_DEPARTMENTS.map((department) => {
    const inDepartment = tokens.filter((token) => token.departmentId === department.id);
    const waiting = count(inDepartment, (token) => token.status === 'waiting');
    const called = count(inDepartment, (token) => token.status === 'called');
    const inConsultation = count(inDepartment, (token) => token.status === 'in_consultation');
    return {
      id: department.id,
      name: department.name,
      code: department.code,
      waiting,
      called,
      inConsultation,
      active: waiting + called + inConsultation,
      openRequests: count(requests, (request) => request.departmentId === department.id && request.status === 'open'),
    };
  });

  const sum = (key) => departments.reduce((total, department) => total + department[key], 0);

  return {
    calculatedAt: new Date().toISOString(),
    activeTokens: sum('active'),
    waiting: sum('waiting'),
    called: sum('called'),
    inConsultation: sum('inConsultation'),
    openRequests: count(requests, (request) => request.status === 'open'),
    departments,
  };
}

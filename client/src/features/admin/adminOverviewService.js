import { ApiError, CLIENT_ERROR_CODES, api } from '../../services/apiClient';
import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { getMockOperationalSummary } from './mockOperationalSummary';

const isCount = (value) => Number.isInteger(value) && value >= 0;

function invalidStatistics() {
  return new ApiError({
    code: CLIENT_ERROR_CODES.INVALID_RESPONSE,
    message: 'The statistics service returned data in an unexpected format.',
  });
}

/**
 * Maps GET /api/dashboard/statistics (docs/API_CONTRACT.md → Dashboard) to the summary shape
 * OperationalSummary renders. Every number must come from the response; if a required count is
 * missing or not a whole number, this throws instead of showing a guessed or zero value.
 */
export function toOperationalSummary(statistics) {
  const byStatus = statistics?.queueTokens?.byStatus;
  const assistanceByStatus = statistics?.assistanceRequests?.byStatus;
  if (!byStatus || !assistanceByStatus || !Array.isArray(statistics.departments)) throw invalidStatistics();

  const summary = {
    calculatedAt: statistics.generatedAt,
    activeTokens: statistics.queueTokens.active,
    waiting: byStatus.waiting,
    called: byStatus.called,
    inConsultation: byStatus.in_consultation,
    openRequests: assistanceByStatus.open,
    departments: statistics.departments.map((department) => ({
      id: department?.id,
      name: department?.name,
      code: department?.code,
      waiting: department?.queue?.waiting,
      called: department?.queue?.called,
      inConsultation: department?.queue?.in_consultation,
      active: department?.queue?.active,
      openRequests: department?.openAssistanceRequests,
    })),
  };

  const counts = [summary.activeTokens, summary.waiting, summary.called, summary.inConsultation, summary.openRequests];
  const departmentsValid = summary.departments.every(
    (department) =>
      typeof department.id === 'string' &&
      typeof department.name === 'string' &&
      [department.waiting, department.called, department.inConsultation, department.active, department.openRequests].every(isCount),
  );
  if (!counts.every(isCount) || !departmentsValid || Number.isNaN(Date.parse(summary.calculatedAt))) {
    throw invalidStatistics();
  }
  return summary;
}

/**
 * Admin overview data, as `{ source, summary }` where `source` is `'api'` (server statistics) or
 * `'mock-summary'` (the frontend-only demo summary used in mock mode). A failing real request
 * throws; it never falls back to the mock summary.
 */
export async function loadAdminOverview({ signal } = {}) {
  if (USE_MOCK_SERVICES) {
    return { source: 'mock-summary', summary: await getMockOperationalSummary() };
  }
  const { data } = await api.get('/dashboard/statistics', { signal });
  return { source: 'api', summary: toOperationalSummary(data) };
}

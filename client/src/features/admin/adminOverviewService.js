import { api } from '../../services/apiClient';
import { USE_MOCK_SERVICES } from '../../services/serviceMode';
import { getMockOperationalSummary } from './mockOperationalSummary';

/**
 * Admin overview data.
 * - Mock mode: `{ source: 'mock-summary', summary }`, the frontend-only demo summary.
 * - API mode:  `{ source: 'api', statistics }` from GET /api/dashboard/statistics. Its shape is not
 *   yet defined in the contract, so the UI does not interpret it (no guessed field names).
 * A failing real request throws; it never falls back to the mock summary.
 */
export async function loadAdminOverview({ signal } = {}) {
  if (USE_MOCK_SERVICES) {
    return { source: 'mock-summary', summary: await getMockOperationalSummary() };
  }
  const { data } = await api.get('/dashboard/statistics', { signal });
  return { source: 'api', statistics: data };
}

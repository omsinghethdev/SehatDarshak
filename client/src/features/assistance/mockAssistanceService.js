import { mockError, readStore, requireMockUser, simulateLatency, writeStore } from '../../lib/mockBackend';
import { API_ERROR_CODES } from '../../services/apiClient';
import { MOCK_DEPARTMENTS } from '../departments/mockDepartments';
import { toErrorDetails } from '../auth/validation';
import { validateAssistanceRequest } from './assistanceRules';

/*
 * DEVELOPMENT-ONLY mock assistance requests, stored in this browser's localStorage and
 * scoped to the signed-in mock patient. Nothing is sent to hospital staff.
 */

const STORE_KEY = 'sehatdarsak.mockAssistance';
const MAX_LIMIT = 100;

/** Returned as `notice` (a documented response field). Honest about mock delivery. */
const MOCK_NOTICE =
  'Demo request saved in this browser only. It was not sent to hospital staff. This is not a guaranteed emergency medical response.';

/** Canonical fixture (docs/SHARED_INTEGRATION_CONTRACT.md §6), owned by the demo patient. */
const DEMO_REQUEST = Object.freeze({
  id: 'assist_demo_01',
  status: 'open',
  createdAt: '2026-10-24T10:00:00.000Z',
  departmentId: 'dept_demo_opd',
  location: 'Ground floor registration desk',
  message: 'Need help finding the OPD',
  patientId: 'user_demo_01',
});

function loadStore() {
  const stored = readStore(STORE_KEY, null);
  const store = stored && Array.isArray(stored.requests) ? stored : { seeded: false, requests: [] };
  if (!store.seeded) {
    store.requests.push({ ...DEMO_REQUEST });
    store.seeded = true;
    writeStore(STORE_KEY, store);
  }
  return store;
}

/**
 * Documented public fields (id, status, createdAt, notice) plus the patient's own submitted
 * fields. The contract does not yet list departmentId/location/message in responses — see
 * the report; the UI copes if a real server omits them.
 */
function toPublicRequest(request) {
  return {
    id: request.id,
    status: request.status,
    createdAt: request.createdAt,
    notice: MOCK_NOTICE,
    departmentId: request.departmentId,
    location: request.location,
    message: request.message,
  };
}

function parsePositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export const mockAssistanceService = {
  async createRequest({ departmentId, location, message }) {
    await simulateLatency(600);
    const user = requireMockUser(['patient']);

    const fields = { departmentId: departmentId ?? '', location: location ?? '', message: message ?? '' };
    const errors = validateAssistanceRequest(fields);
    if (!errors.departmentId && !MOCK_DEPARTMENTS.some((item) => item.id === departmentId)) {
      errors.departmentId = 'Choose a valid department.';
    }
    if (Object.keys(errors).length > 0) {
      throw mockError(API_ERROR_CODES.VALIDATION_ERROR, 'Some details need attention.', toErrorDetails(errors));
    }

    const store = loadStore();
    const request = {
      id: `assist_mock_${crypto.randomUUID()}`,
      status: 'open',
      createdAt: new Date().toISOString(),
      departmentId,
      location: fields.location.trim(),
      message: fields.message.trim(),
      patientId: user.id,
    };
    store.requests.push(request);
    writeStore(STORE_KEY, store);
    return toPublicRequest(request);
  },

  async listMyRequests({ page = 1, limit = 10 } = {}) {
    await simulateLatency();
    const user = requireMockUser(['patient']);
    const safePage = parsePositiveInt(page, 1);
    const safeLimit = Math.min(parsePositiveInt(limit, 20), MAX_LIMIT);

    const own = loadStore()
      .requests.filter((request) => request.patientId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (safePage - 1) * safeLimit;

    return {
      items: own.slice(start, start + safeLimit).map(toPublicRequest),
      meta: { page: safePage, limit: safeLimit, total: own.length },
    };
  },
};

/*
 * DEMO CONTROL — mock mode only, not part of the patient API. Simulates what an authorised
 * staff member would do (PATCH …/acknowledge) so the "acknowledged" status can be shown.
 */
export const mockAssistanceDemo = {
  async acknowledge(requestId) {
    await simulateLatency(200);
    const user = requireMockUser(['patient']);
    const store = loadStore();
    const request = store.requests.find((item) => item.id === requestId && item.patientId === user.id);
    if (!request) throw mockError(API_ERROR_CODES.NOT_FOUND, 'This request could not be found.');
    if (request.status !== 'open') {
      throw mockError(API_ERROR_CODES.CONFLICT, 'This request has already been acknowledged.');
    }
    request.status = 'acknowledged';
    writeStore(STORE_KEY, store);
    return toPublicRequest(request);
  },
};

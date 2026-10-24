import {
  assertMockDepartmentAccess,
  mockError,
  readStore,
  requireMockUser,
  simulateLatency,
  writeStore,
} from '../../lib/mockBackend';
import { API_ERROR_CODES } from '../../services/apiClient';
import { MOCK_DEPARTMENTS } from '../departments/mockDepartments';
import { toErrorDetails } from '../auth/validation';
import { validateAssistanceRequest } from './assistanceRules';

/*
 * DEVELOPMENT-ONLY mock assistance requests: one store in this browser's localStorage shared by
 * the patient view (own requests only) and the staff/admin view (department-scoped). Nothing is
 * sent to real hospital staff. The only status change is open → acknowledged (`acknowledgeIn`).
 */

const ASSISTANCE_STATUSES = ['open', 'acknowledged'];

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

function paginate(list, page, limit) {
  const safePage = parsePositiveInt(page, 1);
  const safeLimit = Math.min(parsePositiveInt(limit, 20), MAX_LIMIT);
  const start = (safePage - 1) * safeLimit;
  return {
    items: list.slice(start, start + safeLimit).map(toPublicRequest),
    meta: { page: safePage, limit: safeLimit, total: list.length },
  };
}

const newestFirst = (a, b) => b.createdAt.localeCompare(a.createdAt);

/** The single place a request's status changes. */
function acknowledgeIn(store, request, user) {
  if (request.status !== 'open') {
    throw mockError(API_ERROR_CODES.CONFLICT, 'This request has already been acknowledged.');
  }
  request.status = 'acknowledged';
  request.acknowledgedBy = user.id;
  request.acknowledgedAt = new Date().toISOString();
  writeStore(STORE_KEY, store);
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
    const own = loadStore()
      .requests.filter((request) => request.patientId === user.id)
      .sort(newestFirst);
    return paginate(own, page, limit);
  },
};

/** Staff/admin endpoints. Staff see only their assigned department; admins see all. */
export const mockStaffAssistanceService = {
  /** GET /assistance-requests?status=&page=&limit= */
  async listRequests({ status, page = 1, limit = 20 } = {}) {
    await simulateLatency();
    const user = requireMockUser(['staff', 'admin']);
    if (status && !ASSISTANCE_STATUSES.includes(status)) {
      throw mockError(API_ERROR_CODES.VALIDATION_ERROR, 'status must be open or acknowledged', [
        { field: 'status', message: 'Invalid status' },
      ]);
    }
    const permitted = loadStore()
      .requests.filter((request) => {
        if (status && request.status !== status) return false;
        try {
          assertMockDepartmentAccess(user, request.departmentId);
          return true;
        } catch {
          return false;
        }
      })
      .sort(newestFirst);
    return paginate(permitted, page, limit);
  },

  /** PATCH /assistance-requests/:requestId/acknowledge → `{ id, status }` */
  async acknowledge(requestId) {
    await simulateLatency(400);
    const user = requireMockUser(['staff', 'admin']);
    const store = loadStore();
    const request = store.requests.find((item) => item.id === requestId);
    if (!request) throw mockError(API_ERROR_CODES.NOT_FOUND, 'This request could not be found.');
    assertMockDepartmentAccess(user, request.departmentId);
    acknowledgeIn(store, request, user);
    return { id: request.id, status: request.status };
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
    acknowledgeIn(store, request, { id: 'mock_demo_simulation' });
    return toPublicRequest(request);
  },
};

/** Mock-internal read used only by the frontend-only admin summary. */
export function readMockAssistanceRequests() {
  return loadStore().requests.map(toPublicRequest);
}

/** Mock-internal: stored requests for the mock admin reports (aggregate use only). */
export function readMockAssistanceRecords() {
  return loadStore().requests.map(({ id, patientId, departmentId, status, createdAt }) => ({ id, patientId, departmentId, status, createdAt }));
}

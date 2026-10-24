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
import { AVERAGE_SERVICE_MINUTES } from './queueAssistantConfig';
import { QUEUE_STATUSES, STATUS_DETAILS, STATUS_TRANSITIONS, isActiveStatus } from './queueStatus';

/*
 * DEVELOPMENT-ONLY mock queue: one store in this browser's localStorage shared by the
 * patient, staff, and admin views, so all of them see the same tokens.
 *
 * Queue position is derived, never stored: a waiting token's `patientsAhead` is the number of
 * waiting tokens in the same department that joined before it, and the simulated estimate is
 * a fixed number of minutes per patient. Every status change goes through `applyTransition`,
 * which enforces the contract's transition table and the one-`called`-token-per-department rule.
 */

const STORE_KEY = 'sehatdarsak.mockQueue';
const STORE_VERSION = 2;
// Same configurable average the client uses for its fallback estimate.
const SIMULATED_MINUTES_PER_PATIENT = AVERAGE_SERVICE_MINUTES;
const ESTIMATE_LABEL = 'Simulated estimate';
const FIRST_DISPLAY_NUMBER = 101;
const MAX_LIMIT = 100;

/** Owner of the seeded background tokens: fictional patients with no account. */
const BACKGROUND_PATIENT_ID = 'mock_background_patient';

/** Canonical demo token (docs/SHARED_INTEGRATION_CONTRACT.md §6), owned by the demo patient. */
const DEMO_TOKEN = Object.freeze({
  id: 'token_demo_101',
  displayNumber: 'OPD-101',
  departmentId: 'dept_demo_opd',
  patientId: 'user_demo_01',
});

function newToken(store, fields) {
  const now = new Date().toISOString();
  return { ...fields, status: 'waiting', queueOrder: store.nextOrder++, createdAt: now, updatedAt: now };
}

/**
 * Seed each department with `simulatedQueueLength` fictional waiting tokens numbered just
 * below 101, then the canonical OPD-101 — which therefore has 4 patients ahead (20 min),
 * matching the documented fixture.
 */
function seedStore() {
  const store = { version: STORE_VERSION, tokens: [], lastNumbers: {}, nextOrder: 1 };
  for (const department of MOCK_DEPARTMENTS) {
    for (let offset = department.simulatedQueueLength; offset >= 1; offset -= 1) {
      const number = FIRST_DISPLAY_NUMBER - offset;
      store.tokens.push(
        newToken(store, {
          id: `token_demo_bg_${department.code.toLowerCase()}_${number}`,
          displayNumber: `${department.code}-${String(number).padStart(3, '0')}`,
          departmentId: department.id,
          patientId: BACKGROUND_PATIENT_ID,
        }),
      );
    }
    store.lastNumbers[department.id] = FIRST_DISPLAY_NUMBER - 1;
  }
  store.tokens.push(newToken(store, { ...DEMO_TOKEN }));
  store.lastNumbers[DEMO_TOKEN.departmentId] = FIRST_DISPLAY_NUMBER;
  return store;
}

function loadStore() {
  const stored = readStore(STORE_KEY, null);
  // Older demo data (from before queue positions were derived) is replaced once.
  if (stored?.version === STORE_VERSION && Array.isArray(stored.tokens)) return stored;
  const store = seedStore();
  writeStore(STORE_KEY, store);
  return store;
}

function patientsAheadOf(store, token) {
  if (token.status !== 'waiting') return 0;
  return store.tokens.filter(
    (other) =>
      other.departmentId === token.departmentId && other.status === 'waiting' && other.queueOrder < token.queueOrder,
  ).length;
}

/** Public QueueToken shape; `patientId`, ordering, and timestamps stay mock-internal. */
function toPublicToken(store, token) {
  const patientsAhead = patientsAheadOf(store, token);
  return {
    id: token.id,
    displayNumber: token.displayNumber,
    departmentId: token.departmentId,
    status: token.status,
    patientsAhead,
    estimatedWaitMinutes: patientsAhead * SIMULATED_MINUTES_PER_PATIENT,
    estimateLabel: ESTIMATE_LABEL,
  };
}

/** Patient-safe status shape from GET /queue-tokens/:tokenId/status. */
function toStatus(store, token) {
  const { departmentId: _omitted, ...status } = toPublicToken(store, token);
  return status;
}

function label(status) {
  return STATUS_DETAILS[status]?.label.toLowerCase() ?? status;
}

function findDepartment(departmentId) {
  const department = MOCK_DEPARTMENTS.find((item) => item.id === departmentId);
  if (!department) throw mockError(API_ERROR_CODES.NOT_FOUND, 'Department not found.');
  return department;
}

function findToken(store, tokenId) {
  const token = store.tokens.find((item) => item.id === tokenId);
  if (!token) throw mockError(API_ERROR_CODES.NOT_FOUND, 'This token could not be found.');
  return token;
}

function findOwnedToken(store, tokenId, user) {
  const token = findToken(store, tokenId);
  if (token.patientId !== user.id) {
    throw mockError(API_ERROR_CODES.FORBIDDEN, 'You do not have access to this token.');
  }
  return token;
}

function calledTokenIn(store, departmentId) {
  return store.tokens.find((token) => token.departmentId === departmentId && token.status === 'called') ?? null;
}

/** The single place token statuses change. Throws CONFLICT for anything the contract forbids. */
function applyTransition(store, token, nextStatus) {
  if (!STATUS_TRANSITIONS[token.status]?.includes(nextStatus)) {
    throw mockError(
      API_ERROR_CODES.CONFLICT,
      `${token.displayNumber} is ${label(token.status)} and cannot change to ${label(nextStatus)}.`,
    );
  }
  if (nextStatus === 'called') {
    const alreadyCalled = calledTokenIn(store, token.departmentId);
    if (alreadyCalled && alreadyCalled.id !== token.id) {
      throw mockError(
        API_ERROR_CODES.CONFLICT,
        `${alreadyCalled.displayNumber} is already called. Move it to in consultation, skipped, or cancelled before calling another token.`,
      );
    }
  }
  token.status = nextStatus;
  token.updatedAt = new Date().toISOString();
}

/** call-next: the earliest waiting token in the department, if none is currently called. */
function callNextIn(store, departmentId) {
  const alreadyCalled = calledTokenIn(store, departmentId);
  if (alreadyCalled) {
    throw mockError(
      API_ERROR_CODES.CONFLICT,
      `${alreadyCalled.displayNumber} is already called. Move it to in consultation, skipped, or cancelled before calling another token.`,
    );
  }
  const next = store.tokens
    .filter((token) => token.departmentId === departmentId && token.status === 'waiting')
    .sort((a, b) => a.queueOrder - b.queueOrder)[0];
  if (!next) throw mockError(API_ERROR_CODES.CONFLICT, 'No patients are waiting in this department.');
  applyTransition(store, next, 'called');
  return next;
}

function parsePositiveInt(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

/* ----------------------------- Patient endpoints ----------------------------- */

export const mockQueueService = {
  async listActiveTokens() {
    await simulateLatency();
    const user = requireMockUser(['patient']);
    const store = loadStore();
    return store.tokens
      .filter((token) => token.patientId === user.id && isActiveStatus(token.status))
      .sort((a, b) => a.queueOrder - b.queueOrder)
      .map((token) => toPublicToken(store, token));
  },

  async createToken(departmentId) {
    await simulateLatency(600);
    const user = requireMockUser(['patient']);

    if (typeof departmentId !== 'string' || !departmentId) {
      throw mockError(API_ERROR_CODES.VALIDATION_ERROR, 'departmentId is required', [
        { field: 'departmentId', message: 'Required' },
      ]);
    }
    const department = findDepartment(departmentId);
    const store = loadStore();
    const existing = store.tokens.find(
      (token) => token.patientId === user.id && token.departmentId === departmentId && isActiveStatus(token.status),
    );
    if (existing) {
      throw mockError(
        API_ERROR_CODES.CONFLICT,
        `You already have an active token (${existing.displayNumber}) for ${department.name}.`,
      );
    }

    const number = (store.lastNumbers[departmentId] ?? FIRST_DISPLAY_NUMBER - 1) + 1;
    const token = newToken(store, {
      id: `token_mock_${crypto.randomUUID()}`,
      displayNumber: `${department.code}-${number}`,
      departmentId,
      patientId: user.id,
    });
    store.tokens.push(token);
    store.lastNumbers[departmentId] = number;
    writeStore(STORE_KEY, store);
    return toPublicToken(store, token);
  },

  async getToken(tokenId) {
    await simulateLatency();
    const user = requireMockUser(['patient']);
    const store = loadStore();
    return toPublicToken(store, findOwnedToken(store, tokenId, user));
  },

  async getTokenStatus(tokenId) {
    await simulateLatency(200);
    const user = requireMockUser(['patient']);
    const store = loadStore();
    return toStatus(store, findOwnedToken(store, tokenId, user));
  },
};

/* ------------------------- Staff / admin endpoints -------------------------- */

const ACTIVE_ORDER = { called: 0, in_consultation: 1, waiting: 2 };

export const mockStaffQueueService = {
  /** GET /queues/:departmentId — active tokens in queue order, then finished ones (newest first). */
  async listDepartmentQueue(departmentId, { page = 1, limit = MAX_LIMIT } = {}) {
    await simulateLatency();
    const user = requireMockUser(['staff', 'admin']);
    findDepartment(departmentId);
    assertMockDepartmentAccess(user, departmentId);

    const store = loadStore();
    const tokens = store.tokens.filter((token) => token.departmentId === departmentId);
    const active = tokens
      .filter((token) => isActiveStatus(token.status))
      .sort((a, b) => ACTIVE_ORDER[a.status] - ACTIVE_ORDER[b.status] || a.queueOrder - b.queueOrder);
    const finished = tokens
      .filter((token) => !isActiveStatus(token.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    const safePage = parsePositiveInt(page, 1);
    const safeLimit = Math.min(parsePositiveInt(limit, MAX_LIMIT), MAX_LIMIT);
    const all = [...active, ...finished];
    const start = (safePage - 1) * safeLimit;
    return {
      items: all.slice(start, start + safeLimit).map((token) => toPublicToken(store, token)),
      meta: { page: safePage, limit: safeLimit, total: all.length },
    };
  },

  /** POST /queues/:departmentId/call-next */
  async callNext(departmentId) {
    await simulateLatency(400);
    const user = requireMockUser(['staff', 'admin']);
    findDepartment(departmentId);
    assertMockDepartmentAccess(user, departmentId);

    const store = loadStore();
    const token = callNextIn(store, departmentId);
    writeStore(STORE_KEY, store);
    return { id: token.id, displayNumber: token.displayNumber, status: token.status };
  },

  /** PATCH /queue-tokens/:tokenId/status — `called` is only reachable through call-next. */
  async updateTokenStatus(tokenId, status) {
    await simulateLatency(400);
    const user = requireMockUser(['staff', 'admin']);
    if (!QUEUE_STATUSES.includes(status)) {
      throw mockError(API_ERROR_CODES.VALIDATION_ERROR, 'status is not a valid queue status', [
        { field: 'status', message: 'Invalid status' },
      ]);
    }

    const store = loadStore();
    const token = findToken(store, tokenId);
    assertMockDepartmentAccess(user, token.departmentId);
    if (status === 'called') {
      throw mockError(API_ERROR_CODES.CONFLICT, 'Tokens can only be called with "Call next patient".');
    }
    applyTransition(store, token, status);
    writeStore(STORE_KEY, store);
    return { id: token.id, status: token.status };
  },
};

/* ------------------------------ Demo controls ------------------------------- */

/*
 * Mock mode only, not part of the API. Lets a single presenter simulate staff actions from the
 * patient's token page. They use the same transition rules as the staff endpoints.
 */
export const mockQueueDemo = {
  /** Simulate the next patient ahead being seen: called → in consultation → completed. */
  async advanceQueue(tokenId) {
    await simulateLatency(200);
    const user = requireMockUser(['patient']);
    const store = loadStore();
    const token = findOwnedToken(store, tokenId, user);
    if (patientsAheadOf(store, token) === 0) {
      throw mockError(API_ERROR_CODES.CONFLICT, 'No one is ahead of this token in the queue.');
    }

    const ahead = store.tokens
      .filter((other) => other.departmentId === token.departmentId && other.status === 'waiting' && other.queueOrder < token.queueOrder)
      .sort((a, b) => a.queueOrder - b.queueOrder)[0];
    applyTransition(store, ahead, 'called');
    applyTransition(store, ahead, 'in_consultation');
    applyTransition(store, ahead, 'completed');
    writeStore(STORE_KEY, store);
    return toPublicToken(store, token);
  },

  /** Simulate a staff status change on the patient's own token. */
  async changeStatus(tokenId, nextStatus) {
    await simulateLatency(200);
    const user = requireMockUser(['patient']);
    const store = loadStore();
    const token = findOwnedToken(store, tokenId, user);
    if (nextStatus === 'called' && patientsAheadOf(store, token) > 0) {
      throw mockError(API_ERROR_CODES.CONFLICT, 'Patients ahead must be seen before this token is called.');
    }
    applyTransition(store, token, nextStatus);
    writeStore(STORE_KEY, store);
    return toPublicToken(store, token);
  },
};

/* ------------------------------ Admin snapshot ------------------------------ */

/** Mock-internal read used only by the frontend-only admin summary. */
export function readMockQueueTokens() {
  const store = loadStore();
  return store.tokens.map((token) => toPublicToken(store, token));
}

/**
 * Mock-internal: stored token records including owner and timestamps, for the mock admin
 * reports only (never returned to patient or staff views).
 */
export function readMockQueueRecords() {
  return loadStore().tokens.map(({ id, displayNumber, departmentId, patientId, status, createdAt, updatedAt }) => ({
    id, displayNumber, departmentId, patientId, status, createdAt, updatedAt,
  }));
}

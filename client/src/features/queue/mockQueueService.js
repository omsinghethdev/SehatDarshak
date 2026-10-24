import { mockError, readStore, requireMockUser, simulateLatency, writeStore } from '../../lib/mockBackend';
import { API_ERROR_CODES } from '../../services/apiClient';
import { MOCK_DEPARTMENTS } from '../departments/mockDepartments';
import { STATUS_TRANSITIONS, STATUS_DETAILS, isActiveStatus } from './queueStatus';

/*
 * DEVELOPMENT-ONLY mock queue. Tokens are stored in this browser's localStorage and the
 * queue never moves on its own: patients ahead and waiting times are fictional, and status
 * changes happen only through the clearly labelled demo controls (mockQueueDemo below).
 */

const STORE_KEY = 'sehatdarsak.mockQueue';
const SIMULATED_MINUTES_PER_PATIENT = 5;
const ESTIMATE_LABEL = 'Simulated estimate';
const FIRST_DISPLAY_NUMBER = 101;

/** Canonical demo token (docs/SHARED_INTEGRATION_CONTRACT.md §6), owned by the demo patient. */
const DEMO_TOKEN = Object.freeze({
  id: 'token_demo_101',
  displayNumber: 'OPD-101',
  departmentId: 'dept_demo_opd',
  status: 'waiting',
  patientsAhead: 4,
  estimatedWaitMinutes: 20,
  patientId: 'user_demo_01',
});

function loadStore() {
  const stored = readStore(STORE_KEY, null);
  const store =
    stored && Array.isArray(stored.tokens) && stored.lastNumbers
      ? stored
      : { seeded: false, tokens: [], lastNumbers: {} };

  // Seed the demo token once, so completing or cancelling it does not bring it back.
  if (!store.seeded) {
    store.tokens.push({ ...DEMO_TOKEN, createdAt: new Date().toISOString() });
    store.lastNumbers[DEMO_TOKEN.departmentId] = FIRST_DISPLAY_NUMBER;
    store.seeded = true;
    writeStore(STORE_KEY, store);
  }
  return store;
}

/** Public QueueToken shape; `patientId` and timestamps stay server-side (mock-internal). */
function toPublicToken(token) {
  return {
    id: token.id,
    displayNumber: token.displayNumber,
    departmentId: token.departmentId,
    status: token.status,
    patientsAhead: token.patientsAhead,
    estimatedWaitMinutes: token.estimatedWaitMinutes,
    estimateLabel: ESTIMATE_LABEL,
  };
}

/** Patient-safe status shape from GET /queue-tokens/:tokenId/status. */
function toStatus(token) {
  const { departmentId: _omitted, ...status } = toPublicToken(token);
  return status;
}

function findOwnedToken(store, tokenId, user) {
  const token = store.tokens.find((item) => item.id === tokenId);
  if (!token) throw mockError(API_ERROR_CODES.NOT_FOUND, 'This token could not be found.');
  if (token.patientId !== user.id) {
    throw mockError(API_ERROR_CODES.FORBIDDEN, 'You do not have access to this token.');
  }
  return token;
}

export const mockQueueService = {
  async listActiveTokens() {
    await simulateLatency();
    const user = requireMockUser(['patient']);
    return loadStore()
      .tokens.filter((token) => token.patientId === user.id && isActiveStatus(token.status))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toPublicToken);
  },

  async createToken(departmentId) {
    await simulateLatency(600);
    const user = requireMockUser(['patient']);

    if (typeof departmentId !== 'string' || !departmentId) {
      throw mockError(API_ERROR_CODES.VALIDATION_ERROR, 'departmentId is required', [
        { field: 'departmentId', message: 'Required' },
      ]);
    }
    const department = MOCK_DEPARTMENTS.find((item) => item.id === departmentId);
    if (!department) throw mockError(API_ERROR_CODES.NOT_FOUND, 'Department not found.');

    const store = loadStore();
    const existing = store.tokens.find(
      (token) =>
        token.patientId === user.id &&
        token.departmentId === departmentId &&
        isActiveStatus(token.status),
    );
    if (existing) {
      throw mockError(
        API_ERROR_CODES.CONFLICT,
        `You already have an active token (${existing.displayNumber}) for ${department.name}.`,
      );
    }

    const number = (store.lastNumbers[departmentId] ?? FIRST_DISPLAY_NUMBER - 1) + 1;
    const waitingInDepartment = store.tokens.filter(
      (token) => token.departmentId === departmentId && token.status === 'waiting',
    ).length;
    const patientsAhead = department.simulatedQueueLength + waitingInDepartment;

    const token = {
      id: `token_mock_${crypto.randomUUID()}`,
      displayNumber: `${department.code}-${number}`,
      departmentId,
      status: 'waiting',
      patientsAhead,
      estimatedWaitMinutes: patientsAhead * SIMULATED_MINUTES_PER_PATIENT,
      patientId: user.id,
      createdAt: new Date().toISOString(),
    };
    store.tokens.push(token);
    store.lastNumbers[departmentId] = number;
    writeStore(STORE_KEY, store);
    return toPublicToken(token);
  },

  async getToken(tokenId) {
    await simulateLatency();
    const user = requireMockUser(['patient']);
    return toPublicToken(findOwnedToken(loadStore(), tokenId, user));
  },

  async getTokenStatus(tokenId) {
    await simulateLatency(200);
    const user = requireMockUser(['patient']);
    return toStatus(findOwnedToken(loadStore(), tokenId, user));
  },
};

/*
 * DEMO CONTROLS — mock mode only, not part of the API interface. They let a presenter
 * simulate what hospital staff would do, following the contract's transition rules.
 */
export const mockQueueDemo = {
  /** Simulate one patient ahead being seen. */
  async advanceQueue(tokenId) {
    await simulateLatency(200);
    const user = requireMockUser(['patient']);
    const store = loadStore();
    const token = findOwnedToken(store, tokenId, user);

    if (token.status !== 'waiting' || token.patientsAhead <= 0) {
      throw mockError(API_ERROR_CODES.CONFLICT, 'No one is ahead of this token in the queue.');
    }
    token.patientsAhead -= 1;
    token.estimatedWaitMinutes = token.patientsAhead * SIMULATED_MINUTES_PER_PATIENT;
    writeStore(STORE_KEY, store);
    return toPublicToken(token);
  },

  /** Simulate a staff status update, enforcing the contract's transitions. */
  async changeStatus(tokenId, nextStatus) {
    await simulateLatency(200);
    const user = requireMockUser(['patient']);
    const store = loadStore();
    const token = findOwnedToken(store, tokenId, user);

    if (!STATUS_TRANSITIONS[token.status]?.includes(nextStatus)) {
      throw mockError(
        API_ERROR_CODES.CONFLICT,
        `A ${STATUS_DETAILS[token.status].label.toLowerCase()} token cannot change to ${STATUS_DETAILS[nextStatus]?.label.toLowerCase() ?? nextStatus}.`,
      );
    }
    if (nextStatus === 'called') {
      if (token.patientsAhead > 0) {
        throw mockError(API_ERROR_CODES.CONFLICT, 'Patients ahead must be seen before this token is called.');
      }
      const alreadyCalled = store.tokens.some(
        (item) => item.departmentId === token.departmentId && item.status === 'called',
      );
      if (alreadyCalled) {
        throw mockError(API_ERROR_CODES.CONFLICT, 'Another token in this department is already called.');
      }
    }

    token.status = nextStatus;
    token.patientsAhead = 0;
    token.estimatedWaitMinutes = 0;
    writeStore(STORE_KEY, store);
    return toPublicToken(token);
  },
};

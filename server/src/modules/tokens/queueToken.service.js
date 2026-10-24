import { Department } from '../departments/department.model.js';
import { conflictError, notFoundError } from '../../utils/httpError.js';
import {
  QueueToken,
  activeTokenStatuses,
  oneActiveTokenIndexName,
} from './queueToken.model.js';
import { nextTokenSequence } from './tokenCounter.model.js';

export const duplicateKeyErrorCode = 11000;

// Wait-time estimates are simulated for the MVP and must always carry this label.
export const estimateLabel = 'Simulated estimate';
const simulatedMinutesPerPatient = 5;

const activeTokenExistsError = () => conflictError('You already have an active token for this department');

const formatDisplayNumber = (departmentCode, sequence) => `${departmentCode}-${String(sequence).padStart(3, '0')}`;

// Live count of waiting tokens issued earlier in the same department.
export async function countPatientsAhead(token) {
  if (token.status !== 'waiting') {
    return 0;
  }

  return QueueToken.countDocuments({
    departmentId: token.departmentId,
    status: 'waiting',
    sequence: { $lt: token.sequence },
  });
}

function toTokenStatus(token, patientsAhead) {
  return {
    id: token._id,
    displayNumber: token.displayNumber,
    status: token.status,
    patientsAhead,
    estimatedWaitMinutes: patientsAhead * simulatedMinutesPerPatient,
    estimateLabel,
  };
}

// patientId and ordering data are server-only and never included.
export function toPublicToken(token, patientsAhead) {
  const { id, displayNumber, ...rest } = toTokenStatus(token, patientsAhead);
  return { id, displayNumber, departmentId: token.departmentId, ...rest };
}

export async function createQueueToken(patient, departmentId) {
  // Ensures the one-active-token unique index exists before relying on it.
  await QueueToken.init();

  const department = await Department.findOne({ _id: departmentId, isActive: true }).lean();
  if (!department) {
    throw notFoundError('Department not found');
  }

  // Fast path for the common duplicate case; the unique index is the real guarantee.
  if (await QueueToken.exists({ patientId: patient._id, departmentId, status: { $in: activeTokenStatuses } })) {
    throw activeTokenExistsError();
  }

  const sequence = await nextTokenSequence(departmentId);
  const patientsAhead = await countPatientsAhead({ departmentId, sequence, status: 'waiting' });

  let token;
  try {
    token = await QueueToken.create({
      displayNumber: formatDisplayNumber(department.code, sequence),
      sequence,
      patientId: patient._id,
      departmentId,
      status: 'waiting',
      estimatedWaitMinutes: patientsAhead * simulatedMinutesPerPatient,
      patientsAheadSnapshot: patientsAhead,
    });
  } catch (error) {
    // A concurrent request for the same patient and department won the race.
    if (error?.code === duplicateKeyErrorCode && error.message.includes(oneActiveTokenIndexName)) {
      throw activeTokenExistsError();
    }
    throw error;
  }

  return toPublicToken(token, patientsAhead);
}

function canViewToken(user, token) {
  switch (user.role) {
    case 'admin':
      return true;
    case 'staff':
      return Boolean(user.departmentId) && user.departmentId === token.departmentId;
    case 'patient':
      return String(token.patientId) === String(user._id);
    default:
      return false;
  }
}

// Callers who may not view a token get the same 404 as for a missing token,
// so token existence is not disclosed to other patients.
async function findViewableToken(user, tokenId) {
  const token = await QueueToken.findById(tokenId).lean();
  if (!token || !canViewToken(user, token)) {
    throw notFoundError('Queue token not found');
  }

  return token;
}

export async function getQueueToken(user, tokenId) {
  const token = await findViewableToken(user, tokenId);
  return toPublicToken(token, await countPatientsAhead(token));
}

export async function getQueueTokenStatus(user, tokenId) {
  const token = await findViewableToken(user, tokenId);
  return toTokenStatus(token, await countPatientsAhead(token));
}

export async function listActiveTokensForPatient(patient) {
  const tokens = await QueueToken.find({ patientId: patient._id, status: { $in: activeTokenStatuses } })
    .sort({ issuedAt: 1, _id: 1 })
    .lean();

  return Promise.all(tokens.map(async (token) => toPublicToken(token, await countPatientsAhead(token))));
}

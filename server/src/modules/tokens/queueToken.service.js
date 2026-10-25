import { getHospitalTimeZone } from '../../config/hospital.js';
import { Department } from '../departments/department.model.js';
import { Visit, visitIdForToken } from '../visits/visit.model.js';
import { toServiceDate } from '../../utils/dates.js';
import { conflictError, notFoundError } from '../../utils/httpError.js';
import {
  QueueToken,
  activeTokenStatuses,
  oneActiveTokenIndexName,
  terminalTokenStatuses,
} from './queueToken.model.js';
import { nextTokenSequence } from './tokenCounter.model.js';

export const duplicateKeyErrorCode = 11000;

// Wait-time estimates are simulated for the MVP and must always carry this label.
export const estimateLabel = 'Simulated estimate';
export const simulatedMinutesPerPatient = 5;

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
  const issuedAt = new Date();
  const timeZone = getHospitalTimeZone();
  const visitId = visitIdForToken({ issuedAt, patientId: patient._id }, timeZone);

  let token;
  try {
    token = await QueueToken.create({
      displayNumber: formatDisplayNumber(department.code, sequence),
      sequence,
      patientId: patient._id,
      departmentId,
      status: 'waiting',
      issuedAt,
      visitId,
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

  await recordVisit(visitId, patient._id, issuedAt, timeZone);
  return toPublicToken(token, patientsAhead);
}

// Opens the day's visit record after the token exists, so a visit is never recorded without a
// token. Idempotent: later tokens on the same day find the existing record.
async function recordVisit(visitId, patientId, issuedAt, timeZone) {
  try {
    await Visit.updateOne(
      { _id: visitId },
      {
        $setOnInsert: {
          patientId,
          serviceDate: toServiceDate(issuedAt, timeZone),
          firstTokenAt: issuedAt,
          source: 'token',
        },
      },
      { upsert: true },
    );
  } catch (error) {
    // Two first tokens of the day can race to insert the same visit; the loser finds it existing.
    if (error?.code === duplicateKeyErrorCode) {
      return;
    }
    // The token is already issued and the visit is fully derivable from it: reports and visit
    // reads group tokens by visitId, and `npm run migrate:up` recreates missing visit records.
    // So the patient's request still succeeds; the failure is logged without personal data.
    console.error(`Visit record ${visitId.slice(0, 15)}… could not be saved: ${error?.name ?? 'Error'}`);
  }
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

// A patient may withdraw their own token only while it is still waiting. Ownership and status
// are part of the update filter, so the check and the change happen in one atomic operation:
// a concurrent call-next (waiting → called) or staff change can never be overwritten.
// Other patients' tokens are reported as missing, exactly like reads.
export async function cancelOwnQueueToken(patient, tokenId) {
  const owned = { _id: tokenId, patientId: patient._id };

  const updated = await QueueToken.findOneAndUpdate(
    { ...owned, status: 'waiting' },
    { $set: { status: 'cancelled' } },
    { new: true, lean: true },
  );
  if (updated) {
    return toPublicToken(updated, 0);
  }

  const current = await QueueToken.findOne(owned).select('status').lean();
  if (!current) {
    throw notFoundError('Queue token not found');
  }
  throw conflictError(`Only a waiting token can be cancelled. This token is ${current.status}.`);
}

export async function listActiveTokensForPatient(patient) {
  const tokens = await QueueToken.find({ patientId: patient._id, status: { $in: activeTokenStatuses } })
    .sort({ issuedAt: 1, _id: 1 })
    .lean();

  return Promise.all(tokens.map(async (token) => toPublicToken(token, await countPatientsAhead(token))));
}

// A finished token as its patient sees it in their history: the token's own fields and the
// timestamps the server actually recorded (calledAt by call-next, completedAt on completion;
// null when that step never happened). No queue position or estimate: they no longer apply.
function toHistoryToken(token) {
  return {
    id: token._id,
    displayNumber: token.displayNumber,
    departmentId: token.departmentId,
    status: token.status,
    issuedAt: token.issuedAt.toISOString(),
    calledAt: token.calledAt?.toISOString() ?? null,
    completedAt: token.completedAt?.toISOString() ?? null,
  };
}

// The patient's own finished tokens, newest first; _id breaks ties so pages never overlap.
// Active tokens are never included: they stay on GET /api/patients/me/queue-tokens/active.
export async function listTokenHistoryForPatient(patient, { status }, { page, limit, skip }) {
  const filter = { patientId: patient._id, status: status ?? { $in: terminalTokenStatuses } };
  const [tokens, total] = await Promise.all([
    QueueToken.find(filter).sort({ issuedAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    QueueToken.countDocuments(filter),
  ]);

  return { data: tokens.map(toHistoryToken), meta: { page, limit, total } };
}

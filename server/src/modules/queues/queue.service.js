import { Department } from '../departments/department.model.js';
import {
  QueueToken,
  activeTokenStatuses,
  oneCalledTokenIndexName,
  statusTransitions,
} from '../tokens/queueToken.model.js';
import { duplicateKeyErrorCode, toPublicToken } from '../tokens/queueToken.service.js';
import { conflictError, forbiddenError, notFoundError } from '../../utils/httpError.js';

const calledTokenExistsError = () => conflictError(
  'A token is already called in this department. Move it to in_consultation, skipped, or cancelled before calling the next token.',
);

function canManageDepartment(user, departmentId) {
  if (user.role === 'admin') {
    return true;
  }

  return user.role === 'staff' && Boolean(user.departmentId) && user.departmentId === departmentId;
}

async function requireManageableDepartment(user, departmentId) {
  if (!canManageDepartment(user, departmentId)) {
    throw forbiddenError('You can only manage the queue of your assigned department');
  }

  if (!(await Department.exists({ _id: departmentId, isActive: true }))) {
    throw notFoundError('Department not found');
  }
}

// Active tokens in queue order. patientId is never included.
export async function listDepartmentQueue(user, departmentId, { page, limit, skip }) {
  await requireManageableDepartment(user, departmentId);

  const filter = { departmentId, status: { $in: activeTokenStatuses } };
  const [tokens, total] = await Promise.all([
    QueueToken.find(filter).sort({ sequence: 1 }).skip(skip).limit(limit).lean(),
    QueueToken.countDocuments(filter),
  ]);

  // Tokens are in sequence order, so each waiting token has one more patient ahead
  // than the previous waiting token; only the first needs a count query.
  let waitingAhead = tokens.length === 0
    ? 0
    : await QueueToken.countDocuments({
      departmentId,
      status: 'waiting',
      sequence: { $lt: tokens[0].sequence },
    });

  const data = tokens.map((token) => {
    if (token.status !== 'waiting') {
      return toPublicToken(token, 0);
    }
    const item = toPublicToken(token, waitingAhead);
    waitingAhead += 1;
    return item;
  });

  return { data, meta: { page, limit, total } };
}

// Selection and transition happen in one atomic findOneAndUpdate, so a waiting token can
// only be called once; the one_called_token_per_department unique index stops two
// concurrent requests from each calling a different token.
export async function callNextToken(user, departmentId) {
  await requireManageableDepartment(user, departmentId);
  await QueueToken.init();

  if (await QueueToken.exists({ departmentId, status: 'called' })) {
    throw calledTokenExistsError();
  }

  let token;
  try {
    token = await QueueToken.findOneAndUpdate(
      { departmentId, status: 'waiting' },
      { $set: { status: 'called', calledAt: new Date() } },
      { sort: { sequence: 1 }, new: true, lean: true },
    );
  } catch (error) {
    if (error?.code === duplicateKeyErrorCode && error.message.includes(oneCalledTokenIndexName)) {
      throw calledTokenExistsError();
    }
    throw error;
  }

  if (!token) {
    throw conflictError('There are no waiting tokens to call in this department');
  }

  return { id: token._id, displayNumber: token.displayNumber, status: token.status };
}

function invalidTransitionError(from, to) {
  if (from === 'waiting' && to === 'called') {
    return conflictError('Waiting tokens can only be called through call-next');
  }

  return conflictError(`Cannot change token status from ${from} to ${to}`);
}

export async function updateTokenStatus(user, tokenId, nextStatus) {
  const token = await QueueToken.findById(tokenId).lean();

  // Tokens outside the caller's department are reported as missing, as for reads.
  if (!token || !canManageDepartment(user, token.departmentId)) {
    throw notFoundError('Queue token not found');
  }

  if (!statusTransitions[token.status].includes(nextStatus)) {
    throw invalidTransitionError(token.status, nextStatus);
  }

  // Compare-and-set on the status we validated against, so a concurrent change
  // cannot be overwritten with a transition that is no longer valid.
  const updated = await QueueToken.findOneAndUpdate(
    { _id: tokenId, status: token.status },
    { $set: { status: nextStatus, ...(nextStatus === 'completed' ? { completedAt: new Date() } : {}) } },
    { new: true, lean: true },
  );

  if (!updated) {
    throw conflictError('The token status changed while this request was processed. Reload and try again.');
  }

  return { id: updated._id, status: updated.status };
}

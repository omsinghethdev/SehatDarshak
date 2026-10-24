import { Department } from '../departments/department.model.js';
import { canManageDepartment } from '../../utils/departmentAccess.js';
import { conflictError, forbiddenError, notFoundError } from '../../utils/httpError.js';
import { AssistanceRequest, assistanceNotice } from './assistanceRequest.model.js';

// Documented public shape (docs/SHARED_INTEGRATION_CONTRACT.md); patientId,
// acknowledgedBy, and acknowledgedAt stay server-only.
function toPublicRequest(request) {
  return {
    id: request._id,
    status: request.status,
    createdAt: request.createdAt.toISOString(),
    notice: assistanceNotice,
  };
}

// The request's own submitted fields: staff need them to help, and the patient who sent the
// request needs them to recognise it in their history. Never includes patient or staff IDs.
function toDetailedRequest(request) {
  return {
    ...toPublicRequest(request),
    departmentId: request.departmentId,
    location: request.location,
    message: request.message,
  };
}

async function paginate(filter, { page, limit, skip }, toResponse) {
  const [requests, total] = await Promise.all([
    AssistanceRequest.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    AssistanceRequest.countDocuments(filter),
  ]);

  return { data: requests.map(toResponse), meta: { page, limit, total } };
}

export async function createAssistanceRequest(patient, { departmentId, location, message }) {
  if (!(await Department.exists({ _id: departmentId, isActive: true }))) {
    throw notFoundError('Department not found');
  }

  const request = await AssistanceRequest.create({
    patientId: patient._id,
    departmentId,
    location,
    message,
    status: 'open',
  });

  return toPublicRequest(request);
}

export function listOwnAssistanceRequests(patient, pagination) {
  return paginate({ patientId: patient._id }, pagination, toDetailedRequest);
}

// Admins see every department; staff only their assigned department.
export function listAssistanceRequests(user, { status }, pagination) {
  if (user.role === 'staff' && !user.departmentId) {
    throw forbiddenError('You are not assigned to a department');
  }

  const filter = {
    ...(user.role === 'staff' ? { departmentId: user.departmentId } : {}),
    ...(status ? { status } : {}),
  };

  return paginate(filter, pagination, toDetailedRequest);
}

export async function acknowledgeAssistanceRequest(user, requestId) {
  const request = await AssistanceRequest.findById(requestId).lean();

  // Requests outside the caller's department are reported as missing.
  if (!request || !canManageDepartment(user, request.departmentId)) {
    throw notFoundError('Assistance request not found');
  }

  // Compare-and-set: only one acknowledgement can move a request out of "open".
  const acknowledged = await AssistanceRequest.findOneAndUpdate(
    { _id: requestId, status: 'open' },
    { $set: { status: 'acknowledged', acknowledgedBy: user._id, acknowledgedAt: new Date() } },
    { new: true, lean: true },
  );

  if (!acknowledged) {
    throw conflictError('This assistance request has already been acknowledged');
  }

  return { id: acknowledged._id, status: acknowledged.status };
}

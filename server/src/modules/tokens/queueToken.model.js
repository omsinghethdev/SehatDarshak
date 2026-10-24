import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';

export const activeTokenStatuses = ['waiting', 'called', 'in_consultation'];
export const terminalTokenStatuses = ['completed', 'skipped', 'cancelled'];
export const tokenStatuses = [...activeTokenStatuses, ...terminalTokenStatuses];

// Staff/admin status changes allowed through PATCH /api/queue-tokens/:tokenId/status.
// waiting -> called is deliberately absent: it only happens through call-next.
export const statusTransitions = {
  waiting: ['cancelled'],
  called: ['in_consultation', 'skipped', 'cancelled'],
  in_consultation: ['completed', 'cancelled'],
  completed: [],
  skipped: [],
  cancelled: [],
};

export const oneActiveTokenIndexName = 'one_active_token_per_patient_department';
export const oneCalledTokenIndexName = 'one_called_token_per_department';

export const statusChangeActions = ['call_next', 'status_update'];

// One successful status change, appended in the same atomic update that changes `status`
// (docs/DATABASE_SCHEMA.md → statusHistory). Never returned in patient or staff responses.
const statusChangeSchema = new mongoose.Schema({
  fromStatus: { type: String, enum: tokenStatuses, required: true },
  toStatus: { type: String, enum: tokenStatuses, required: true },
  action: { type: String, enum: statusChangeActions, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorRole: { type: String, required: true },
  occurredAt: { type: Date, required: true },
});

export function statusChange(actor, fromStatus, toStatus, action) {
  return {
    _id: new mongoose.Types.ObjectId(),
    fromStatus,
    toStatus,
    action,
    actorId: actor._id,
    actorRole: actor.role,
    occurredAt: new Date(),
  };
}

// Random, unguessable IDs in the same "prefix_value" style as other resource IDs.
const generateTokenId = () => `token_${randomBytes(12).toString('hex')}`;

const queueTokenSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateTokenId },
    displayNumber: { type: String, required: true },
    // Server-only position in the department's queue; also drives display numbers.
    sequence: { type: Number, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: String, ref: 'Department', required: true },
    status: { type: String, enum: tokenStatuses, required: true, default: 'waiting' },
    issuedAt: { type: Date, required: true, default: Date.now },
    calledAt: { type: Date },
    completedAt: { type: Date },
    estimatedWaitMinutes: { type: Number },
    patientsAheadSnapshot: { type: Number },
    // The patient's hospital visit (encounter) this token belongs to; see visits/visit.model.js.
    // Absent on tokens created before visits existed until the backfill migration runs.
    visitId: { type: String, ref: 'Visit' },
    statusHistory: { type: [statusChangeSchema], default: undefined, select: false },
  },
  { timestamps: true },
);

// Database-level guarantee of one active token per patient and department, including
// under concurrent requests. Requires MongoDB 6.0+ ($in in a partial filter).
queueTokenSchema.index(
  { patientId: 1, departmentId: 1 },
  {
    unique: true,
    name: oneActiveTokenIndexName,
    partialFilterExpression: { status: { $in: activeTokenStatuses } },
  },
);
// Database-level guarantee that a department never has two "called" tokens at once.
queueTokenSchema.index(
  { departmentId: 1 },
  {
    unique: true,
    name: oneCalledTokenIndexName,
    partialFilterExpression: { status: 'called' },
  },
);
queueTokenSchema.index({ departmentId: 1, sequence: 1 }, { unique: true });
queueTokenSchema.index({ departmentId: 1, status: 1, sequence: 1 });
// Reporting and visit lookups.
queueTokenSchema.index({ issuedAt: 1, departmentId: 1 });
queueTokenSchema.index({ status: 1, completedAt: 1 });
queueTokenSchema.index({ visitId: 1 });
queueTokenSchema.index({ patientId: 1, issuedAt: -1 });
queueTokenSchema.index({ 'statusHistory.occurredAt': -1 });

export const QueueToken = mongoose.models.QueueToken || mongoose.model('QueueToken', queueTokenSchema);

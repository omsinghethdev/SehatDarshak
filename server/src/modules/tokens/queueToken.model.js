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

export const QueueToken = mongoose.models.QueueToken || mongoose.model('QueueToken', queueTokenSchema);

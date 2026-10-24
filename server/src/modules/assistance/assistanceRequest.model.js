import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';

// The only MVP lifecycle is open -> acknowledged; there is no "resolved" status.
export const assistanceStatuses = ['open', 'acknowledged'];

// Assistance requests go to hospital staff; they are never an emergency medical response.
export const assistanceNotice = 'Request sent to hospital staff; this is not guaranteed emergency medical response.';

const generateRequestId = () => `assist_${randomBytes(12).toString('hex')}`;

const assistanceRequestSchema = new mongoose.Schema(
  {
    _id: { type: String, default: generateRequestId },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    departmentId: { type: String, ref: 'Department', required: true },
    location: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: assistanceStatuses, required: true, default: 'open' },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    acknowledgedAt: { type: Date },
  },
  { timestamps: true },
);

assistanceRequestSchema.index({ patientId: 1, createdAt: -1 });
assistanceRequestSchema.index({ departmentId: 1, status: 1, createdAt: -1 });

export const AssistanceRequest = mongoose.models.AssistanceRequest
  || mongoose.model('AssistanceRequest', assistanceRequestSchema);

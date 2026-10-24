import mongoose from 'mongoose';
import { auditEntrySchema } from '../audit/auditEntry.schema.js';

/*
 * A ward is a hospital area that is administered separately from a department (for example an
 * observation or inpatient ward). It may belong to a department and may sit on a mapped floor,
 * but it is not a department: queues, tokens, and staff permissions stay department-based.
 * Ward assignments are administrative information only and grant no permissions.
 *
 * Wards are new and have no map geometry, so creating or editing them cannot affect the
 * existing departments, rooms, floors, map, or QR features. Wards are never hard-deleted;
 * they are deactivated so historical visit assignments keep their meaning.
 */

export const wardCodePattern = /^[A-Z0-9-]{2,16}$/;

// Stable, readable ID derived from the (immutable) code, e.g. code "OBS-1" → "ward_obs_1".
export const wardIdFromCode = (code) => `ward_${code.toLowerCase().replaceAll('-', '_')}`;

const wardSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    departmentId: { type: String, ref: 'Department' },
    floorId: { type: String, ref: 'Floor' },
    isActive: { type: Boolean, default: true },
    auditTrail: { type: [auditEntrySchema], default: undefined, select: false },
  },
  { timestamps: true },
);

wardSchema.index({ departmentId: 1, isActive: 1, name: 1 });
wardSchema.index({ 'auditTrail.occurredAt': -1 });

export const Ward = mongoose.models.Ward || mongoose.model('Ward', wardSchema);

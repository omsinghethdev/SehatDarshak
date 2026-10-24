import mongoose from 'mongoose';
import { supportedLanguages } from '../../config/languages.js';
import { auditEntrySchema } from '../audit/auditEntry.schema.js';

export const userRoles = ['patient', 'staff', 'admin'];

// Doctors use the `staff` role (docs/API_CONTRACT.md → Authentication and authorization), so they
// get exactly the department-scoped staff permissions. `staffType` only records the job category
// for administration and reporting; it never grants or removes permissions.
export const staffTypes = ['doctor', 'staff'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    identifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true, select: false },
    preferredLanguage: { type: String, enum: supportedLanguages },
    role: { type: String, enum: userRoles, required: true, default: 'patient' },
    departmentId: { type: String, ref: 'Department' },
    // Missing on accounts created before account status existed; treated as active.
    isActive: { type: Boolean, default: true },

    // Staff-only administrative profile. All optional: the app cannot verify professional details.
    staffType: { type: String, enum: staffTypes },
    wardId: { type: String, ref: 'Ward' },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    designation: { type: String, trim: true },
    specialization: { type: String, trim: true },
    registrationNumber: { type: String, trim: true },

    // Access tokens issued before this instant are rejected (set on password reset or change).
    passwordChangedAt: { type: Date },
    // Set when an admin issues a temporary password; cleared when the user chooses a new one.
    mustChangePassword: { type: Boolean },

    auditTrail: { type: [auditEntrySchema], default: undefined, select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, departmentId: 1, isActive: 1, name: 1 });
userSchema.index({ role: 1, staffType: 1, isActive: 1 });
userSchema.index({ role: 1, wardId: 1 });
userSchema.index({ 'auditTrail.occurredAt': -1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);

export const isActiveAccount = (user) => user.isActive !== false;
export const staffTypeOf = (user) => user.staffType ?? 'staff';

// Staff always get `departmentId` (null when unassigned) so the staff UI opens their own
// department instead of guessing. The server still authorizes every department request.
// `mustChangePassword` appears only when true (after an admin password reset).
export function toPublicUser(user) {
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    role: user.role,
    ...(user.preferredLanguage ? { preferredLanguage: user.preferredLanguage } : {}),
    ...(user.role === 'staff' ? { departmentId: user.departmentId ?? null } : {}),
    ...(user.mustChangePassword ? { mustChangePassword: true } : {}),
  };
}

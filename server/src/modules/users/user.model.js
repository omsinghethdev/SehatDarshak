import mongoose from 'mongoose';
import { supportedLanguages } from '../../config/languages.js';

export const userRoles = ['patient', 'staff', 'admin'];

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
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model('User', userSchema);

// Staff always get `departmentId` (null when unassigned) so the staff UI opens their own
// department instead of guessing. The server still authorizes every department request.
export function toPublicUser(user) {
  return {
    id: String(user._id ?? user.id),
    name: user.name,
    role: user.role,
    ...(user.preferredLanguage ? { preferredLanguage: user.preferredLanguage } : {}),
    ...(user.role === 'staff' ? { departmentId: user.departmentId ?? null } : {}),
  };
}

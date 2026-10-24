import mongoose from 'mongoose';

/*
 * Administrative audit entries are embedded in the record they describe (staff user, visit, ward)
 * and appended in the same single-document atomic update as the change itself, so a change and
 * its audit entry are always written together. This follows the approach already agreed for
 * queue-token `statusHistory` (docs/DATABASE_SCHEMA.md) and needs no multi-document transactions,
 * which a standalone MongoDB does not support.
 *
 * Entries hold only safe metadata: who, what, when, and changed field values. Never passwords,
 * password hashes, tokens, or clinical information.
 */

export const auditActions = [
  'staff_created',
  'staff_profile_updated',
  'staff_assignment_changed',
  'staff_deactivated',
  'staff_reactivated',
  'staff_password_reset',
  'password_changed',
  'visit_metadata_corrected',
  'ward_created',
  'ward_updated',
  'ward_deactivated',
  'ward_reactivated',
];

const changeSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    from: { type: mongoose.Schema.Types.Mixed },
    to: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

export const auditEntrySchema = new mongoose.Schema({
  action: { type: String, enum: auditActions, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actorRole: { type: String, required: true },
  occurredAt: { type: Date, required: true },
  changes: { type: [changeSchema], default: undefined },
});

// Builds one entry. `changes` is a list of { field, from, to } with safe scalar values only.
export function auditEntry(actor, action, changes = []) {
  return {
    _id: new mongoose.Types.ObjectId(),
    action,
    actorId: actor._id,
    actorRole: actor.role,
    occurredAt: new Date(),
    ...(changes.length > 0 ? { changes } : {}),
  };
}

// Field-by-field differences between `before` and `after` for the listed fields.
// Missing values are reported as null so the audit trail is explicit.
export function diffFields(before, after, fields) {
  return fields
    .filter((field) => field in after && (before[field] ?? null) !== (after[field] ?? null))
    .map((field) => ({ field, from: before[field] ?? null, to: after[field] ?? null }));
}

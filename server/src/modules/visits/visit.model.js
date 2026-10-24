import mongoose from 'mongoose';
import { auditEntrySchema } from '../audit/auditEntry.schema.js';
import { toServiceDate } from '../../utils/dates.js';

/*
 * A Visit is one patient's hospital encounter on one service date (a calendar day in the hospital
 * time zone). It is opened by the first queue token the patient receives that day; every token
 * issued to the same patient on the same date belongs to it, so one visit can span several
 * departments. A visit is never created without a token, and nothing about a consultation is
 * inferred from it: consultations are tokens that staff moved to `completed`.
 *
 * The visit ID is derived from the service date and patient ID, so the token, the visit record,
 * and report aggregations always agree on it, even for tokens created before visits existed.
 * Visit status is derived from its tokens when read (see visit.service.js), never stored.
 *
 * Stored fields are administrative only (ward, a short non-clinical note). Clinical information is
 * out of scope (docs/API_CONTRACT.md → Scope) and must not be recorded here.
 */

export const visitStatuses = ['in_progress', 'completed', 'not_completed'];
export const visitIdPattern = /^visit_(\d{4})(\d{2})(\d{2})_([a-f0-9]{24})$/;

export function buildVisitId(serviceDate, patientId) {
  return `visit_${serviceDate.replaceAll('-', '')}_${String(patientId)}`;
}

export function visitIdForToken({ issuedAt, patientId }, timeZone) {
  return buildVisitId(toServiceDate(issuedAt, timeZone), patientId);
}

// { serviceDate, patientId } from a visit ID, or null when the ID is not a visit ID.
export function parseVisitId(visitId) {
  const match = visitIdPattern.exec(visitId);
  if (!match) {
    return null;
  }
  const [, year, month, day, patientId] = match;
  return { serviceDate: `${year}-${month}-${day}`, patientId };
}

const visitSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    serviceDate: { type: String, required: true },
    firstTokenAt: { type: Date, required: true },
    // Optional administrative assignment, e.g. an observation ward. Not used for permissions.
    wardId: { type: String, ref: 'Ward' },
    // Short administrative note for corrections. Not for clinical information.
    adminNote: { type: String, trim: true },
    // How the record was created: when its first token was issued, by the backfill migration, or
    // when an admin corrected a visit whose tokens predate visit records.
    source: { type: String, enum: ['token', 'migration', 'correction'], required: true },
    auditTrail: { type: [auditEntrySchema], default: undefined, select: false },
  },
  { timestamps: true },
);

// One visit per patient per service date.
visitSchema.index({ patientId: 1, serviceDate: 1 }, { unique: true });
visitSchema.index({ serviceDate: 1, wardId: 1 });
visitSchema.index({ 'auditTrail.occurredAt': -1 });

export const Visit = mongoose.models.Visit || mongoose.model('Visit', visitSchema);

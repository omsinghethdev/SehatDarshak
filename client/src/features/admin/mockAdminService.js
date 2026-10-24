import { mockError, readStore, requireMockUser, simulateLatency, writeStore } from '../../lib/mockBackend';
import {
  HOSPITAL_TIME_ZONE,
  listDates,
  previousPeriod,
  resolvePeriod,
  toServiceDate,
} from '../../lib/serviceDates';
import { API_ERROR_CODES } from '../../services/apiClient';
import { readMockAssistanceRecords } from '../assistance/mockAssistanceService';
import { readMockAccounts } from '../auth/mockAccountStore';
import { MOCK_DEMO_ACCOUNTS } from '../auth/mockDemoAccounts';
import { MOCK_DEPARTMENTS } from '../departments/mockDepartments';
import { MOCK_FLOOR_MAPS } from '../navigation/mockFloorMaps';
import { readMockQueueRecords } from '../queue/mockQueueService';

/*
 * DEVELOPMENT-ONLY admin backend for mock mode. Responses use the same shapes and validation as
 * the real admin API (server/ADMIN_API.md) so the admin UI behaves the same in both modes.
 *
 * - Visits, queue counts, and assistance counts are calculated from the mock queue and assistance
 *   data in this browser (the same data the patient and staff views use).
 * - The staff/doctor directory, wards, visit corrections, and admin activity live in their own
 *   store. Directory accounts are fictional and separate from demo sign-in: they cannot sign in,
 *   and changing them does not affect the demo sign-in buttons.
 * - The mock queue does not record who changed a token, so no consultation is attributed to a
 *   doctor and the queue status history is not available. Nothing is invented to fill those gaps.
 */

const STORE_KEY = 'sehatdarsak.mockAdmin';
const STORE_VERSION = 1;
const BACKGROUND_PATIENT_ID = 'mock_background_patient';
const ACTIVE_STATUSES = ['waiting', 'called', 'in_consultation'];
const TOKEN_STATUSES = [...ACTIVE_STATUSES, 'completed', 'skipped', 'cancelled'];
const DEMO_PATIENT_REGISTERED_AT = '2026-10-24T10:00:00.000Z';

const nowIso = () => new Date().toISOString();

function seedStore() {
  const createdAt = nowIso();
  const account = (fields) => ({ isActive: true, createdAt, updatedAt: createdAt, ...fields });
  return {
    version: STORE_VERSION,
    staff: [
      account({ id: 'user_demo_staff_opd', name: 'Demo Staff (OPD)', identifier: 'demo.staff.opd', staffType: 'staff', departmentId: 'dept_demo_opd' }),
      account({ id: 'user_demo_staff_med', name: 'Demo Staff (Medicine)', identifier: 'demo.staff.med', staffType: 'staff', departmentId: 'dept_demo_med' }),
      account({ id: 'mock_doctor_opd', name: 'Dr. Demo Doctor (OPD)', identifier: 'demo.doctor.opd', staffType: 'doctor', departmentId: 'dept_demo_opd', specialization: 'General practice' }),
      account({ id: 'mock_doctor_med', name: 'Dr. Demo Doctor (Medicine)', identifier: 'demo.doctor.med', staffType: 'doctor', departmentId: 'dept_demo_med', specialization: 'Internal medicine' }),
    ],
    wards: [],
    audit: [],
    visitMeta: {},
  };
}

function loadStore() {
  const stored = readStore(STORE_KEY, null);
  if (stored?.version === STORE_VERSION && Array.isArray(stored.staff)) return stored;
  const store = seedStore();
  writeStore(STORE_KEY, store);
  return store;
}

const saveStore = (store) => writeStore(STORE_KEY, store);

function validation(details) {
  const [first] = details;
  return mockError(API_ERROR_CODES.VALIDATION_ERROR, `${first.field}: ${first.message}`, details);
}
const notFound = (what) => mockError(API_ERROR_CODES.NOT_FOUND, `${what} not found`);
const conflict = (message) => mockError(API_ERROR_CODES.CONFLICT, message);

function paginate(items, { page = 1, limit = 20 } = {}) {
  const start = (page - 1) * limit;
  return { items: items.slice(start, start + limit), meta: { page, limit, total: items.length } };
}

const departmentName = (id) => MOCK_DEPARTMENTS.find((department) => department.id === id)?.name ?? null;
const literal = (text) => text.toLowerCase();

// ---- Audit -------------------------------------------------------------------------------

const REDACTED_FIELDS = new Set(['phone', 'email', 'registrationNumber', 'adminNote']);

function recordAudit(store, actor, { targetType, targetId, targetName, action, changes = [] }) {
  store.audit.unshift({
    id: `mock_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    targetType,
    targetId,
    targetName: targetName ?? null,
    action,
    actor: { id: actor.id, role: actor.role, name: actor.name },
    occurredAt: nowIso(),
    changes: changes.map((change) => (REDACTED_FIELDS.has(change.field) ? { field: change.field } : change)),
  });
}

function diff(before, after, fields) {
  return fields
    .filter((field) => field in after && (before[field] ?? null) !== (after[field] ?? null))
    .map((field) => ({ field, from: before[field] ?? null, to: after[field] ?? null }));
}

// ---- Staff validation (same rules as the server) -------------------------------------------

const IDENTIFIER = /^[a-z0-9._-]{3,30}$/;
const PROFILE_RULES = {
  phone: { max: 20, pattern: /^\+?[0-9][0-9 -]{5,18}[0-9]$/, message: 'Must be a phone number (digits, spaces, hyphens, optional leading +)' },
  email: { max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Must be an email address' },
  designation: { max: 100 },
  specialization: { max: 100 },
  registrationNumber: { max: 40, pattern: /^[A-Za-z0-9/.-]+$/, message: 'Use letters, numbers, slashes, dots, or hyphens' },
};
const PROFILE_FIELDS = Object.keys(PROFILE_RULES);
const DOCTOR_ONLY = ['specialization', 'registrationNumber'];

function checkProfile(field, value, details) {
  if (value === undefined || value === null || value === '') return value === '' ? null : value;
  const text = String(value).trim();
  const rule = PROFILE_RULES[field];
  if (text.length > rule.max) details.push({ field, message: `Must be at most ${rule.max} characters` });
  else if (rule.pattern && !rule.pattern.test(text)) details.push({ field, message: rule.message });
  return field === 'email' ? text.toLowerCase() : text;
}

function takenIdentifiers(store) {
  return new Set([
    ...store.staff.map((item) => item.identifier),
    ...MOCK_DEMO_ACCOUNTS.map((item) => item.identifier),
    ...readMockAccounts().map((item) => item.identifier),
  ]);
}

function requireDepartment(id) {
  if (!MOCK_DEPARTMENTS.some((department) => department.id === id)) throw notFound('Department');
}
function requireActiveWard(store, id) {
  if (!store.wards.some((ward) => ward.id === id && ward.isActive)) throw notFound('Ward');
}

function toStaffAccount(store, item) {
  const ward = store.wards.find((entry) => entry.id === item.wardId);
  return {
    id: item.id,
    name: item.name,
    identifier: item.identifier,
    role: 'staff',
    staffType: item.staffType ?? 'staff',
    departmentId: item.departmentId ?? null,
    departmentName: departmentName(item.departmentId),
    wardId: item.wardId ?? null,
    wardName: ward?.name ?? null,
    isActive: item.isActive !== false,
    ...Object.fromEntries(PROFILE_FIELDS.filter((field) => item[field]).map((field) => [field, item[field]])),
    mustChangePassword: Boolean(item.mustChangePassword),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

// ---- Visits derived from the mock queue ----------------------------------------------------

function knownPatients() {
  const demo = MOCK_DEMO_ACCOUNTS.find((account) => account.key === 'patient');
  const registered = readMockAccounts().filter((account) => (account.kind ?? 'patient') === 'patient');
  return [
    { id: demo.user.id, name: demo.user.name, identifier: demo.identifier, registeredAt: DEMO_PATIENT_REGISTERED_AT },
    ...registered.map((account) => ({ id: account.id, name: account.name, identifier: account.identifier, registeredAt: account.createdAt ?? null })),
  ];
}

function patientRef(patientKey, patients) {
  const patient = patients.find((item) => item.id === patientKey);
  return patient
    ? { id: patient.id, name: patient.name, identifier: patient.identifier }
    : { id: patientKey, name: 'Fictional walk-in patient', identifier: null };
}

// Each seeded background token stands for a different fictional patient without an account.
const patientKeyOf = (token) => (token.patientId === BACKGROUND_PATIENT_ID ? `bg_${token.id}` : token.patientId);

function tokenRecords() {
  return readMockQueueRecords().map((token) => {
    const patientKey = patientKeyOf(token);
    const serviceDate = toServiceDate(token.createdAt, HOSPITAL_TIME_ZONE);
    return {
      ...token,
      patientKey,
      serviceDate,
      visitId: `visit_${serviceDate.replaceAll('-', '')}_${patientKey}`,
      completedDate: token.status === 'completed' ? toServiceDate(token.updatedAt, HOSPITAL_TIME_ZONE) : null,
    };
  });
}

function visitStatus(tokens) {
  if (tokens.some((token) => ACTIVE_STATUSES.includes(token.status))) return 'in_progress';
  if (tokens.some((token) => token.status === 'completed')) return 'completed';
  return 'not_completed';
}

function groupVisits(tokens) {
  const visits = new Map();
  for (const token of tokens) {
    if (!visits.has(token.visitId)) visits.set(token.visitId, []);
    visits.get(token.visitId).push(token);
  }
  return visits;
}

function toVisit(store, visitId, tokens, patients) {
  const sorted = [...tokens].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const meta = store.visitMeta[visitId] ?? {};
  const ward = store.wards.find((item) => item.id === meta.wardId);
  const departmentIds = [...new Set(sorted.map((token) => token.departmentId))].sort();
  return {
    id: visitId,
    serviceDate: sorted[0].serviceDate,
    status: visitStatus(sorted),
    patient: patientRef(sorted[0].patientKey, patients),
    departments: departmentIds.map((id) => ({ id, name: departmentName(id) })),
    ward: meta.wardId ? { id: meta.wardId, name: ward?.name ?? null } : null,
    tokenCount: sorted.length,
    consultationsCompleted: sorted.filter((token) => token.status === 'completed').length,
    firstTokenAt: sorted[0].createdAt,
    _tokens: sorted,
    _meta: meta,
  };
}

const inPeriod = (date, period) => !period || (date >= period.from && date <= period.to);

// ---- Statistics ------------------------------------------------------------------------------

function activity(tokens, period) {
  const inRange = tokens.filter((token) => inPeriod(token.serviceDate, period));
  const visits = groupVisits(inRange);
  const visitsPerPatient = new Map();
  for (const list of visits.values()) {
    visitsPerPatient.set(list[0].patientKey, (visitsPerPatient.get(list[0].patientKey) ?? 0) + 1);
  }
  const byStatus = Object.fromEntries(TOKEN_STATUSES.map((status) => [status, 0]));
  for (const token of inRange) byStatus[token.status] += 1;
  const departmentVisits = new Set(inRange.map((token) => `${token.visitId}|${token.departmentId}`));
  const consultations = tokens.filter((token) => token.completedDate && inPeriod(token.completedDate, period));
  return { inRange, visits, visitsPerPatient, byStatus, departmentVisits, consultations };
}

function comparison(current, previous) {
  return {
    current,
    previous,
    change: current - previous,
    changePercent: previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10,
  };
}

function workforce(staff, departmentId) {
  const counts = { doctors: { active: 0, inactive: 0 }, staff: { active: 0, inactive: 0 } };
  for (const item of staff) {
    if (departmentId && item.departmentId !== departmentId) continue;
    counts[item.staffType === 'doctor' ? 'doctors' : 'staff'][item.isActive === false ? 'inactive' : 'active'] += 1;
  }
  return counts;
}

function currentQueue(tokens, departmentId) {
  const counts = Object.fromEntries(ACTIVE_STATUSES.map((status) => [status, 0]));
  for (const token of tokens) {
    if (ACTIVE_STATUSES.includes(token.status) && (!departmentId || token.departmentId === departmentId)) counts[token.status] += 1;
  }
  return counts;
}

function assistance(period, departmentId) {
  const requests = readMockAssistanceRecords().filter((request) => !departmentId || request.departmentId === departmentId);
  const created = requests.filter((request) => inPeriod(toServiceDate(request.createdAt, HOSPITAL_TIME_ZONE), period));
  const byStatus = { open: 0, acknowledged: 0 };
  for (const request of created) if (request.status in byStatus) byStatus[request.status] += 1;
  return {
    createdInPeriod: created.length,
    byStatus,
    currentlyOpen: requests.filter((request) => request.status === 'open').length,
  };
}

function roomsOf(departmentId) {
  return MOCK_FLOOR_MAPS.flatMap((floor) =>
    (floor.locations ?? [])
      .filter((location) => location.departmentId === departmentId)
      .map((location) => ({ id: location.id, name: location.displayName, floorId: floor.id, type: location.roomType, isActive: true })),
  );
}

// ---- Service -------------------------------------------------------------------------------

function admin() {
  return requireMockUser(['admin']);
}

function periodOrThrow(input, { allowAll = false } = {}) {
  if (allowAll && input?.key === 'all') return null;
  const resolved = input ? resolvePeriod({ period: input.key, from: input.from, to: input.to }) : resolvePeriod();
  if (resolved.error) throw validation([{ field: 'period', message: resolved.error }]);
  return resolved;
}

export const mockAdminService = {
  source: 'mock',
  // The mock queue does not record status-change actors, so these are not available here.
  capabilities: { queueStatusHistory: false, doctorAttribution: false },

  async getStatistics({ period: input, compare = true } = {}) {
    await simulateLatency();
    admin();
    const store = loadStore();
    const period = periodOrThrow(input);
    const tokens = tokenRecords();
    const now = activity(tokens, period);
    const today = toServiceDate(new Date(), HOSPITAL_TIME_ZONE);
    const queue = currentQueue(tokens);
    const patients = knownPatients();

    const byDepartment = MOCK_DEPARTMENTS.map((department) => {
      const own = now.inRange.filter((token) => token.departmentId === department.id);
      return {
        id: department.id,
        name: department.name,
        code: department.code,
        isActive: true,
        departmentVisits: new Set(own.map((token) => token.visitId)).size,
        uniquePatients: new Set(own.map((token) => token.patientKey)).size,
        tokensIssued: own.length,
        skipped: own.filter((token) => token.status === 'skipped').length,
        cancelled: own.filter((token) => token.status === 'cancelled').length,
        consultationsCompleted: now.consultations.filter((token) => token.departmentId === department.id).length,
        currentlyWaiting: currentQueue(tokens, department.id).waiting,
      };
    });

    const wardCounts = new Map();
    for (const [visitId, meta] of Object.entries(store.visitMeta)) {
      const date = visitId.slice(6, 14).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
      if (meta.wardId && inPeriod(date, period) && now.visits.has(visitId)) wardCounts.set(meta.wardId, (wardCounts.get(meta.wardId) ?? 0) + 1);
    }

    let comparisonResult = null;
    if (compare) {
      const previous = previousPeriod(period);
      const before = activity(tokens, previous);
      comparisonResult = {
        previousPeriod: { from: previous.from, to: previous.to, days: previous.days },
        visits: comparison(now.visits.size, before.visits.size),
        uniqueVisiting: comparison(now.visitsPerPatient.size, before.visitsPerPatient.size),
        tokensIssued: comparison(now.inRange.length, before.inRange.length),
        consultationsCompleted: comparison(now.consultations.length, before.consultations.length),
      };
    }

    return {
      generatedAt: nowIso(),
      timeZone: HOSPITAL_TIME_ZONE,
      period: { key: period.key, from: period.from, to: period.to, days: period.days },
      patients: {
        registeredTotal: patients.length,
        registeredInPeriod: patients.filter((patient) => patient.registeredAt && inPeriod(toServiceDate(patient.registeredAt), period)).length,
        uniqueVisiting: now.visitsPerPatient.size,
        repeatVisitors: [...now.visitsPerPatient.values()].filter((count) => count > 1).length,
      },
      visits: {
        total: now.visits.size,
        today: activity(tokens, { from: today, to: today }).visits.size,
        departmentVisits: now.departmentVisits.size,
      },
      queueTokens: {
        issued: now.inRange.length,
        issuedByCurrentStatus: now.byStatus,
        consultationsCompleted: now.consultations.length,
        currentlyWaiting: queue.waiting,
        currentlyActive: queue.waiting + queue.called + queue.in_consultation,
      },
      assistanceRequests: assistance(period),
      workforce: workforce(store.staff),
      trend: listDates(period.from, period.to).map((date) => {
        const day = activity(tokens, { from: date, to: date });
        return {
          date,
          visits: day.visits.size,
          uniquePatients: day.visitsPerPatient.size,
          tokensIssued: day.inRange.length,
          consultationsCompleted: day.consultations.length,
        };
      }),
      byDepartment,
      byWard: [...wardCounts.entries()].map(([id, visits]) => {
        const ward = store.wards.find((item) => item.id === id);
        return { id, name: ward?.name ?? null, code: ward?.code ?? null, visits };
      }).sort((a, b) => b.visits - a.visits),
      byDoctor: {
        doctors: store.staff
          .filter((item) => item.staffType === 'doctor' && item.isActive !== false)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => ({ id: item.id, name: item.name, departmentId: item.departmentId, departmentName: departmentName(item.departmentId), consultationsCompleted: 0 })),
        consultationsNotAttributedToDoctor: now.consultations.length,
      },
      comparison: comparisonResult,
    };
  },

  async listStaff({ staffType, departmentId, wardId, isActive, q, page, limit } = {}) {
    await simulateLatency();
    admin();
    const store = loadStore();
    const search = q?.trim() ? literal(q.trim()) : null;
    const items = store.staff
      .filter((item) => !staffType || (item.staffType ?? 'staff') === staffType)
      .filter((item) => !departmentId || item.departmentId === departmentId)
      .filter((item) => !wardId || item.wardId === wardId)
      .filter((item) => isActive === undefined || (item.isActive !== false) === isActive)
      .filter((item) => !search
        || item.name.toLowerCase().includes(search)
        || item.identifier.startsWith(search)
        || (item.specialization ?? '').toLowerCase().includes(search))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => toStaffAccount(store, item));
    return paginate(items, { page, limit });
  },

  async getStaff(staffId) {
    await simulateLatency();
    admin();
    const store = loadStore();
    const item = store.staff.find((entry) => entry.id === staffId);
    if (!item) throw notFound('Staff account');
    return toStaffAccount(store, item);
  },

  async createStaff(input) {
    await simulateLatency();
    const actor = admin();
    const store = loadStore();
    const details = [];
    const name = (input.name ?? '').trim();
    const identifier = (input.identifier ?? '').trim().toLowerCase();
    if (!name) details.push({ field: 'name', message: 'Required' });
    else if (name.length > 100) details.push({ field: 'name', message: 'Must be at most 100 characters' });
    if (!identifier) details.push({ field: 'identifier', message: 'Required' });
    else if (!IDENTIFIER.test(identifier)) details.push({ field: 'identifier', message: 'Must be 3-30 characters using letters, numbers, dots, hyphens, or underscores' });
    if (!input.password) details.push({ field: 'password', message: 'Required' });
    else if (input.password.length < 8) details.push({ field: 'password', message: 'Must be at least 8 characters' });
    else if (input.password.length > 128) details.push({ field: 'password', message: 'Must be at most 128 characters' });
    if (!input.departmentId) details.push({ field: 'departmentId', message: 'Required' });
    const staffType = input.staffType ?? 'staff';
    const profile = {};
    for (const field of PROFILE_FIELDS) profile[field] = checkProfile(field, input[field], details) ?? undefined;
    if (staffType !== 'doctor') {
      for (const field of DOCTOR_ONLY) if (profile[field]) details.push({ field, message: 'Only allowed for doctors (staffType "doctor")' });
    }
    if (details.length) throw validation(details);
    requireDepartment(input.departmentId);
    if (input.wardId) requireActiveWard(store, input.wardId);
    if (takenIdentifiers(store).has(identifier)) throw conflict('Username is already taken');

    const createdAt = nowIso();
    // The password is checked like the server's but not stored: directory accounts cannot sign in.
    const item = {
      id: `mock_staff_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      identifier,
      staffType,
      departmentId: input.departmentId,
      ...(input.wardId ? { wardId: input.wardId } : {}),
      ...Object.fromEntries(Object.entries(profile).filter(([, value]) => value)),
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    };
    store.staff.push(item);
    recordAudit(store, actor, {
      targetType: 'staff', targetId: item.id, targetName: item.name, action: 'staff_created',
      changes: ['name', 'departmentId', 'staffType', 'wardId', 'designation', 'specialization']
        .filter((field) => item[field] !== undefined)
        .map((field) => ({ field, from: null, to: item[field] })),
    });
    saveStore(store);
    return toStaffAccount(store, item);
  },

  async updateStaff(staffId, changes) {
    await simulateLatency();
    const actor = admin();
    const store = loadStore();
    const item = store.staff.find((entry) => entry.id === staffId);
    if (!item) throw notFound('Staff account');

    const details = [];
    const next = { ...changes };
    if ('name' in next) {
      next.name = (next.name ?? '').trim();
      if (!next.name) details.push({ field: 'name', message: 'Required' });
    }
    if ('departmentId' in next && !next.departmentId) details.push({ field: 'departmentId', message: 'Must be a valid ID' });
    for (const field of PROFILE_FIELDS) if (field in next) next[field] = checkProfile(field, next[field], details);
    const current = { ...item, staffType: item.staffType ?? 'staff', isActive: item.isActive !== false };
    const resultingType = next.staffType ?? current.staffType;
    if (resultingType !== 'doctor') {
      for (const field of DOCTOR_ONLY) {
        if (next[field]) details.push({ field, message: 'Only allowed for doctors (staffType "doctor")' });
        else if (current[field] && !(field in next)) next[field] = null;
      }
    }
    if (details.length) throw validation(details);
    if (next.departmentId) requireDepartment(next.departmentId);
    if (next.wardId) requireActiveWard(store, next.wardId);

    const changed = diff(current, next, Object.keys(next));
    if (changed.length) {
      for (const { field, to } of changed) {
        if (to === null) delete item[field];
        else item[field] = to;
      }
      item.updatedAt = nowIso();
      const groups = {
        staff_assignment_changed: changed.filter((change) => ['departmentId', 'wardId', 'staffType'].includes(change.field)),
        staff_profile_updated: changed.filter((change) => ['name', ...PROFILE_FIELDS].includes(change.field)),
      };
      for (const [action, list] of Object.entries(groups)) {
        if (list.length) recordAudit(store, actor, { targetType: 'staff', targetId: item.id, targetName: item.name, action, changes: list });
      }
      const status = changed.find((change) => change.field === 'isActive');
      if (status) {
        recordAudit(store, actor, {
          targetType: 'staff', targetId: item.id, targetName: item.name,
          action: status.to ? 'staff_reactivated' : 'staff_deactivated', changes: [status],
        });
      }
      saveStore(store);
    }
    return toStaffAccount(store, item);
  },

  async resetStaffPassword(staffId) {
    await simulateLatency();
    const actor = admin();
    const store = loadStore();
    const item = store.staff.find((entry) => entry.id === staffId);
    if (!item) throw notFound('Staff account');
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const temporaryPassword = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
    item.mustChangePassword = true;
    item.updatedAt = nowIso();
    recordAudit(store, actor, { targetType: 'staff', targetId: item.id, targetName: item.name, action: 'staff_password_reset' });
    saveStore(store);
    return { temporaryPassword, mustChangePassword: true };
  },

  async searchPatients({ q, page, limit } = {}) {
    await simulateLatency();
    admin();
    const search = q?.trim() ? literal(q.trim()) : null;
    const items = knownPatients()
      .filter((patient) => !search
        || patient.identifier.startsWith(search)
        || patient.name.toLowerCase().includes(search)
        || patient.id === q.trim())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((patient) => ({ id: patient.id, name: patient.name, identifier: patient.identifier, isActive: true, registeredAt: patient.registeredAt }));
    return paginate(items, { page, limit });
  },

  async getPatient(patientId) {
    await simulateLatency();
    admin();
    const patient = knownPatients().find((item) => item.id === patientId);
    if (!patient) throw notFound('Patient');
    const tokens = tokenRecords().filter((token) => token.patientKey === patientId);
    const visits = groupVisits(tokens);
    const dates = [...new Set(tokens.map((token) => token.serviceDate))].sort();
    const departmentVisits = new Map();
    for (const token of tokens) {
      const key = token.departmentId;
      departmentVisits.set(key, (departmentVisits.get(key) ?? new Set()).add(token.visitId));
    }
    return {
      id: patient.id,
      name: patient.name,
      identifier: patient.identifier,
      isActive: true,
      registeredAt: patient.registeredAt,
      visitSummary: {
        totalVisits: visits.size,
        firstVisitDate: dates[0] ?? null,
        lastVisitDate: dates.at(-1) ?? null,
        tokensIssued: tokens.length,
        consultationsCompleted: tokens.filter((token) => token.status === 'completed').length,
        activeTokens: tokens.filter((token) => ACTIVE_STATUSES.includes(token.status)).length,
        assistanceRequests: readMockAssistanceRecords().filter((request) => request.patientId === patientId).length,
        departments: [...departmentVisits.entries()]
          .map(([id, set]) => ({ id, name: departmentName(id), departmentVisits: set.size }))
          .sort((a, b) => b.departmentVisits - a.departmentVisits),
      },
    };
  },

  async listVisits({ period: input, patientId, departmentId, wardId, doctorId, status, page, limit } = {}) {
    await simulateLatency();
    admin();
    const store = loadStore();
    const period = periodOrThrow(input, { allowAll: true });
    const patients = knownPatients();
    const visits = [...groupVisits(tokenRecords().filter((token) => inPeriod(token.serviceDate, period))).entries()]
      .map(([id, tokens]) => toVisit(store, id, tokens, patients))
      .filter((visit) => !patientId || visit.patient.id === patientId)
      .filter((visit) => !departmentId || visit.departments.some((department) => department.id === departmentId))
      .filter((visit) => !wardId || visit.ward?.id === wardId)
      // The mock queue records no consultation actors, so a doctor filter matches nothing.
      .filter(() => !doctorId)
      .filter((visit) => !status || visit.status === status)
      .sort((a, b) => b.firstTokenAt.localeCompare(a.firstTokenAt) || b.id.localeCompare(a.id))
      .map(({ _tokens, _meta, ...visit }) => visit);
    return paginate(visits, { page, limit });
  },

  async getVisit(visitId) {
    await simulateLatency();
    admin();
    const store = loadStore();
    const tokens = tokenRecords().filter((token) => token.visitId === visitId);
    if (tokens.length === 0) throw notFound('Visit');
    const { _tokens, _meta, ...visit } = toVisit(store, visitId, tokens, knownPatients());
    return {
      ...visit,
      adminNote: _meta.adminNote ?? null,
      tokens: _tokens.map((token) => ({
        id: token.id,
        displayNumber: token.displayNumber,
        department: { id: token.departmentId, name: departmentName(token.departmentId) },
        status: token.status,
        issuedAt: token.createdAt,
        calledAt: null,
        completedAt: token.status === 'completed' ? token.updatedAt : null,
        consultedBy: null,
        statusHistory: [],
      })),
    };
  },

  async correctVisit(visitId, changes) {
    await simulateLatency();
    const actor = admin();
    const store = loadStore();
    if (!tokenRecords().some((token) => token.visitId === visitId)) throw notFound('Visit');
    const details = [];
    if (typeof changes.adminNote === 'string' && changes.adminNote.trim().length > 500) {
      details.push({ field: 'adminNote', message: 'Must be at most 500 characters' });
    }
    if (details.length) throw validation(details);
    if (changes.wardId) requireActiveWard(store, changes.wardId);

    const before = store.visitMeta[visitId] ?? {};
    const next = {};
    if ('wardId' in changes) next.wardId = changes.wardId || null;
    if ('adminNote' in changes) next.adminNote = changes.adminNote?.trim() || null;
    const changed = diff(before, next, Object.keys(next));
    if (changed.length) {
      const meta = { ...before };
      for (const { field, to } of changed) {
        if (to === null) delete meta[field];
        else meta[field] = to;
      }
      store.visitMeta[visitId] = meta;
      recordAudit(store, actor, { targetType: 'visit', targetId: visitId, action: 'visit_metadata_corrected', changes: changed });
      saveStore(store);
    }
    return mockAdminService.getVisit(visitId);
  },

  async listDepartments() {
    await simulateLatency();
    admin();
    const store = loadStore();
    const tokens = tokenRecords();
    return MOCK_DEPARTMENTS.map((department) => ({
      id: department.id,
      name: department.name,
      code: department.code,
      isActive: true,
      ...(department.floor ? { floor: department.floor } : {}),
      roomCount: roomsOf(department.id).length,
      activeWardCount: store.wards.filter((ward) => ward.isActive && ward.departmentId === department.id).length,
      workforce: workforce(store.staff, department.id),
      currentQueue: currentQueue(tokens, department.id),
    }));
  },

  async getDepartment(departmentId, { period: input } = {}) {
    await simulateLatency();
    admin();
    const store = loadStore();
    const department = MOCK_DEPARTMENTS.find((item) => item.id === departmentId);
    if (!department) throw notFound('Department');
    const period = periodOrThrow(input);
    const tokens = tokenRecords().filter((token) => token.departmentId === departmentId);
    const now = activity(tokens, period);
    return {
      id: department.id,
      name: department.name,
      code: department.code,
      isActive: true,
      ...(department.description ? { description: department.description } : {}),
      ...(department.floor ? { floor: department.floor } : {}),
      rooms: roomsOf(departmentId),
      wards: store.wards.filter((ward) => ward.departmentId === departmentId).map(({ id, name, code, isActive }) => ({ id, name, code, isActive })),
      workforce: workforce(store.staff, departmentId),
      activity: {
        period: { key: period.key, from: period.from, to: period.to, days: period.days },
        departmentVisits: now.visits.size,
        uniquePatients: now.visitsPerPatient.size,
        tokensIssued: now.inRange.length,
        issuedByCurrentStatus: now.byStatus,
        consultationsCompleted: now.consultations.length,
        currentQueue: currentQueue(tokens),
        assistanceRequests: assistance(period, departmentId),
      },
    };
  },

  async listWards({ departmentId, isActive, page, limit } = {}) {
    await simulateLatency();
    admin();
    const store = loadStore();
    const items = store.wards
      .filter((ward) => !departmentId || ward.departmentId === departmentId)
      .filter((ward) => isActive === undefined || ward.isActive === isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((ward) => toWard(store, ward));
    return paginate(items, { page, limit });
  },

  async getWard(wardId) {
    await simulateLatency();
    admin();
    const store = loadStore();
    const ward = store.wards.find((item) => item.id === wardId);
    if (!ward) throw notFound('Ward');
    return {
      ...toWard(store, ward),
      visitsRecorded: Object.values(store.visitMeta).filter((meta) => meta.wardId === wardId).length,
    };
  },

  async createWard(input) {
    await simulateLatency();
    const actor = admin();
    const store = loadStore();
    const details = [];
    const name = (input.name ?? '').trim();
    const code = (input.code ?? '').trim().toUpperCase();
    if (!name) details.push({ field: 'name', message: 'Required' });
    if (!/^[A-Z0-9-]{2,16}$/.test(code)) details.push({ field: 'code', message: 'Must be 2-16 characters using letters, numbers, or hyphens' });
    if (details.length) throw validation(details);
    if (input.departmentId) requireDepartment(input.departmentId);
    if (input.floorId && !MOCK_FLOOR_MAPS.some((floor) => floor.id === input.floorId)) throw notFound('Floor');
    const id = `ward_${code.toLowerCase().replaceAll('-', '_')}`;
    if (store.wards.some((ward) => ward.id === id)) throw conflict('A ward with this code already exists');

    const createdAt = nowIso();
    const ward = {
      id, name, code,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(input.floorId ? { floorId: input.floorId } : {}),
      isActive: true, createdAt, updatedAt: createdAt,
    };
    store.wards.push(ward);
    recordAudit(store, actor, {
      targetType: 'ward', targetId: id, targetName: name, action: 'ward_created',
      changes: ['name', 'code', 'departmentId', 'floorId'].filter((field) => ward[field]).map((field) => ({ field, from: null, to: ward[field] })),
    });
    saveStore(store);
    return toWard(store, ward);
  },

  async updateWard(wardId, changes) {
    await simulateLatency();
    const actor = admin();
    const store = loadStore();
    const ward = store.wards.find((item) => item.id === wardId);
    if (!ward) throw notFound('Ward');
    if ('name' in changes && !changes.name?.trim()) throw validation([{ field: 'name', message: 'Required' }]);
    if (changes.departmentId) requireDepartment(changes.departmentId);
    if (changes.floorId && !MOCK_FLOOR_MAPS.some((floor) => floor.id === changes.floorId)) throw notFound('Floor');

    const next = { ...changes, ...(changes.name ? { name: changes.name.trim() } : {}) };
    const changed = diff(ward, next, Object.keys(next));
    if (changed.length) {
      for (const { field, to } of changed) {
        if (to === null || to === '') delete ward[field];
        else ward[field] = to;
      }
      ward.updatedAt = nowIso();
      const details = changed.filter((change) => change.field !== 'isActive');
      if (details.length) recordAudit(store, actor, { targetType: 'ward', targetId: wardId, targetName: ward.name, action: 'ward_updated', changes: details });
      const status = changed.find((change) => change.field === 'isActive');
      if (status) recordAudit(store, actor, { targetType: 'ward', targetId: wardId, targetName: ward.name, action: status.to ? 'ward_reactivated' : 'ward_deactivated', changes: [status] });
      saveStore(store);
    }
    return toWard(store, ward);
  },

  async listAdminActions({ targetType, targetId, action, page, limit } = {}) {
    await simulateLatency();
    admin();
    const items = loadStore().audit
      .filter((entry) => !targetType || entry.targetType === targetType)
      .filter((entry) => !targetId || entry.targetId === targetId)
      .filter((entry) => !action || entry.action === action);
    return paginate(items, { page, limit });
  },

  async listQueueStatusChanges() {
    await simulateLatency();
    admin();
    // The mock queue does not record status-change history (see `capabilities`).
    return { items: [], meta: { page: 1, limit: 20, total: 0 } };
  },
};

function toWard(store, ward) {
  const assigned = store.staff.filter((item) => item.wardId === ward.id && item.isActive !== false);
  const floor = MOCK_FLOOR_MAPS.find((item) => item.id === ward.floorId);
  return {
    id: ward.id,
    name: ward.name,
    code: ward.code,
    ...(ward.description ? { description: ward.description } : {}),
    departmentId: ward.departmentId ?? null,
    departmentName: departmentName(ward.departmentId),
    floorId: ward.floorId ?? null,
    floorName: floor?.displayName ?? null,
    isActive: ward.isActive,
    activeAssignedStaff: {
      doctors: assigned.filter((item) => item.staffType === 'doctor').length,
      staff: assigned.filter((item) => item.staffType !== 'doctor').length,
    },
    createdAt: ward.createdAt,
    updatedAt: ward.updatedAt,
  };
}

import { ApiError, CLIENT_ERROR_CODES, api } from '../../services/apiClient';

/*
 * Admin and hospital-operations endpoints (server/ADMIN_API.md — an extension of
 * docs/API_CONTRACT.md awaiting team review). Each method returns the response `data`
 * (and `meta` for lists) after checking the fields the UI relies on; a response in an
 * unexpected shape throws INVALID_RESPONSE instead of showing guessed values.
 */

function invalid(what) {
  return new ApiError({
    code: CLIENT_ERROR_CODES.INVALID_RESPONSE,
    message: `The ${what} service returned data in an unexpected format.`,
  });
}

const isCount = (value) => Number.isInteger(value) && value >= 0;
const isText = (value) => typeof value === 'string' && value.length > 0;

function check(condition, what) {
  if (!condition) throw invalid(what);
}

function checkList(result, what, itemCheck) {
  check(Array.isArray(result.data) && result.meta && isCount(result.meta.total), what);
  check(result.data.every(itemCheck), what);
  return { items: result.data, meta: result.meta };
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

const periodParams = (period) => (period
  ? { period: period.key, ...(period.key === 'custom' ? { from: period.from, to: period.to } : {}) }
  : {});

const isStaffAccount = (item) => isText(item?.id) && isText(item.name) && item.role === 'staff' && typeof item.isActive === 'boolean';
const isVisitItem = (item) => isText(item?.id) && Array.isArray(item.departments) && isText(item.status) && item.patient;
const isWard = (item) => isText(item?.id) && isText(item.name) && isText(item.code) && typeof item.isActive === 'boolean';

function checkStatistics(data) {
  const ok = data
    && data.period && isText(data.period.from)
    && data.patients && isCount(data.patients.registeredTotal) && isCount(data.patients.uniqueVisiting)
    && data.visits && isCount(data.visits.total) && isCount(data.visits.today) && isCount(data.visits.departmentVisits)
    && data.queueTokens && isCount(data.queueTokens.issued) && isCount(data.queueTokens.currentlyWaiting)
    && isCount(data.queueTokens.currentlyActive) && isCount(data.queueTokens.consultationsCompleted)
    && data.assistanceRequests && isCount(data.assistanceRequests.currentlyOpen)
    && data.workforce?.doctors && data.workforce?.staff
    && Array.isArray(data.trend) && Array.isArray(data.byDepartment) && Array.isArray(data.byWard)
    && data.byDoctor && Array.isArray(data.byDoctor.doctors);
  check(ok, 'statistics');
  return data;
}

export const apiAdminService = {
  source: 'api',

  async getStatistics({ period, compare = true, signal } = {}) {
    const { data } = await api.get(`/admin/statistics${query({ ...periodParams(period), compare })}`, { signal });
    return checkStatistics(data);
  },

  // Staff and doctors (one resource; doctors are staffType "doctor").
  async listStaff({ staffType, departmentId, wardId, isActive, q, page, limit, signal } = {}) {
    const result = await api.get(`/admin/staff${query({ staffType, departmentId, wardId, isActive, q, page, limit })}`, { signal });
    return checkList(result, 'staff', isStaffAccount);
  },
  async getStaff(staffId, { signal } = {}) {
    const { data } = await api.get(`/admin/staff/${encodeURIComponent(staffId)}`, { signal });
    check(isStaffAccount(data), 'staff');
    return data;
  },
  async createStaff(input) {
    const { data } = await api.post('/admin/staff', input);
    check(isStaffAccount(data), 'staff');
    return data;
  },
  async updateStaff(staffId, changes) {
    const { data } = await api.patch(`/admin/staff/${encodeURIComponent(staffId)}`, changes);
    check(isStaffAccount(data), 'staff');
    return data;
  },
  async resetStaffPassword(staffId) {
    const { data } = await api.post(`/admin/staff/${encodeURIComponent(staffId)}/password-reset`, {});
    check(isText(data?.temporaryPassword), 'password reset');
    return data;
  },

  // Patients and visits.
  async searchPatients({ q, page, limit, signal } = {}) {
    const result = await api.get(`/admin/patients${query({ q, page, limit })}`, { signal });
    return checkList(result, 'patients', (item) => isText(item?.id) && isText(item.name));
  },
  async getPatient(patientId, { signal } = {}) {
    const { data } = await api.get(`/admin/patients/${encodeURIComponent(patientId)}`, { signal });
    check(isText(data?.id) && data.visitSummary && isCount(data.visitSummary.totalVisits), 'patient');
    return data;
  },
  async listVisits({ period, patientId, departmentId, wardId, doctorId, status, page, limit, signal } = {}) {
    const params = { ...periodParams(period), patientId, departmentId, wardId, doctorId, status, page, limit };
    const result = await api.get(`/admin/visits${query(params)}`, { signal });
    return checkList(result, 'visits', isVisitItem);
  },
  async getVisit(visitId, { signal } = {}) {
    const { data } = await api.get(`/admin/visits/${encodeURIComponent(visitId)}`, { signal });
    check(isVisitItem(data) && Array.isArray(data.tokens), 'visit');
    return data;
  },
  async correctVisit(visitId, changes) {
    const { data } = await api.patch(`/admin/visits/${encodeURIComponent(visitId)}`, changes);
    check(isVisitItem(data) && Array.isArray(data.tokens), 'visit');
    return data;
  },

  // Departments (read-only) and wards.
  async listDepartments({ signal } = {}) {
    const { data } = await api.get('/admin/departments', { signal });
    check(Array.isArray(data) && data.every((item) => isText(item?.id) && isText(item.name) && item.workforce && item.currentQueue), 'departments');
    return data;
  },
  async getDepartment(departmentId, { period, signal } = {}) {
    const { data } = await api.get(`/admin/departments/${encodeURIComponent(departmentId)}${query(periodParams(period))}`, { signal });
    check(isText(data?.id) && data.activity && data.workforce && Array.isArray(data.rooms) && Array.isArray(data.wards), 'department');
    return data;
  },
  async listWards({ departmentId, isActive, page, limit, signal } = {}) {
    const result = await api.get(`/admin/wards${query({ departmentId, isActive, page, limit })}`, { signal });
    return checkList(result, 'wards', isWard);
  },
  async getWard(wardId, { signal } = {}) {
    const { data } = await api.get(`/admin/wards/${encodeURIComponent(wardId)}`, { signal });
    check(isWard(data), 'ward');
    return data;
  },
  async createWard(input) {
    const { data } = await api.post('/admin/wards', input);
    check(isWard(data), 'ward');
    return data;
  },
  async updateWard(wardId, changes) {
    const { data } = await api.patch(`/admin/wards/${encodeURIComponent(wardId)}`, changes);
    check(isWard(data), 'ward');
    return data;
  },

  // Audit history.
  async listAdminActions({ targetType, targetId, actorId, action, page, limit, signal } = {}) {
    const result = await api.get(`/admin/audit/admin-actions${query({ targetType, targetId, actorId, action, page, limit })}`, { signal });
    return checkList(result, 'activity', (item) => isText(item?.id) && isText(item.action) && item.actor && isText(item.occurredAt));
  },
  async listQueueStatusChanges({ departmentId, tokenId, page, limit, signal } = {}) {
    const result = await api.get(`/admin/audit/queue-token-status-changes${query({ departmentId, tokenId, page, limit })}`, { signal });
    return checkList(result, 'queue history', (item) => isText(item?.id) && isText(item.toStatus) && isText(item.occurredAt));
  },
};

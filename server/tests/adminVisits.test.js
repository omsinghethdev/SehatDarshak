import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../src/app.js';
import { down as migrateDown, up as migrateUp } from '../src/migrations/backfillVisits.js';
import { QueueToken, statusChange } from '../src/modules/tokens/queueToken.model.js';
import { Visit, buildVisitId } from '../src/modules/visits/visit.model.js';
import { toServiceDate } from '../src/utils/dates.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';
import { CLOSED, MED, OPD, authHeaders, createUser, seedHospital } from './helpers/fixtures.js';
import { request } from './helpers/http.js';

process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';
process.env.HOSPITAL_TIMEZONE = 'Asia/Kolkata';
const timeZone = 'Asia/Kolkata';

const databaseUnavailable = await connectTestDatabase('admin_visits');
const app = createApp();

const get = (user, path) => request(app, { path, headers: authHeaders(user) });
const patch = (user, path, body) => request(app, { method: 'PATCH', path, headers: authHeaders(user), body });
const PERIOD = 'period=custom&from=2026-03-01&to=2026-03-07';

function assertError(response, status, code) {
  assert.equal(response.status, status, response.rawBody);
  assert.equal(response.body.error.code, code);
}

let sequence = 100;
// Inserts a token as the API would have created it (with its visit), or as a legacy token from
// before visits existed (`legacy: true`: no visitId, no visit record).
async function insertToken({ patient, departmentId, status, issuedAt, completedAt, consultedBy, legacy = false }) {
  sequence += 1;
  const issued = new Date(issuedAt);
  const history = [];
  if (consultedBy) {
    history.push({ ...statusChange(consultedBy, 'called', 'in_consultation', 'status_update'), occurredAt: issued });
  }
  if (status === 'completed' && consultedBy) {
    history.push({ ...statusChange(consultedBy, 'in_consultation', 'completed', 'status_update'), occurredAt: new Date(completedAt) });
  }
  const visitId = buildVisitId(toServiceDate(issued, timeZone), patient._id);
  const token = await QueueToken.create({
    displayNumber: `T-${sequence}`,
    sequence,
    patientId: patient._id,
    departmentId,
    status,
    issuedAt: issued,
    ...(completedAt ? { completedAt: new Date(completedAt) } : {}),
    ...(legacy ? {} : { visitId }),
    ...(history.length ? { statusHistory: history } : {}),
  });
  if (!legacy) {
    await Visit.updateOne(
      { _id: visitId },
      { $setOnInsert: { patientId: patient._id, serviceDate: toServiceDate(issued, timeZone), firstTokenAt: issued, source: 'token' } },
      { upsert: true },
    );
  }
  return { id: token._id, visitId };
}

describe('admin visits, patients, departments, and statistics', { skip: databaseUnavailable }, () => {
  const users = {};
  const visits = {};

  before(async () => {
    await seedHospital();
    users.admin = await createUser({ role: 'admin' });
    users.doctor = await createUser({ role: 'staff', departmentId: OPD, staffType: 'doctor', name: 'Dr. Fixture One' });
    users.nurse = await createUser({ role: 'staff', departmentId: OPD, name: 'Staff Fixture Two' });
    users.idleDoctor = await createUser({ role: 'staff', departmentId: MED, staffType: 'doctor', name: 'Dr. Fixture Idle' });
    users.p1 = await createUser({ role: 'patient', name: 'Fixture Patient Asha', identifier: 'fixture.asha' });
    users.p2 = await createUser({ role: 'patient', name: 'Fixture Patient Ravi', identifier: 'fixture.ravi' });
    users.p3 = await createUser({ role: 'patient', name: 'Fixture Patient Meena', identifier: 'fixture.meena' });

    const { doctor, nurse, p1, p2, p3 } = users;
    // P1, 2 March: OPD consultation (doctor), MED cancelled, a second OPD consultation (general staff).
    visits.p1Mar2 = (await insertToken({ patient: p1, departmentId: OPD, status: 'completed', issuedAt: '2026-03-02T10:00:00+05:30', completedAt: '2026-03-02T10:30:00+05:30', consultedBy: doctor })).visitId;
    await insertToken({ patient: p1, departmentId: MED, status: 'cancelled', issuedAt: '2026-03-02T10:05:00+05:30' });
    await insertToken({ patient: p1, departmentId: OPD, status: 'completed', issuedAt: '2026-03-02T11:00:00+05:30', completedAt: '2026-03-02T11:20:00+05:30', consultedBy: nurse });
    // P1, 5 March: skipped → a second visit that did not complete.
    visits.p1Mar5 = (await insertToken({ patient: p1, departmentId: OPD, status: 'skipped', issuedAt: '2026-03-05T09:00:00+05:30' })).visitId;
    // P2: 23:50 on 2 March and 00:10 on 3 March local time — the same UTC day (2 March), but two
    // local service dates, so two visits. Both are legacy tokens without a stored visitId, so the
    // visit must be derived in the hospital time zone, not in UTC.
    visits.p2Mar2 = (await insertToken({ patient: p2, departmentId: OPD, status: 'waiting', issuedAt: '2026-03-02T23:50:00+05:30', legacy: true })).visitId;
    visits.p2Mar3 = (await insertToken({ patient: p2, departmentId: MED, status: 'completed', issuedAt: '2026-03-03T00:10:00+05:30', completedAt: '2026-03-03T00:40:00+05:30', consultedBy: doctor, legacy: true })).visitId;
    // P3: previous period (28 Feb) and after the period (8 March).
    await insertToken({ patient: p3, departmentId: OPD, status: 'completed', issuedAt: '2026-02-28T12:00:00+05:30', completedAt: '2026-02-28T12:30:00+05:30', consultedBy: doctor });
    await insertToken({ patient: p3, departmentId: OPD, status: 'cancelled', issuedAt: '2026-03-08T12:00:00+05:30' });
  });

  after(async () => {
    await dropTestDatabase();
  });

  test('statistics separate visits, unique patients, department visits, tokens, and consultations', async () => {
    const response = await get(users.admin, `/api/admin/statistics?${PERIOD}`);
    assert.equal(response.status, 200, response.rawBody);
    const stats = response.body.data;

    assert.equal(stats.timeZone, 'Asia/Kolkata');
    assert.deepEqual(stats.period, { key: 'custom', from: '2026-03-01', to: '2026-03-07', days: 7 });
    assert.deepEqual(stats.patients, { registeredTotal: 3, registeredInPeriod: 0, uniqueVisiting: 2, repeatVisitors: 2 });
    assert.equal(stats.visits.total, 4);
    assert.equal(stats.visits.departmentVisits, 5);
    assert.equal(stats.queueTokens.issued, 6);
    assert.deepEqual(stats.queueTokens.issuedByCurrentStatus, { waiting: 1, called: 0, in_consultation: 0, completed: 3, skipped: 1, cancelled: 1 });
    assert.equal(stats.queueTokens.consultationsCompleted, 3);
    assert.equal(stats.queueTokens.currentlyWaiting, 1);

    const opd = stats.byDepartment.find((item) => item.id === OPD);
    const med = stats.byDepartment.find((item) => item.id === MED);
    assert.deepEqual(opd, { id: OPD, name: 'Demo OPD', code: 'OPD', isActive: true, departmentVisits: 3, uniquePatients: 2, tokensIssued: 4, skipped: 1, cancelled: 0, consultationsCompleted: 2, currentlyWaiting: 1 });
    assert.deepEqual(med, { id: MED, name: 'Test Medicine', code: 'MED', isActive: true, departmentVisits: 2, uniquePatients: 2, tokensIssued: 2, skipped: 0, cancelled: 1, consultationsCompleted: 1, currentlyWaiting: 0 });
    // Inactive departments without activity are not listed.
    assert.ok(!stats.byDepartment.some((item) => item.id === CLOSED));

    assert.equal(stats.trend.length, 7);
    assert.deepEqual(stats.trend.find((day) => day.date === '2026-03-02'), { date: '2026-03-02', visits: 2, uniquePatients: 2, tokensIssued: 4, consultationsCompleted: 2 });
    assert.deepEqual(stats.trend.find((day) => day.date === '2026-03-03'), { date: '2026-03-03', visits: 1, uniquePatients: 1, tokensIssued: 1, consultationsCompleted: 1 });
    assert.deepEqual(stats.trend.find((day) => day.date === '2026-03-04'), { date: '2026-03-04', visits: 0, uniquePatients: 0, tokensIssued: 0, consultationsCompleted: 0 });

    // Doctors: only consultations started by doctor accounts are attributed.
    const doctor = stats.byDoctor.doctors.find((item) => item.id === String(users.doctor._id));
    const idle = stats.byDoctor.doctors.find((item) => item.id === String(users.idleDoctor._id));
    assert.equal(doctor.consultationsCompleted, 2);
    assert.equal(doctor.departmentName, 'Demo OPD');
    assert.equal(idle.consultationsCompleted, 0);
    assert.equal(stats.byDoctor.consultationsNotAttributedToDoctor, 1);
    assert.ok(!stats.byDoctor.doctors.some((item) => item.id === String(users.nurse._id)));

    assert.deepEqual(stats.comparison.previousPeriod, { from: '2026-02-22', to: '2026-02-28', days: 7 });
    assert.deepEqual(stats.comparison.visits, { current: 4, previous: 1, change: 3, changePercent: 300 });
    assert.deepEqual(stats.comparison.consultationsCompleted, { current: 3, previous: 1, change: 2, changePercent: 200 });

    assert.deepEqual(stats.workforce, { doctors: { active: 2, inactive: 0 }, staff: { active: 1, inactive: 0 } });

    // Aggregates only: no patient names or usernames anywhere in the response.
    for (const patient of [users.p1, users.p2, users.p3]) {
      assert.ok(!response.rawBody.includes(patient.name));
      assert.ok(!response.rawBody.includes(patient.identifier));
      assert.ok(!response.rawBody.includes(String(patient._id)));
    }
  });

  test('a valid empty period returns zeros, and comparison can be turned off', async () => {
    const response = await get(users.admin, '/api/admin/statistics?period=custom&from=2025-01-01&to=2025-01-03&compare=false');
    assert.equal(response.status, 200, response.rawBody);
    const stats = response.body.data;
    assert.equal(stats.visits.total, 0);
    assert.equal(stats.visits.departmentVisits, 0);
    assert.equal(stats.patients.uniqueVisiting, 0);
    assert.equal(stats.queueTokens.issued, 0);
    assert.equal(stats.queueTokens.consultationsCompleted, 0);
    assert.deepEqual(stats.trend.map((day) => day.visits), [0, 0, 0]);
    assert.ok(stats.byDepartment.every((item) => item.departmentVisits === 0 && item.tokensIssued === 0));
    assert.deepEqual(stats.byWard, []);
    assert.equal(stats.comparison, null);
  });

  test('period validation', async () => {
    for (const query of [
      'period=yesterday',
      'period=custom',
      'period=custom&from=2026-03-01',
      'period=custom&from=2026-03-07&to=2026-03-01',
      'period=custom&from=2026-02-30&to=2026-03-01',
      'period=custom&from=2025-01-01&to=2026-03-01',
      'period=today&from=2026-03-01',
      'period=all',
      'compare=maybe',
    ]) {
      assertError(await get(users.admin, `/api/admin/statistics?${query}`), 400, 'VALIDATION_ERROR');
    }
    for (const period of ['today', 'last7Days', 'last30Days']) {
      const response = await get(users.admin, `/api/admin/statistics?period=${period}`);
      assert.equal(response.status, 200, response.rawBody);
      assert.equal(response.body.data.trend.length, { today: 1, last7Days: 7, last30Days: 30 }[period]);
    }
  });

  test('visit list: one row per encounter, newest first, with filters and pagination', async () => {
    const list = (query) => get(users.admin, `/api/admin/visits?${query}`);
    const all = await list(PERIOD);
    assert.equal(all.status, 200, all.rawBody);
    assert.deepEqual(all.body.data.map((visit) => visit.id), [visits.p1Mar5, visits.p2Mar3, visits.p2Mar2, visits.p1Mar2]);
    assert.equal(all.body.meta.total, 4);

    const p1Mar2 = all.body.data.find((visit) => visit.id === visits.p1Mar2);
    assert.equal(p1Mar2.serviceDate, '2026-03-02');
    assert.equal(p1Mar2.status, 'completed');
    assert.equal(p1Mar2.tokenCount, 3);
    assert.equal(p1Mar2.consultationsCompleted, 2);
    assert.deepEqual(p1Mar2.departments, [{ id: OPD, name: 'Demo OPD' }, { id: MED, name: 'Test Medicine' }]);
    assert.deepEqual(p1Mar2.patient, { id: String(users.p1._id), name: 'Fixture Patient Asha', identifier: 'fixture.asha' });

    const ids = async (query) => (await list(query)).body.data.map((visit) => visit.id).sort();
    assert.deepEqual(await ids(`${PERIOD}&departmentId=${MED}`), [visits.p1Mar2, visits.p2Mar3].sort());
    assert.deepEqual(await ids(`${PERIOD}&status=in_progress`), [visits.p2Mar2]);
    assert.deepEqual(await ids(`${PERIOD}&status=not_completed`), [visits.p1Mar5]);
    assert.deepEqual(await ids(`${PERIOD}&doctorId=${users.doctor._id}`), [visits.p1Mar2, visits.p2Mar3].sort());
    assert.deepEqual(await ids(`period=all&patientId=${users.p3._id}`).then((list) => list.length), 2);
    assert.deepEqual(await ids(`period=custom&from=2026-03-03&to=2026-03-03`), [visits.p2Mar3]);

    const page = await list(`${PERIOD}&limit=1&page=2`);
    assert.deepEqual(page.body.data.map((visit) => visit.id), [visits.p2Mar3]);
    assert.deepEqual(page.body.meta, { page: 2, limit: 1, total: 4 });

    const empty = await list('period=custom&from=2025-01-01&to=2025-01-02');
    assert.deepEqual(empty.body, { data: [], meta: { page: 1, limit: 20, total: 0 } });

    for (const query of ['status=done', 'patientId=xyz', 'doctorId=123', 'period=never']) {
      assertError(await list(query), 400, 'VALIDATION_ERROR');
    }
  });

  test('visit detail lists its tokens, departments, and who started each consultation', async () => {
    const response = await get(users.admin, `/api/admin/visits/${visits.p1Mar2}`);
    assert.equal(response.status, 200, response.rawBody);
    const visit = response.body.data;
    assert.equal(visit.status, 'completed');
    assert.equal(visit.tokens.length, 3);
    assert.deepEqual(visit.tokens[0].consultedBy, { id: String(users.doctor._id), name: 'Dr. Fixture One', role: 'staff', staffType: 'doctor' });
    assert.equal(visit.tokens[1].consultedBy, null);
    assert.equal(visit.tokens[1].status, 'cancelled');
    assert.equal(visit.tokens[2].consultedBy.staffType, 'staff');
    assert.equal(visit.tokens[0].statusHistory.length, 2);

    // A legacy visit (token without visitId) is found by its derived ID.
    const legacy = await get(users.admin, `/api/admin/visits/${visits.p2Mar2}`);
    assert.equal(legacy.status, 200, legacy.rawBody);
    assert.equal(legacy.body.data.status, 'in_progress');
    assert.equal(legacy.body.data.tokens.length, 1);

    assertError(await get(users.admin, `/api/admin/visits/visit_20250101_${users.p1._id}`), 404, 'NOT_FOUND');
    assertError(await get(users.admin, '/api/admin/visits/token_abc'), 404, 'NOT_FOUND');
    assertError(await get(users.admin, '/api/admin/visits/bad%20id!'), 400, 'VALIDATION_ERROR');
  });

  test('visit corrections: ward and note only, audited without the note text, reflected in reports', async () => {
    const ward = await request(app, {
      method: 'POST', path: '/api/admin/wards', headers: authHeaders(users.admin), body: { name: 'Observation Ward', code: 'OBS-1', departmentId: OPD },
    });
    assert.equal(ward.status, 201, ward.rawBody);
    const wardId = ward.body.data.id;

    for (const body of [{}, { status: 'completed' }, { patientId: String(users.p3._id) }, { adminNote: 'x'.repeat(501) }, { wardId: 'bad id!' }]) {
      assertError(await patch(users.admin, `/api/admin/visits/${visits.p2Mar2}`, body), 400, 'VALIDATION_ERROR');
    }
    assertError(await patch(users.admin, `/api/admin/visits/${visits.p2Mar2}`, { wardId: 'ward_unknown' }), 404, 'NOT_FOUND');
    assertError(await patch(users.admin, `/api/admin/visits/visit_20250101_${users.p1._id}`, { adminNote: 'x' }), 404, 'NOT_FOUND');

    const corrected = await patch(users.admin, `/api/admin/visits/${visits.p2Mar2}`, { wardId, adminNote: 'Moved for observation (administrative)' });
    assert.equal(corrected.status, 200, corrected.rawBody);
    assert.deepEqual(corrected.body.data.ward, { id: wardId, name: 'Observation Ward' });
    assert.equal(corrected.body.data.adminNote, 'Moved for observation (administrative)');
    // Tokens are untouched.
    assert.equal(corrected.body.data.tokens[0].status, 'waiting');

    // The legacy visit now has a record created by the correction.
    const record = await Visit.findById(visits.p2Mar2).select('+auditTrail').lean();
    assert.equal(record.source, 'correction');
    assert.deepEqual(record.auditTrail[0].changes, [{ field: 'wardId', from: null, to: wardId }, { field: 'adminNote' }]);

    const audit = await get(users.admin, `/api/admin/audit/admin-actions?targetType=visit&targetId=${visits.p2Mar2}`);
    assert.equal(audit.body.data.length, 1);
    assert.equal(audit.body.data[0].action, 'visit_metadata_corrected');
    assert.equal(audit.body.data[0].targetName, null);
    assert.ok(!audit.rawBody.includes('Moved for observation'));

    const stats = await get(users.admin, `/api/admin/statistics?${PERIOD}`);
    assert.deepEqual(stats.body.data.byWard, [{ id: wardId, name: 'Observation Ward', code: 'OBS-1', visits: 1 }]);
    assert.deepEqual((await get(users.admin, `/api/admin/visits?${PERIOD}&wardId=${wardId}`)).body.data.map((visit) => visit.id), [visits.p2Mar2]);

    const cleared = await patch(users.admin, `/api/admin/visits/${visits.p2Mar2}`, { adminNote: null });
    assert.equal(cleared.body.data.adminNote, null);
  });

  test('patient search and profile with a visit summary', async () => {
    const search = (q) => get(users.admin, `/api/admin/patients?q=${encodeURIComponent(q)}`);
    assert.deepEqual((await search('fixture.ra')).body.data.map((item) => item.identifier), ['fixture.ravi']);
    assert.deepEqual((await search('patient meena')).body.data.map((item) => item.identifier), ['fixture.meena']);
    assert.deepEqual((await search(String(users.p1._id))).body.data.map((item) => item.identifier), ['fixture.asha']);
    assert.equal((await search('.*')).body.meta.total, 0);
    // Only patients are searchable here.
    assert.equal((await search('Fixture One')).body.meta.total, 0);

    const profile = await get(users.admin, `/api/admin/patients/${users.p1._id}`);
    assert.equal(profile.status, 200, profile.rawBody);
    assert.equal(profile.body.data.identifier, 'fixture.asha');
    assert.ok(!('passwordHash' in profile.body.data));
    assert.deepEqual(profile.body.data.visitSummary, {
      totalVisits: 2,
      firstVisitDate: '2026-03-02',
      lastVisitDate: '2026-03-05',
      tokensIssued: 4,
      consultationsCompleted: 2,
      activeTokens: 0,
      assistanceRequests: 0,
      departments: [{ id: OPD, name: 'Demo OPD', departmentVisits: 2 }, { id: MED, name: 'Test Medicine', departmentVisits: 1 }],
    });

    assertError(await get(users.admin, `/api/admin/patients/${users.doctor._id}`), 404, 'NOT_FOUND');
    assertError(await get(users.admin, '/api/admin/patients/123'), 400, 'VALIDATION_ERROR');
  });

  test('department views include inactive departments, names, workforce, and period activity', async () => {
    const list = await get(users.admin, '/api/admin/departments');
    assert.equal(list.status, 200, list.rawBody);
    const closed = list.body.data.find((item) => item.id === CLOSED);
    assert.equal(closed.isActive, false);
    const opd = list.body.data.find((item) => item.id === OPD);
    assert.deepEqual(opd.workforce, { doctors: { active: 1, inactive: 0 }, staff: { active: 1, inactive: 0 } });
    assert.equal(opd.currentQueue.waiting, 1);

    const detail = await get(users.admin, `/api/admin/departments/${OPD}?${PERIOD}`);
    assert.equal(detail.status, 200, detail.rawBody);
    assert.equal(detail.body.data.activity.departmentVisits, 3);
    assert.equal(detail.body.data.activity.uniquePatients, 2);
    assert.equal(detail.body.data.activity.consultationsCompleted, 2);
    assert.deepEqual(detail.body.data.wards.map((ward) => ward.code), ['OBS-1']);
    assertError(await get(users.admin, '/api/admin/departments/dept_unknown'), 404, 'NOT_FOUND');
  });

  test('tokens issued through the API open one visit per patient per day across departments', async () => {
    const patient = await createUser({ role: 'patient' });
    const book = (departmentId) => request(app, { method: 'POST', path: '/api/queue-tokens', headers: authHeaders(patient), body: { departmentId } });
    assert.equal((await book(OPD)).status, 201);
    assert.equal((await book(MED)).status, 201);
    // A rejected duplicate token creates no extra visit.
    assert.equal((await book(OPD)).status, 409);

    const tokens = await QueueToken.find({ patientId: patient._id }).lean();
    assert.equal(tokens.length, 2);
    assert.equal(new Set(tokens.map((token) => token.visitId)).size, 1);
    const records = await Visit.find({ patientId: patient._id }).lean();
    assert.equal(records.length, 1);
    assert.equal(records[0].source, 'token');
    assert.equal(records[0]._id, tokens[0].visitId);

    const today = await get(users.admin, '/api/admin/statistics?period=today');
    assert.ok(today.body.data.visits.today >= 1);
    assert.ok(today.body.data.visits.total >= 1);
    // A token alone is not a consultation.
    assert.equal(today.body.data.queueTokens.consultationsCompleted, 0);
  });

  test('backfill migration links legacy tokens and is reversible without losing corrections', async () => {
    const patient = await createUser({ role: 'patient' });
    const legacy = await insertToken({ patient, departmentId: OPD, status: 'cancelled', issuedAt: '2026-01-15T09:00:00+05:30', legacy: true });
    const before = await get(users.admin, '/api/admin/visits?period=custom&from=2026-01-15&to=2026-01-15');

    const first = await migrateUp({ timeZone });
    assert.ok(first.tokensLinked >= 1);
    assert.equal((await QueueToken.findById(legacy.id).lean()).visitId, legacy.visitId);
    assert.ok(await Visit.exists({ _id: legacy.visitId, source: 'migration' }));

    const again = await migrateUp({ timeZone });
    assert.deepEqual(again, { tokensLinked: 0, visitsCreated: 0 });

    // Reports are identical before and after the migration.
    const after = await get(users.admin, '/api/admin/visits?period=custom&from=2026-01-15&to=2026-01-15');
    assert.deepEqual(after.body, before.body);

    const reverted = await migrateDown();
    assert.ok(reverted.tokensUnlinked >= 1);
    assert.equal((await QueueToken.findById(legacy.id).lean()).visitId, undefined);
    assert.equal(await Visit.exists({ _id: legacy.visitId }), null);
    // Tokens created normally keep their visit links, and corrected records are kept.
    assert.ok((await QueueToken.findOne({ visitId: visits.p1Mar2 }).lean()));
    assert.ok(await Visit.exists({ _id: visits.p2Mar2 }));
  });
});

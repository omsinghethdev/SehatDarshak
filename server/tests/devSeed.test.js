import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import { login } from '../src/modules/auth/auth.service.js';
import { Department } from '../src/modules/departments/department.model.js';
import { Floor } from '../src/modules/map/floor.model.js';
import { Room } from '../src/modules/rooms/room.model.js';
import { User } from '../src/modules/users/user.model.js';
import { demoDepartments, demoFloors, demoRooms } from '../src/seed/demoData.js';
import { devHospitalData } from '../src/seed/devDemoData.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { findEnvironmentProblems, readDevAccounts, seedDevUsers } from '../src/seed/seedDevUsers.js';
import { findHospitalDataProblems } from '../src/seed/validateHospitalData.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';

// The sign-in checks below issue access tokens, which need a signing secret (as in the other suites).
process.env.AUTH_SECRET = 'test-only-secret-that-is-at-least-32-characters';

const databaseUnavailable = await connectTestDatabase('devseed');

// Test-only placeholder passwords; never real credentials.
const safeEnv = {
  NODE_ENV: 'development',
  ALLOW_DEV_USER_SEED: 'true',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/sehatdarshak',
  DEV_PATIENT_PASSWORD: 'test-patient-pass',
  DEV_STAFF_PASSWORD: 'test-staff-pass',
  DEV_ADMIN_PASSWORD: 'test-admin-pass',
};

describe('development hospital data', () => {
  test('is consistent', () => {
    assert.deepEqual(findHospitalDataProblems(devHospitalData), []);
  });

  test('keeps every canonical fixture and its relationships', () => {
    const ids = (records) => records.map(({ _id }) => _id);
    for (const [canonical, dev] of [
      [demoFloors, devHospitalData.floors],
      [demoDepartments, devHospitalData.departments],
      [demoRooms, devHospitalData.rooms],
    ]) {
      assert.deepEqual(ids(dev).slice(0, canonical.length), ids(canonical));
    }

    assert.deepEqual(devHospitalData.floors[0], demoFloors[0]);
    assert.deepEqual(devHospitalData.rooms[0], demoRooms[0]);
    const opd = devHospitalData.departments.find(({ _id }) => _id === 'dept_demo_opd');
    assert.deepEqual(opd.roomIds.slice(0, demoDepartments[0].roomIds.length), demoDepartments[0].roomIds);
  });

  test('includes the departments the frontend staff account types refer to', () => {
    const ids = devHospitalData.departments.map(({ _id }) => _id);
    assert.ok(ids.includes('dept_demo_opd'));
    assert.ok(ids.includes('dept_demo_med'));
  });
});

describe('development user environment checks', () => {
  test('a local development environment with the opt-in flag is allowed', () => {
    assert.deepEqual(findEnvironmentProblems(safeEnv), []);
    assert.deepEqual(findEnvironmentProblems({ ...safeEnv, MONGODB_URI: 'mongodb://localhost/sd' }), []);
  });

  test('production, missing NODE_ENV, or a missing opt-in flag are refused', () => {
    assert.equal(findEnvironmentProblems({ ...safeEnv, NODE_ENV: 'production' }).length, 1);
    assert.equal(findEnvironmentProblems({ ...safeEnv, NODE_ENV: undefined }).length, 1);
    assert.equal(findEnvironmentProblems({ ...safeEnv, ALLOW_DEV_USER_SEED: undefined }).length, 1);
    assert.equal(findEnvironmentProblems({ ...safeEnv, ALLOW_DEV_USER_SEED: '1' }).length, 1);
  });

  test('remote, Atlas, mixed, or missing database URIs are refused', () => {
    for (const MONGODB_URI of [
      'mongodb+srv://user:pass@cluster0.example.mongodb.net/sehatdarshak',
      'mongodb://db.example.com:27017/sehatdarshak',
      'mongodb://127.0.0.1:27017,db.example.com:27017/sehatdarshak',
      'mongodb://localhost.example.com/sehatdarshak',
      undefined,
    ]) {
      assert.equal(findEnvironmentProblems({ ...safeEnv, MONGODB_URI }).length, 1, String(MONGODB_URI));
    }
  });
});

describe('development account settings', () => {
  test('defaults the usernames and the staff department', () => {
    const { accounts, problems } = readDevAccounts(safeEnv);
    assert.deepEqual(problems, []);
    assert.deepEqual(
      accounts.map(({ role, identifier, departmentId }) => ({ role, identifier, departmentId })),
      [
        { role: 'patient', identifier: 'demo.patient', departmentId: undefined },
        { role: 'staff', identifier: 'demo.staff', departmentId: 'dept_demo_opd' },
        { role: 'admin', identifier: 'demo.admin', departmentId: undefined },
      ],
    );
  });

  test('reports missing or weak passwords by variable name without echoing values', () => {
    const { problems } = readDevAccounts({ ...safeEnv, DEV_STAFF_PASSWORD: undefined, DEV_ADMIN_PASSWORD: 'short' });
    assert.deepEqual(problems, [
      'DEV_STAFF_PASSWORD is required',
      'DEV_ADMIN_PASSWORD: Must be at least 8 characters',
    ]);
  });

  test('rejects invalid or duplicate usernames', () => {
    assert.deepEqual(readDevAccounts({ ...safeEnv, DEV_ADMIN_USERNAME: 'x' }).problems, [
      'DEV_ADMIN_USERNAME: Must be 3-30 characters using letters, numbers, dots, hyphens, or underscores',
    ]);
    assert.equal(readDevAccounts({ ...safeEnv, DEV_ADMIN_USERNAME: 'demo.patient' }).problems.length, 1);
  });
});

describe('seeding development data', { skip: databaseUnavailable }, () => {
  beforeEach(() => Promise.all([
    Floor.deleteMany({}),
    Department.deleteMany({}),
    Room.deleteMany({}),
    User.deleteMany({}),
  ]));
  after(dropTestDatabase);

  test('loads the development hospital data repeatably', async () => {
    const counts = async () => [await Floor.countDocuments(), await Department.countDocuments(), await Room.countDocuments()];
    const expected = [devHospitalData.floors.length, devHospitalData.departments.length, devHospitalData.rooms.length];

    await seedDemoData(devHospitalData);
    assert.deepEqual(await counts(), expected);
    await seedDemoData(devHospitalData);
    assert.deepEqual(await counts(), expected);
  });

  test('creates one account per role that can sign in, with the staff department assigned', async () => {
    await seedDemoData(devHospitalData);
    const { accounts } = readDevAccounts(safeEnv);

    const results = await seedDevUsers(accounts);
    assert.deepEqual(results.map(({ outcome }) => outcome), ['created', 'created', 'created']);

    const staff = await User.findOne({ identifier: 'demo.staff' }).lean();
    assert.equal(staff.role, 'staff');
    assert.equal(staff.departmentId, 'dept_demo_opd');
    assert.equal((await User.findOne({ identifier: 'demo.admin' }).lean()).role, 'admin');
    assert.equal((await User.findOne({ identifier: 'demo.patient' }).lean()).departmentId, undefined);

    const { user } = await login({ identifier: 'demo.admin', password: 'test-admin-pass' });
    assert.equal(user.role, 'admin');
  });

  test('re-running never changes existing passwords or creates duplicates', async () => {
    await seedDemoData(devHospitalData);
    await seedDevUsers(readDevAccounts(safeEnv).accounts);

    const changed = readDevAccounts({ ...safeEnv, DEV_STAFF_PASSWORD: 'a-different-pass' }).accounts;
    const results = await seedDevUsers(changed);

    assert.deepEqual(results.map(({ outcome }) => outcome), ['unchanged', 'unchanged', 'unchanged']);
    assert.equal(await User.countDocuments(), 3);
    await login({ identifier: 'demo.staff', password: 'test-staff-pass' });
    await assert.rejects(() => login({ identifier: 'demo.staff', password: 'a-different-pass' }), { status: 401 });
  });

  test('a username already used with another role is reported and left unchanged', async () => {
    await seedDemoData(devHospitalData);
    await User.create({ name: 'Someone', identifier: 'demo.staff', passwordHash: 'scrypt$x', role: 'patient' });

    const results = await seedDevUsers(readDevAccounts(safeEnv).accounts);

    assert.deepEqual(results.find(({ role }) => role === 'staff'), {
      role: 'staff',
      identifier: 'demo.staff',
      outcome: 'conflict',
    });
    const existing = await User.findOne({ identifier: 'demo.staff' }).lean();
    assert.equal(existing.role, 'patient');
    assert.equal(existing.departmentId, undefined);
  });

  test('an unknown staff department stops before any account is created', async () => {
    await seedDemoData(devHospitalData);
    const { accounts } = readDevAccounts({ ...safeEnv, DEV_STAFF_DEPARTMENT_ID: 'dept_missing' });

    await assert.rejects(() => seedDevUsers(accounts), /dept_missing/);
    assert.equal(await User.countDocuments(), 0);
  });
});

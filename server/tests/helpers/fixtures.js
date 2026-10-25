import { User } from '../../src/modules/users/user.model.js';
import { demoDepartments, demoFloors, demoRooms } from '../../src/seed/demoData.js';
import { seedDemoData } from '../../src/seed/seedDemoData.js';
import { signAccessToken } from '../../src/utils/accessToken.js';
import { hashPassword } from '../../src/utils/password.js';
import { bearer } from './http.js';

// Fictional test fixtures only.
export const OPD = 'dept_demo_opd';
export const MED = 'dept_test_med';
export const CLOSED = 'dept_test_closed';

export async function seedHospital() {
  await seedDemoData({
    floors: demoFloors,
    departments: [
      ...demoDepartments,
      { _id: MED, name: 'Test Medicine', code: 'MED', roomIds: [] },
      { _id: CLOSED, name: 'Closed Department', code: 'CLSD', roomIds: [], isActive: false },
    ],
    rooms: demoRooms,
  });
}

// Accounts that never sign in with a password get a non-verifiable placeholder hash (faster).
export async function createUser({ role = 'patient', name, identifier, password, ...fields } = {}) {
  const suffix = Math.random().toString(36).slice(2, 10);
  return (await User.create({
    name: name ?? `Test ${role} ${suffix}`,
    identifier: identifier ?? `test.${role}.${suffix}`,
    passwordHash: password ? await hashPassword(password) : 'not-a-real-hash',
    role,
    ...fields,
  })).toObject();
}

export const authHeaders = (user) => (user ? bearer(signAccessToken({ id: user._id, role: user.role })) : {});

import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { validateRegisterInput } from '../modules/auth/auth.validation.js';
import { Department } from '../modules/departments/department.model.js';
import { User } from '../modules/users/user.model.js';
import { hashPassword } from '../utils/password.js';

// DEVELOPMENT-ONLY: creates one demo patient, one staff member, and one admin so the role-based
// flows can be tried against the real API. Staff and admin accounts cannot be registered through
// the public API, and this script adds no endpoint for it. Passwords come from environment
// variables only and are never printed. Existing users are never modified.

const duplicateKeyErrorCode = 11000;
const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

const accountDefinitions = [
  { role: 'patient', prefix: 'DEV_PATIENT', defaultUsername: 'demo.patient', name: 'Demo Patient' },
  { role: 'staff', prefix: 'DEV_STAFF', defaultUsername: 'demo.staff', name: 'Demo Staff' },
  { role: 'admin', prefix: 'DEV_ADMIN', defaultUsername: 'demo.admin', name: 'Demo Admin' },
];

function isLocalMongoUri(uri) {
  const match = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)/.exec(uri ?? '');
  if (!match) return false;

  return match[1].split(',').every((host) => localHosts.has(host.replace(/:\d+$/, '').toLowerCase()));
}

// Returns the reasons the script must not run; an empty list means it may run.
export function findEnvironmentProblems(env) {
  const problems = [];

  if (env.NODE_ENV !== 'development') {
    problems.push('NODE_ENV must be exactly "development"');
  }
  if (env.ALLOW_DEV_USER_SEED !== 'true') {
    problems.push('ALLOW_DEV_USER_SEED must be "true"');
  }
  if (!isLocalMongoUri(env.MONGODB_URI)) {
    problems.push('MONGODB_URI must be a mongodb:// URI that points only to localhost, 127.0.0.1, or [::1]');
  }

  return problems;
}

// Reads and validates the three accounts with the same rules as public registration.
// Error messages name the variable only, never its value.
export function readDevAccounts(env) {
  const problems = [];
  const accounts = [];

  for (const { role, prefix, defaultUsername, name } of accountDefinitions) {
    const usernameVariable = `${prefix}_USERNAME`;
    const passwordVariable = `${prefix}_PASSWORD`;

    if (!env[passwordVariable]) {
      problems.push(`${passwordVariable} is required`);
      continue;
    }

    try {
      const { identifier, password } = validateRegisterInput({
        name,
        identifier: env[usernameVariable] || defaultUsername,
        password: env[passwordVariable],
      });
      accounts.push({ role, name, identifier, password });
    } catch (error) {
      for (const { field, message } of error.details ?? []) {
        problems.push(`${field === 'password' ? passwordVariable : usernameVariable}: ${message}`);
      }
    }
  }

  const usernames = accounts.map(({ identifier }) => identifier);
  if (new Set(usernames).size !== usernames.length) {
    problems.push('DEV_PATIENT_USERNAME, DEV_STAFF_USERNAME, and DEV_ADMIN_USERNAME must be different');
  }

  const staff = accounts.find(({ role }) => role === 'staff');
  if (staff) {
    staff.departmentId = env.DEV_STAFF_DEPARTMENT_ID || 'dept_demo_opd';
  }

  return { accounts, problems };
}

// Creates each missing account. Returns one result per account:
// "created", "unchanged" (already exists with the expected role/department),
// or "conflict" (the username belongs to a user with another role or department; left as is).
export async function seedDevUsers(accounts) {
  const staff = accounts.find(({ role }) => role === 'staff');
  if (staff && !(await Department.exists({ _id: staff.departmentId, isActive: true }))) {
    throw new Error(`Staff department "${staff.departmentId}" does not exist or is inactive. Run "npm run seed" first.`);
  }

  await User.init();
  const results = [];

  for (const { role, name, identifier, password, departmentId } of accounts) {
    const existing = await User.findOne({ identifier }).lean();

    if (existing) {
      const matches = existing.role === role && (role !== 'staff' || existing.departmentId === departmentId);
      results.push({ role, identifier, outcome: matches ? 'unchanged' : 'conflict' });
      continue;
    }

    try {
      await User.create({
        name,
        identifier,
        passwordHash: await hashPassword(password),
        role,
        ...(role === 'staff' ? { departmentId } : {}),
      });
      results.push({ role, identifier, outcome: 'created' });
    } catch (error) {
      if (error?.code !== duplicateKeyErrorCode) throw error;
      // Created concurrently by someone else; it is not ours to change.
      results.push({ role, identifier, outcome: 'conflict' });
    }
  }

  return results;
}

const outcomeText = {
  created: 'created',
  unchanged: 'already exists; left unchanged',
  conflict: 'username is used by an account with a different role or department; left unchanged',
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const environmentProblems = findEnvironmentProblems(process.env);
  const { accounts, problems } = readDevAccounts(process.env);
  const allProblems = [...environmentProblems, ...problems];

  if (allProblems.length > 0) {
    console.error(`Refusing to create development users:\n- ${allProblems.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    try {
      await connectDatabase();
      const results = await seedDevUsers(accounts);
      for (const { role, identifier, outcome } of results) {
        console.log(`${role} "${identifier}": ${outcomeText[outcome]}`);
      }
      if (results.some(({ outcome }) => outcome === 'conflict')) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error(`Creating development users failed: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await disconnectDatabase();
    }
  }
}

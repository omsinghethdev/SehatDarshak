import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { validateRegisterInput } from '../modules/auth/auth.validation.js';
import { User } from '../modules/users/user.model.js';
import { hashPassword } from '../utils/password.js';

// One-time creation of the FIRST administrator for a fresh deployment (for example the Docker
// stack, where the localhost-only `seed:dev-users` script cannot run). It is an explicit command
// and never runs at application start. It creates an admin only while the database has no admin
// account at all, so it can never reset, replace, or add to existing administrators. Further
// staff and admin accounts are managed from the admin panel. Credentials come from environment
// variables and are never printed.

const duplicateKeyErrorCode = 11000;
const variableForField = {
  name: 'BOOTSTRAP_ADMIN_NAME',
  identifier: 'BOOTSTRAP_ADMIN_USERNAME',
  password: 'BOOTSTRAP_ADMIN_PASSWORD',
};

// Reads and validates the account with the public registration rules. Error messages name the
// variable only, never its value.
export function readBootstrapAdmin(env) {
  const problems = [];
  if (!env.BOOTSTRAP_ADMIN_USERNAME) problems.push('BOOTSTRAP_ADMIN_USERNAME is required');
  if (!env.BOOTSTRAP_ADMIN_PASSWORD) problems.push('BOOTSTRAP_ADMIN_PASSWORD is required');
  if (problems.length > 0) return { account: null, problems };

  try {
    const { name, identifier, password } = validateRegisterInput({
      name: env.BOOTSTRAP_ADMIN_NAME || 'Administrator',
      identifier: env.BOOTSTRAP_ADMIN_USERNAME,
      password: env.BOOTSTRAP_ADMIN_PASSWORD,
    });
    return { account: { name, identifier, password }, problems: [] };
  } catch (error) {
    for (const { field, message } of error.details ?? []) {
      problems.push(`${variableForField[field] ?? field}: ${message}`);
    }
    if (problems.length === 0) problems.push('The administrator details are not valid.');
    return { account: null, problems };
  }
}

/**
 * Creates the first administrator. Outcomes:
 *   "created"       — the admin was created;
 *   "adminExists"   — an admin account already exists; nothing was changed;
 *   "usernameTaken" — the username belongs to another account; nothing was changed.
 */
export async function createInitialAdmin({ name, identifier, password }) {
  await User.init();

  if (await User.exists({ role: 'admin' })) return 'adminExists';
  if (await User.exists({ identifier })) return 'usernameTaken';

  try {
    await User.create({ name, identifier, passwordHash: await hashPassword(password), role: 'admin' });
  } catch (error) {
    if (error?.code === duplicateKeyErrorCode) return 'usernameTaken';
    throw error;
  }
  return 'created';
}

const outcomeText = {
  created: (identifier) => `Administrator "${identifier}" created. Sign in and manage further accounts from the admin panel.`,
  adminExists: () => 'An administrator account already exists; nothing was changed.',
  usernameTaken: (identifier) => `The username "${identifier}" is already used by another account; nothing was changed.`,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { account, problems } = readBootstrapAdmin(process.env);

  if (problems.length > 0) {
    console.error('Initial administrator was not created:');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
  } else {
    try {
      await connectDatabase();
      const outcome = await createInitialAdmin(account);
      console.log(outcomeText[outcome](account.identifier));
      if (outcome === 'usernameTaken') process.exitCode = 1;
    } catch (error) {
      console.error(`Initial administrator was not created: ${error.message}`);
      process.exitCode = 1;
    } finally {
      await disconnectDatabase();
    }
  }
}

import { User, isActiveAccount, toPublicUser } from '../users/user.model.js';
import { auditEntry } from '../audit/auditEntry.schema.js';
import { signAccessToken } from '../../utils/accessToken.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { conflictError, forbiddenError, unauthorizedError, validationError } from '../../utils/httpError.js';
import { createFailureLimiter } from '../../utils/rateLimit.js';

const duplicateKeyErrorCode = 11000;
const invalidCredentialsMessage = 'Invalid username or password';

// Used when the username does not exist so both failure paths take similar time.
const placeholderPasswordHash = hashPassword('placeholder-password-for-timing');

// 10 wrong passwords per username and client address within 15 minutes, then 429 until the
// window ends. A successful sign-in clears the count.
const loginLimiter = createFailureLimiter({ max: 10, windowMs: 15 * 60 * 1000 });
const passwordChangeLimiter = createFailureLimiter({ max: 5, windowMs: 15 * 60 * 1000 });

function authResult(user) {
  return {
    accessToken: signAccessToken({ id: user._id, role: user.role }),
    user: toPublicUser(user),
  };
}

export async function registerPatient({ name, identifier, password, preferredLanguage }) {
  const usernameTakenError = () => conflictError('Username is already taken');

  if (await User.exists({ identifier })) {
    throw usernameTakenError();
  }

  let user;
  try {
    user = await User.create({
      name,
      identifier,
      passwordHash: await hashPassword(password),
      preferredLanguage,
      role: 'patient',
    });
  } catch (error) {
    // A concurrent registration can win the race after the existence check.
    if (error?.code === duplicateKeyErrorCode) {
      throw usernameTakenError();
    }
    throw error;
  }

  return authResult(user);
}

export async function login({ identifier, password }, { clientAddress = 'unknown' } = {}) {
  const limiterKey = `${identifier}|${clientAddress}`;
  loginLimiter.assertAllowed(limiterKey);

  const user = await User.findOne({ identifier }).select('+passwordHash');
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? await placeholderPasswordHash);

  if (!user || !passwordMatches) {
    loginLimiter.recordFailure(limiterKey);
    throw unauthorizedError(invalidCredentialsMessage);
  }

  loginLimiter.reset(limiterKey);

  // Checked only after the password is verified, so account status is never revealed to someone
  // without the password (docs/API_CONTRACT.md → Account status).
  if (!isActiveAccount(user)) {
    throw forbiddenError('This account is deactivated. Contact an administrator.');
  }

  return authResult(user);
}

// Any signed-in user can change their own password. Earlier access tokens stop working, so a
// fresh token is returned with the response.
export async function changePassword(user, { currentPassword, newPassword }) {
  const limiterKey = String(user._id);
  passwordChangeLimiter.assertAllowed(limiterKey);

  const account = await User.findById(user._id).select('+passwordHash');
  if (!account || !(await verifyPassword(currentPassword, account.passwordHash))) {
    passwordChangeLimiter.recordFailure(limiterKey);
    throw validationError('currentPassword: Incorrect password', [
      { field: 'currentPassword', message: 'Incorrect password' },
    ]);
  }
  passwordChangeLimiter.reset(limiterKey);

  if (await verifyPassword(newPassword, account.passwordHash)) {
    throw validationError('newPassword: Must be different from the current password', [
      { field: 'newPassword', message: 'Must be different from the current password' },
    ]);
  }

  // Compare-and-set on the hash that was verified, so two concurrent changes cannot both win.
  const updated = await User.findOneAndUpdate(
    { _id: account._id, passwordHash: account.passwordHash },
    {
      $set: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date() },
      $unset: { mustChangePassword: '' },
      $push: { auditTrail: auditEntry(account, 'password_changed') },
    },
    { new: true },
  );
  if (!updated) {
    throw conflictError('The password was changed by another request. Sign in again.');
  }

  return authResult(updated);
}

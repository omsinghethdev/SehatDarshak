import { User, toPublicUser } from '../users/user.model.js';
import { signAccessToken } from '../../utils/accessToken.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { conflictError, unauthorizedError } from '../../utils/httpError.js';

const duplicateKeyErrorCode = 11000;
const invalidCredentialsMessage = 'Invalid username or password';

// Used when the username does not exist so both failure paths take similar time.
const placeholderPasswordHash = hashPassword('placeholder-password-for-timing');

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

export async function login({ identifier, password }) {
  const user = await User.findOne({ identifier }).select('+passwordHash');
  const passwordMatches = await verifyPassword(password, user?.passwordHash ?? await placeholderPasswordHash);

  if (!user || !passwordMatches) {
    throw unauthorizedError(invalidCredentialsMessage);
  }

  return authResult(user);
}

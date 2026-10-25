import mongoose from 'mongoose';
import { User, isActiveAccount } from '../modules/users/user.model.js';
import { verifyAccessToken } from '../utils/accessToken.js';
import { forbiddenError, unauthorizedError } from '../utils/httpError.js';

async function findUserById(id) {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }

  return User.findById(id);
}

function readBearerToken(request) {
  const [scheme, token, ...rest] = (request.get('authorization') || '').split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) {
    return null;
  }

  return token;
}

// Verifies the Bearer JWT and loads the current user, so role and department
// always come from the database rather than from client-supplied data.
export function createAuthenticate({ loadUser = findUserById } = {}) {
  return async function authenticate(request, _response, next) {
    const token = readBearerToken(request);
    if (!token) {
      throw unauthorizedError('Authentication required');
    }

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch (_error) {
      throw unauthorizedError('Invalid or expired access token');
    }

    const user = await loadUser(claims.sub);
    if (!user) {
      throw unauthorizedError('Invalid or expired access token');
    }

    // Deactivation takes effect immediately for existing sessions (docs/API_CONTRACT.md →
    // Account status), because the user record is loaded on every request.
    if (!isActiveAccount(user)) {
      throw unauthorizedError('This account is deactivated. Contact an administrator.');
    }

    // Tokens issued before a password reset or change stop working. JWT `iat` has one-second
    // precision, so a token issued in the same second as the change is still accepted.
    if (user.passwordChangedAt && claims.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      throw unauthorizedError('Invalid or expired access token');
    }

    request.user = user;
    next();
  };
}

export const authenticate = createAuthenticate();

export function authorizeRoles(...allowedRoles) {
  return function authorize(request, _response, next) {
    if (!request.user) {
      throw unauthorizedError('Authentication required');
    }

    if (!allowedRoles.includes(request.user.role)) {
      throw forbiddenError();
    }

    next();
  };
}

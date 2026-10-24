import mongoose from 'mongoose';
import { User } from '../modules/users/user.model.js';
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

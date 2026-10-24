import jwt from 'jsonwebtoken';
import { getAuthConfig } from '../config/auth.js';

const algorithm = 'HS256';

export function signAccessToken(user, authConfig = getAuthConfig()) {
  return jwt.sign({ role: user.role }, authConfig.secret, {
    algorithm,
    subject: String(user.id),
    expiresIn: authConfig.expiresIn,
  });
}

// Throws when the token is malformed, expired, or signed with another key/algorithm.
export function verifyAccessToken(token, authConfig = getAuthConfig()) {
  return jwt.verify(token, authConfig.secret, { algorithms: [algorithm] });
}

const minimumSecretLength = 32;
const defaultTokenExpiresIn = '1h';
const exampleSecret = 'replace-with-a-long-random-secret';
const tokenLifetimePattern = /^[1-9]\d*[smhd]$/;

export class AuthConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthConfigurationError';
  }
}

export function getAuthConfig({
  secret = process.env.AUTH_SECRET,
  expiresIn = process.env.AUTH_TOKEN_EXPIRES_IN,
} = {}) {
  if (!secret) {
    throw new AuthConfigurationError('AUTH_SECRET is required to start the server.');
  }

  if (secret.length < minimumSecretLength) {
    throw new AuthConfigurationError(`AUTH_SECRET must be at least ${minimumSecretLength} characters long.`);
  }

  if (secret === exampleSecret) {
    throw new AuthConfigurationError('AUTH_SECRET is still the example value. Set a long random secret in server/.env.');
  }

  // Restricted to "<positive integer><s|m|h|d>": jsonwebtoken would otherwise read a bare
  // number string such as "3600" as milliseconds, and reject invalid values only at login.
  if (expiresIn && !tokenLifetimePattern.test(expiresIn)) {
    throw new AuthConfigurationError(
      'AUTH_TOKEN_EXPIRES_IN must be a positive whole number followed by s, m, h, or d (for example 15m or 1h).',
    );
  }

  return {
    secret,
    expiresIn: expiresIn || defaultTokenExpiresIn,
  };
}

const minimumSecretLength = 32;
const defaultTokenExpiresIn = '1h';
const exampleSecret = 'replace-with-a-long-random-secret';

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

  return {
    secret,
    expiresIn: expiresIn || defaultTokenExpiresIn,
  };
}

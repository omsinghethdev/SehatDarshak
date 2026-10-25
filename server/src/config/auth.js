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
    // Name both places: with Docker Compose the value comes from the .env next to compose.yaml,
    // and server/.env is not used, so pointing only at server/.env sends people to the wrong file.
    throw new AuthConfigurationError(
      'AUTH_SECRET is still the example value. Set a long random secret: in the .env file next to compose.yaml when using Docker Compose, or in server/.env when running the server directly.',
    );
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

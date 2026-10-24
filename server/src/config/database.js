import mongoose from 'mongoose';

export class DatabaseConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseConfigurationError';
  }
}

export class DatabaseConnectionError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'DatabaseConnectionError';
  }
}

function findErrorCode(error) {
  const visited = new Set();
  let currentError = error;

  while (currentError && !visited.has(currentError)) {
    visited.add(currentError);

    if (currentError.code) {
      return currentError.code;
    }

    currentError = currentError.cause;
  }

  for (const description of error?.reason?.servers?.values?.() ?? []) {
    const code = findErrorCode(description?.error);
    if (code) {
      return code;
    }
  }

  return undefined;
}

function connectionFailureMessage(error) {
  if (error?.name === 'MongoParseError') {
    return 'MONGODB_URI is not a valid MongoDB connection string. Check its format and URL-encode special characters in the password.';
  }

  switch (findErrorCode(error)) {
    // 18: MongoDB AuthenticationFailed; 8000: MongoDB Atlas "bad auth".
    case 18:
    case 8000:
      return 'MongoDB authentication failed. Check the database username and password in MONGODB_URI.';
    case 'ECONNREFUSED':
      return 'MongoDB connection was refused. Verify that MongoDB is running and reachable.';
    case 'ENOTFOUND':
      return 'MongoDB host could not be resolved. Verify the configured database host.';
    case 'ETIMEDOUT':
      return 'MongoDB connection timed out. Verify network access and database availability.';
    case 'EACCES':
    case 'EPERM':
      return 'Network access to MongoDB was denied by the current environment.';
    default:
      return 'Unable to connect to MongoDB. Check MONGODB_URI, database availability, and (for MongoDB Atlas) the network access list.';
  }
}

export async function connectDatabase({
  uri = process.env.MONGODB_URI,
  mongooseInstance = mongoose,
} = {}) {
  if (!uri) {
    throw new DatabaseConfigurationError('MONGODB_URI is required to start the server.');
  }

  try {
    await mongooseInstance.connect(uri);
  } catch (error) {
    throw new DatabaseConnectionError(connectionFailureMessage(error), error);
  }
}

export async function disconnectDatabase({ mongooseInstance = mongoose } = {}) {
  if (mongooseInstance.connection?.readyState === 0) {
    return;
  }

  await mongooseInstance.disconnect();
}

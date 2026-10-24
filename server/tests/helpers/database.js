import mongoose from 'mongoose';

const testServerUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017';

// Each test file gets its own "_test" database because node --test runs files in parallel.
// Returns a skip reason when MongoDB is unavailable, otherwise undefined.
export async function connectTestDatabase(name) {
  try {
    await mongoose.connect(testServerUri, {
      dbName: `sehatdarshak_${name}_test`,
      serverSelectionTimeoutMS: 2000,
    });
    return undefined;
  } catch (error) {
    return `MongoDB test database unavailable (${error.message})`;
  }
}

export async function dropTestDatabase() {
  if (!mongoose.connection.name?.endsWith('_test')) {
    throw new Error('Refusing to drop a database whose name does not end with "_test".');
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

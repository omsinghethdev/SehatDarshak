import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DatabaseConnectionError,
  connectDatabase,
} from '../src/config/database.js';
import { startServer, startupFailureMessage } from '../src/server.js';

test('database configuration fails clearly when MONGODB_URI is missing', async () => {
  let connectCalled = false;
  const mongooseInstance = {
    connect() {
      connectCalled = true;
    },
  };

  await assert.rejects(
    () => connectDatabase({ uri: '', mongooseInstance }),
    /MONGODB_URI is required/,
  );
  assert.equal(connectCalled, false);
});

test('database connection failures do not report a successful connection', async () => {
  const mongooseInstance = {
    async connect() {
      throw new Error('network unavailable');
    },
  };

  await assert.rejects(
    () => connectDatabase({ uri: 'mongodb://127.0.0.1:27017/test', mongooseInstance }),
    /Unable to connect to MongoDB/,
  );
});

test('database connection errors safely identify denied network access', async () => {
  const deniedConnection = Object.assign(new Error('permission denied'), { code: 'EPERM' });
  const mongooseInstance = {
    async connect() {
      throw deniedConnection;
    },
  };

  await assert.rejects(
    () => connectDatabase({ uri: 'mongodb://127.0.0.1:27017/test', mongooseInstance }),
    (error) => {
      assert.equal(error instanceof DatabaseConnectionError, true);
      assert.equal(error.message, 'Network access to MongoDB was denied by the current environment.');
      assert.doesNotMatch(error.message, /mongodb:\/\//i);
      return true;
    },
  );
});

test('startup error messages preserve safe database diagnostics', () => {
  const error = new DatabaseConnectionError('MongoDB connection was refused. Verify that MongoDB is running and reachable.');

  assert.equal(
    startupFailureMessage(error, 5000),
    'MongoDB connection was refused. Verify that MongoDB is running and reachable.',
  );
});

test('server does not begin listening when database connection fails', async () => {
  let listenCalled = false;
  const appInstance = {
    listen() {
      listenCalled = true;
    },
  };

  await assert.rejects(
    () => startServer({
      appInstance,
      databaseConnector: async () => {
        throw new Error('database unavailable');
      },
    }),
    /database unavailable/,
  );
  assert.equal(listenCalled, false);
});

function failingMongoose(error) {
  return {
    async connect() {
      throw error;
    },
  };
}

test('malformed connection strings are reported as a configuration problem', async () => {
  const parseError = Object.assign(new Error('Invalid scheme, expected connection string to start with "mongodb://"'), {
    name: 'MongoParseError',
  });

  await assert.rejects(
    () => connectDatabase({ uri: 'not-a-uri', mongooseInstance: failingMongoose(parseError) }),
    (error) => {
      assert.match(error.message, /MONGODB_URI is not a valid MongoDB connection string/);
      assert.doesNotMatch(error.message, /not-a-uri/);
      return true;
    },
  );
});

test('authentication failures (local code 18 and Atlas code 8000) are reported clearly', async () => {
  for (const code of [18, 8000]) {
    const authError = Object.assign(new Error('bad auth : authentication failed'), { code });

    await assert.rejects(
      () => connectDatabase({
        uri: 'mongodb+srv://user:secret@cluster0.example.mongodb.net/db',
        mongooseInstance: failingMongoose(authError),
      }),
      (error) => {
        assert.equal(error.message, 'MongoDB authentication failed. Check the database username and password in MONGODB_URI.');
        assert.doesNotMatch(error.message, /secret|user:/);
        return true;
      },
    );
  }
});

test('unclassified connection failures mention the Atlas network access list', async () => {
  await assert.rejects(
    () => connectDatabase({ uri: 'mongodb://127.0.0.1:27017/test', mongooseInstance: failingMongoose(new Error('x')) }),
    /Unable to connect to MongoDB\. .*network access list/,
  );
});

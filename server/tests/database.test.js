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

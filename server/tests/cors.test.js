import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCorsOptions } from '../src/config/cors.js';

function isAllowed(options, origin) {
  return new Promise((resolve, reject) => {
    options.origin(origin, (error, allowed) => (error ? reject(error) : resolve(allowed)));
  });
}

test('production allows only explicitly configured origins', async () => {
  const options = createCorsOptions({
    environment: 'production',
    originValue: 'https://sehat.example.app, https://admin.sehat.example.app',
  });

  assert.equal(await isAllowed(options, 'https://sehat.example.app'), true);
  assert.equal(await isAllowed(options, 'https://admin.sehat.example.app'), true);
  assert.equal(await isAllowed(options, 'https://evil.example'), false);
  assert.equal(await isAllowed(options, 'http://localhost:5173'), false);
});

test('production without CORS_ORIGIN allows no cross-origin browser requests', async () => {
  const options = createCorsOptions({ environment: 'production', originValue: undefined });

  assert.equal(await isAllowed(options, 'https://sehat.example.app'), false);
  assert.equal(await isAllowed(options, 'http://localhost:5173'), false);
});

test('a wildcard is not treated as "allow every origin"', async () => {
  const options = createCorsOptions({ environment: 'production', originValue: '*' });

  assert.equal(await isAllowed(options, 'https://evil.example'), false);
});

test('trailing slashes in configured origins still match browser Origin headers', async () => {
  const options = createCorsOptions({ environment: 'production', originValue: 'https://sehat.example.app/' });

  assert.equal(await isAllowed(options, 'https://sehat.example.app'), true);
});

test('requests without an Origin header (curl, health checks) are not blocked', async () => {
  const options = createCorsOptions({ environment: 'production', originValue: undefined });

  assert.equal(await isAllowed(options, undefined), true);
});

test('development defaults to the local Vite origin', async () => {
  const options = createCorsOptions({ environment: 'development', originValue: undefined });

  assert.equal(await isAllowed(options, 'http://localhost:5173'), true);
  assert.equal(await isAllowed(options, 'https://evil.example'), false);
});

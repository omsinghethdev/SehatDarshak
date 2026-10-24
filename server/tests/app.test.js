import assert from 'node:assert/strict';
import http from 'node:http';
import { after, test } from 'node:test';
import { createApp } from '../src/app.js';

const servers = [];

function request(app, { method = 'GET', path, headers, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', (error) => {
      if (error) {
        reject(error);
        return;
      }

      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Test server did not expose a TCP port.'));
        return;
      }

      const { port } = address;
      const requestOptions = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers,
      };

      const clientRequest = http.request(requestOptions, (response) => {
        let responseBody = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            body: JSON.parse(responseBody),
          });
        });
      });

      clientRequest.on('error', reject);
      if (body) {
        clientRequest.write(body);
      }
      clientRequest.end();
    });

    servers.push(server);
    server.on('error', reject);
  });
}

after(() => Promise.all(servers.map((server) => new Promise((resolve) => {
  server.close(resolve);
}))));

test('GET /api/health returns the service health envelope', async () => {
  const response = await request(createApp(), { path: '/api/health' });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    data: {
      service: 'sehatdarshak-api',
      status: 'ok',
    },
    message: 'Service is healthy',
  });
});

test('unknown routes return a structured not-found response', async () => {
  const response = await request(createApp(), { path: '/api/not-a-route' });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  });
});

test('malformed JSON returns a structured validation error', async () => {
  const response = await request(createApp(), {
    method: 'POST',
    path: '/api/health',
    headers: { 'content-type': 'application/json' },
    body: '{invalid-json',
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Malformed JSON request body',
    },
  });
});

test('unexpected errors return a safe internal error response', async () => {
  const app = createApp({
    registerRoutes(testApp) {
      testApp.get('/api/test-error', () => {
        throw new Error('Sensitive implementation detail');
      });
    },
  });
  const response = await request(app, { path: '/api/test-error' });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
  assert.doesNotMatch(JSON.stringify(response.body), /Sensitive implementation detail/);
});

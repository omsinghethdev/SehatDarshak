import http from 'node:http';

// Starts the app on an ephemeral port, sends one JSON request, and closes the server.
export function request(app, { method = 'GET', path, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const requestHeaders = payload
        ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload), ...headers }
        : headers;

      const clientRequest = http.request(
        { hostname: '127.0.0.1', port, path, method, headers: requestHeaders },
        (response) => {
          let responseBody = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            responseBody += chunk;
          });
          response.on('end', () => {
            server.close();
            resolve({
              status: response.statusCode,
              body: responseBody ? JSON.parse(responseBody) : undefined,
              rawBody: responseBody,
            });
          });
        },
      );

      clientRequest.on('error', (error) => {
        server.close();
        reject(error);
      });
      if (payload) {
        clientRequest.write(payload);
      }
      clientRequest.end();
    });

    server.on('error', reject);
  });
}

export const bearer = (token) => ({ authorization: `Bearer ${token}` });

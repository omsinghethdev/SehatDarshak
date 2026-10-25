import cors from 'cors';
import express from 'express';
import { createCorsOptions } from './config/cors.js';
import { getTrustProxy } from './config/proxy.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { registerApiRoutes } from './routes/index.js';

export function createApp({ registerRoutes } = {}) {
  const app = express();

  // Behind a reverse proxy (TRUST_PROXY hops), request.ip is the client's address. An invalid
  // value is reported at startup by server.js; here it falls back to trusting no proxy.
  let trustProxy = false;
  try {
    trustProxy = getTrustProxy();
  } catch {
    trustProxy = false;
  }
  app.set('trust proxy', trustProxy);

  app.use(cors(createCorsOptions()));
  app.use(express.json());

  app.get('/api/health', (_request, response) => {
    response.status(200).json({
      data: {
        service: 'sehatdarshak-api',
        status: 'ok',
      },
      message: 'Service is healthy',
    });
  });

  registerApiRoutes(app);

  if (registerRoutes) {
    registerRoutes(app);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;

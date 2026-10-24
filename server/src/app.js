import cors from 'cors';
import express from 'express';
import { createCorsOptions } from './config/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { registerApiRoutes } from './routes/index.js';

export function createApp({ registerRoutes } = {}) {
  const app = express();

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

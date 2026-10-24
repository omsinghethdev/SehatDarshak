import { authRouter } from '../modules/auth/auth.routes.js';

export function registerApiRoutes(app) {
  app.use('/api/auth', authRouter);
}

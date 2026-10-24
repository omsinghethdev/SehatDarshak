import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import { getDashboardStatistics } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, authorizeRoles('admin'));

dashboardRouter.get('/statistics', async (_request, response) => {
  response.status(200).json({ data: await getDashboardStatistics() });
});

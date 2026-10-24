import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import { listActiveTokensForPatient } from '../tokens/queueToken.service.js';

export const patientRouter = Router();

patientRouter.use(authenticate, authorizeRoles('patient'));

patientRouter.get('/me/queue-tokens/active', async (request, response) => {
  response.status(200).json({ data: await listActiveTokensForPatient(request.user) });
});

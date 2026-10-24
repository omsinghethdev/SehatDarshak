import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import { listActiveTokensForPatient } from '../tokens/queueToken.service.js';
import { toPublicUser } from '../users/user.model.js';

export const patientRouter = Router();

patientRouter.use(authenticate, authorizeRoles('patient'));

// Same safe user shape as GET /api/auth/me; the contract does not define extra profile fields.
patientRouter.get('/me', (request, response) => {
  response.status(200).json({ data: { user: toPublicUser(request.user) } });
});

patientRouter.get('/me/queue-tokens/active', async (request, response) => {
  response.status(200).json({ data: await listActiveTokensForPatient(request.user) });
});

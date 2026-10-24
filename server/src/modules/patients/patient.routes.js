import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import { parseOptionalEnumValue, parsePagination } from '../../utils/requestValidation.js';
import { terminalTokenStatuses } from '../tokens/queueToken.model.js';
import { listActiveTokensForPatient, listTokenHistoryForPatient } from '../tokens/queueToken.service.js';
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

// Token history: the patient's own completed, skipped, and cancelled tokens. The patient always
// comes from the JWT; any other query parameter (such as a patient ID) is ignored.
patientRouter.get('/me/queue-tokens', async (request, response) => {
  const status = parseOptionalEnumValue(request.query.status, 'status', terminalTokenStatuses);
  const pagination = parsePagination(request.query);

  response.status(200).json(await listTokenHistoryForPatient(request.user, { status }, pagination));
});

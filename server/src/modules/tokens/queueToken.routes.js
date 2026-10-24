import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import { parseEnumValue, parseObjectBody, parseResourceId } from '../../utils/requestValidation.js';
import { updateTokenStatus } from '../queues/queue.service.js';
import { tokenStatuses } from './queueToken.model.js';
import {
  cancelOwnQueueToken,
  createQueueToken,
  getQueueToken,
  getQueueTokenStatus,
} from './queueToken.service.js';

export const queueTokenRouter = Router();

queueTokenRouter.use(authenticate);

queueTokenRouter.post('/', authorizeRoles('patient'), async (request, response) => {
  const body = parseObjectBody(request.body, ['departmentId']);
  const departmentId = parseResourceId(body.departmentId, 'departmentId');

  const token = await createQueueToken(request.user, departmentId);
  response.status(201).json({ data: token });
});

queueTokenRouter.get('/:tokenId', async (request, response) => {
  const tokenId = parseResourceId(request.params.tokenId, 'tokenId');
  response.status(200).json({ data: await getQueueToken(request.user, tokenId) });
});

queueTokenRouter.get('/:tokenId/status', async (request, response) => {
  const tokenId = parseResourceId(request.params.tokenId, 'tokenId');
  response.status(200).json({ data: await getQueueTokenStatus(request.user, tokenId) });
});

// A patient withdraws their own waiting token. The patient comes from the JWT; the body must be
// empty (or absent), so no patient, status, or other field can be supplied by the client.
queueTokenRouter.post('/:tokenId/cancel', authorizeRoles('patient'), async (request, response) => {
  const tokenId = parseResourceId(request.params.tokenId, 'tokenId');
  parseObjectBody(request.body ?? {}, []);

  response.status(200).json({ data: await cancelOwnQueueToken(request.user, tokenId) });
});

// Apart from cancelling their own waiting token (above), patients can never change queue statuses.
queueTokenRouter.patch('/:tokenId/status', authorizeRoles('staff', 'admin'), async (request, response) => {
  const tokenId = parseResourceId(request.params.tokenId, 'tokenId');
  const body = parseObjectBody(request.body, ['status']);
  const status = parseEnumValue(body.status, 'status', tokenStatuses);

  response.status(200).json({ data: await updateTokenStatus(request.user, tokenId, status) });
});

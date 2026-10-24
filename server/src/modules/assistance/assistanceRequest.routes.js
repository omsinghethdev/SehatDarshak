import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import {
  parseObjectBody,
  parseOptionalEnumValue,
  parsePagination,
  parseRequiredText,
  parseResourceId,
} from '../../utils/requestValidation.js';
import { assistanceStatuses } from './assistanceRequest.model.js';
import {
  acknowledgeAssistanceRequest,
  createAssistanceRequest,
  listAssistanceRequests,
  listOwnAssistanceRequests,
} from './assistanceRequest.service.js';

const locationMaxLength = 200;
const messageMaxLength = 500;

export const assistanceRequestRouter = Router();

assistanceRequestRouter.use(authenticate);

assistanceRequestRouter.post('/', authorizeRoles('patient'), async (request, response) => {
  const body = parseObjectBody(request.body, ['departmentId', 'location', 'message']);
  const fields = {
    departmentId: parseResourceId(body.departmentId, 'departmentId'),
    location: parseRequiredText(body.location, 'location', locationMaxLength),
    message: parseRequiredText(body.message, 'message', messageMaxLength),
  };

  response.status(201).json({ data: await createAssistanceRequest(request.user, fields) });
});

assistanceRequestRouter.get('/me', authorizeRoles('patient'), async (request, response) => {
  const pagination = parsePagination(request.query);
  response.status(200).json(await listOwnAssistanceRequests(request.user, pagination));
});

assistanceRequestRouter.get('/', authorizeRoles('staff', 'admin'), async (request, response) => {
  const status = parseOptionalEnumValue(request.query.status, 'status', assistanceStatuses);
  const pagination = parsePagination(request.query);

  response.status(200).json(await listAssistanceRequests(request.user, { status }, pagination));
});

assistanceRequestRouter.patch('/:requestId/acknowledge', authorizeRoles('staff', 'admin'), async (request, response) => {
  const requestId = parseResourceId(request.params.requestId, 'requestId');
  parseObjectBody(request.body ?? {}, []);

  response.status(200).json({ data: await acknowledgeAssistanceRequest(request.user, requestId) });
});

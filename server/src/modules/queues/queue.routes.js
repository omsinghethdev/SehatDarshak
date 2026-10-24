import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import {
  parseObjectBody,
  parsePagination,
  parseResourceId,
} from '../../utils/requestValidation.js';
import { callNextToken, listDepartmentQueue } from './queue.service.js';

export const queueRouter = Router();

queueRouter.use(authenticate, authorizeRoles('staff', 'admin'));

queueRouter.get('/:departmentId', async (request, response) => {
  const departmentId = parseResourceId(request.params.departmentId, 'departmentId');
  const pagination = parsePagination(request.query);

  response.status(200).json(await listDepartmentQueue(request.user, departmentId, pagination));
});

queueRouter.post('/:departmentId/call-next', async (request, response) => {
  const departmentId = parseResourceId(request.params.departmentId, 'departmentId');
  parseObjectBody(request.body ?? {}, []);

  response.status(200).json({ data: await callNextToken(request.user, departmentId) });
});

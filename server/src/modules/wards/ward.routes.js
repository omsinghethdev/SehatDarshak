import { Router } from 'express';
import { parseResourceId } from '../../utils/requestValidation.js';
import {
  createWard,
  getWard,
  listWards,
  parseWardListQuery,
  updateWard,
  validateCreateWardInput,
  validateUpdateWardInput,
} from './ward.service.js';

// Mounted under /api/admin/wards; the admin router authenticates and requires the admin role.
// There is no DELETE: wards are deactivated so historical visit assignments keep their meaning.
export const wardAdminRouter = Router();

wardAdminRouter.get('/', async (request, response) => {
  response.status(200).json(await listWards(parseWardListQuery(request.query)));
});

wardAdminRouter.post('/', async (request, response) => {
  const input = validateCreateWardInput(request.body);
  response.status(201).json({ data: await createWard(request.user, input) });
});

wardAdminRouter.get('/:wardId', async (request, response) => {
  const wardId = parseResourceId(request.params.wardId, 'wardId');
  response.status(200).json({ data: await getWard(wardId) });
});

wardAdminRouter.patch('/:wardId', async (request, response) => {
  const wardId = parseResourceId(request.params.wardId, 'wardId');
  const input = validateUpdateWardInput(request.body);
  response.status(200).json({ data: await updateWard(request.user, wardId, input) });
});

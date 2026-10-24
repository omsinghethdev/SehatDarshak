import { Router } from 'express';
import { parseObjectBody, parseUserId } from '../../utils/requestValidation.js';
import { createStaff, getStaff, listStaff, resetStaffPassword, updateStaff } from './staff.service.js';
import { parseStaffListQuery, validateCreateStaffInput, validateUpdateStaffInput } from './staff.validation.js';

// Mounted under /api/admin/staff; the admin router authenticates and requires the admin role.
export const staffAdminRouter = Router();

staffAdminRouter.get('/', async (request, response) => {
  response.status(200).json(await listStaff(parseStaffListQuery(request.query)));
});

staffAdminRouter.post('/', async (request, response) => {
  const input = validateCreateStaffInput(request.body);
  response.status(201).json({ data: await createStaff(request.user, input) });
});

staffAdminRouter.get('/:staffId', async (request, response) => {
  const staffId = parseUserId(request.params.staffId, 'staffId');
  response.status(200).json({ data: await getStaff(staffId) });
});

staffAdminRouter.patch('/:staffId', async (request, response) => {
  const staffId = parseUserId(request.params.staffId, 'staffId');
  const input = validateUpdateStaffInput(request.body);
  response.status(200).json({ data: await updateStaff(request.user, staffId, input) });
});

staffAdminRouter.post('/:staffId/password-reset', async (request, response) => {
  const staffId = parseUserId(request.params.staffId, 'staffId');
  parseObjectBody(request.body ?? {}, []);

  // The temporary password must not be cached by browsers or proxies.
  response.set('Cache-Control', 'no-store');
  response.status(200).json({ data: await resetStaffPassword(request.user, staffId) });
});

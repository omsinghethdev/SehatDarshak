import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { toPublicUser } from '../users/user.model.js';
import { changePassword, login, registerPatient } from './auth.service.js';
import { validateChangePasswordInput, validateLoginInput, validateRegisterInput } from './auth.validation.js';

export const authRouter = Router();

authRouter.post('/register', async (request, response) => {
  const result = await registerPatient(validateRegisterInput(request.body));
  response.status(201).json({ data: result });
});

authRouter.post('/login', async (request, response) => {
  const result = await login(validateLoginInput(request.body), { clientAddress: request.ip });
  response.status(200).json({ data: result });
});

authRouter.get('/me', authenticate, (request, response) => {
  response.status(200).json({ data: { user: toPublicUser(request.user) } });
});

// Any signed-in user may change their own password; returns a fresh token because earlier tokens
// stop working.
authRouter.post('/change-password', authenticate, async (request, response) => {
  const result = await changePassword(request.user, validateChangePasswordInput(request.body));
  response.set('Cache-Control', 'no-store');
  response.status(200).json({ data: result });
});

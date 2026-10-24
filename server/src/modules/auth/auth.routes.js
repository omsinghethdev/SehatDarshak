import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { toPublicUser } from '../users/user.model.js';
import { login, registerPatient } from './auth.service.js';
import { validateLoginInput, validateRegisterInput } from './auth.validation.js';

export const authRouter = Router();

authRouter.post('/register', async (request, response) => {
  const result = await registerPatient(validateRegisterInput(request.body));
  response.status(201).json({ data: result });
});

authRouter.post('/login', async (request, response) => {
  const result = await login(validateLoginInput(request.body));
  response.status(200).json({ data: result });
});

authRouter.get('/me', authenticate, (request, response) => {
  response.status(200).json({ data: { user: toPublicUser(request.user) } });
});

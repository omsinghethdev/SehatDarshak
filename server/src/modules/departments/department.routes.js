import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { notFoundError } from '../../utils/httpError.js';
import { parseResourceId } from '../../utils/requestValidation.js';
import { Department, toPublicDepartment } from './department.model.js';

export const departmentRouter = Router();

departmentRouter.use(authenticate);

departmentRouter.get('/', async (_request, response) => {
  const departments = await Department.find({ isActive: true }).sort({ name: 1, _id: 1 }).lean();
  response.status(200).json({ data: departments.map(toPublicDepartment) });
});

departmentRouter.get('/:departmentId', async (request, response) => {
  const departmentId = parseResourceId(request.params.departmentId, 'departmentId');
  const department = await Department.findOne({ _id: departmentId, isActive: true }).lean();

  if (!department) {
    throw notFoundError('Department not found');
  }

  response.status(200).json({ data: toPublicDepartment(department) });
});

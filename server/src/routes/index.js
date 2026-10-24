import { authRouter } from '../modules/auth/auth.routes.js';
import { departmentRouter } from '../modules/departments/department.routes.js';
import { mapRouter } from '../modules/map/map.routes.js';
import { patientRouter } from '../modules/patients/patient.routes.js';
import { queueRouter } from '../modules/queues/queue.routes.js';
import { roomRouter } from '../modules/rooms/room.routes.js';
import { queueTokenRouter } from '../modules/tokens/queueToken.routes.js';

export function registerApiRoutes(app) {
  app.use('/api/auth', authRouter);
  app.use('/api/departments', departmentRouter);
  app.use('/api/rooms', roomRouter);
  app.use('/api/map', mapRouter);
  app.use('/api/queue-tokens', queueTokenRouter);
  app.use('/api/patients', patientRouter);
  app.use('/api/queues', queueRouter);
}

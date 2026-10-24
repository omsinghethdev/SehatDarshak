import { authRouter } from '../modules/auth/auth.routes.js';
import { departmentRouter } from '../modules/departments/department.routes.js';
import { mapRouter } from '../modules/map/map.routes.js';
import { roomRouter } from '../modules/rooms/room.routes.js';

export function registerApiRoutes(app) {
  app.use('/api/auth', authRouter);
  app.use('/api/departments', departmentRouter);
  app.use('/api/rooms', roomRouter);
  app.use('/api/map', mapRouter);
}

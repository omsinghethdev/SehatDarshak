import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { notFoundError } from '../../utils/httpError.js';
import {
  parseOptionalResourceId,
  parsePagination,
  parseResourceId,
} from '../../utils/requestValidation.js';
import { Room, toPublicRoom } from './room.model.js';

export const roomRouter = Router();

roomRouter.use(authenticate);

roomRouter.get('/', async (request, response) => {
  const floorId = parseOptionalResourceId(request.query.floor, 'floor');
  const departmentId = parseOptionalResourceId(request.query.departmentId, 'departmentId');
  const { page, limit, skip } = parsePagination(request.query);

  const filter = {
    isActive: true,
    ...(floorId ? { floorId } : {}),
    ...(departmentId ? { departmentId } : {}),
  };

  const [rooms, total] = await Promise.all([
    Room.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
    Room.countDocuments(filter),
  ]);

  response.status(200).json({
    data: rooms.map(toPublicRoom),
    meta: { page, limit, total },
  });
});

roomRouter.get('/:roomId', async (request, response) => {
  const roomId = parseResourceId(request.params.roomId, 'roomId');
  const room = await Room.findOne({ _id: roomId, isActive: true }).lean();

  if (!room) {
    throw notFoundError('Room not found');
  }

  response.status(200).json({ data: toPublicRoom(room) });
});

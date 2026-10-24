import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { notFoundError } from '../../utils/httpError.js';
import { parseResourceId } from '../../utils/requestValidation.js';
import { Room } from '../rooms/room.model.js';
import { Floor } from './floor.model.js';

export const mapRouter = Router();

mapRouter.use(authenticate);

// Map responses contain presentation/location metadata only: no patient or queue data.
function toFloorSummary(floor) {
  return {
    id: floor._id,
    displayName: floor.displayName,
    width: floor.width,
    height: floor.height,
    coordinateOrigin: 'top-left',
    coordinateUnit: 'map-unit',
  };
}

function toMapLocation(room) {
  const { x, y, width, height } = room.mapPosition;

  return {
    id: room._id,
    displayName: room.name,
    roomType: room.type,
    departmentId: room.departmentId ?? null,
    x,
    y,
    width,
    height,
  };
}

mapRouter.get('/floors', async (_request, response) => {
  const floors = await Floor.find({ isActive: true }).sort({ level: 1, _id: 1 }).lean();
  response.status(200).json({ data: floors.map(toFloorSummary) });
});

mapRouter.get('/floors/:floorId', async (request, response) => {
  const floorId = parseResourceId(request.params.floorId, 'floorId');
  const floor = await Floor.findOne({ _id: floorId, isActive: true }).lean();

  if (!floor) {
    throw notFoundError('Floor not found');
  }

  const rooms = await Room.find({ floorId, isActive: true })
    .select('name type departmentId mapPosition')
    .sort({ name: 1, _id: 1 })
    .lean();

  response.status(200).json({
    data: {
      ...toFloorSummary(floor),
      locations: rooms.map(toMapLocation),
    },
  });
});

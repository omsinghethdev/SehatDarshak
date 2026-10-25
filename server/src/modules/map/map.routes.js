import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { notFoundError, validationError } from '../../utils/httpError.js';
import { parseOptionalEnumValue, parseResourceId } from '../../utils/requestValidation.js';
import {
  getDepartmentDestination,
  getFloorWalkways,
  getRoute,
  listDestinations,
} from '../navigation/navigation.service.js';
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

// ---------------------------------------------------------------------------------------------
// Indoor directions over the walkable graph (modules/navigation). Hospital layout data only:
// no patient, token, or queue information is read or returned.

const queryMaxLength = 60;

function parseOptionalQuery(value) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.trim().length > queryMaxLength) {
    throw validationError(`q: Must be text of at most ${queryMaxLength} characters`, [
      { field: 'q', message: `Must be text of at most ${queryMaxLength} characters` },
    ]);
  }
  return value.trim();
}

// Corridors, graph nodes, and same-floor edges of one floor, for drawing walkways.
mapRouter.get('/floors/:floorId/walkways', async (request, response) => {
  const floorId = parseResourceId(request.params.floorId, 'floorId');
  response.status(200).json({ data: await getFloorWalkways(floorId) });
});

// Rooms that can be used as a start or destination, optionally filtered by ?q=.
mapRouter.get('/destinations', async (request, response) => {
  const query = parseOptionalQuery(request.query.q);
  response.status(200).json({ data: await listDestinations({ query }) });
});

// The room a department's directions lead to; `destination` is null if none is mapped.
mapRouter.get('/departments/:departmentId/destination', async (request, response) => {
  const departmentId = parseResourceId(request.params.departmentId, 'departmentId');
  response.status(200).json({ data: await getDepartmentDestination(departmentId) });
});

// Walking route between two rooms: GET /api/map/route?from=&to=&avoidStairs=true|false
mapRouter.get('/route', async (request, response) => {
  const from = parseResourceId(request.query.from, 'from');
  const to = parseResourceId(request.query.to, 'to');
  const avoidStairs = parseOptionalEnumValue(request.query.avoidStairs, 'avoidStairs', ['true', 'false']) === 'true';

  response.status(200).json({ data: await getRoute({ from, to, avoidStairs }) });
});

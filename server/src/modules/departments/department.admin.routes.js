import { Router } from 'express';
import { getHospitalTimeZone } from '../../config/hospital.js';
import { Room } from '../rooms/room.model.js';
import { QueueToken, activeTokenStatuses } from '../tokens/queueToken.model.js';
import { User } from '../users/user.model.js';
import { Ward } from '../wards/ward.model.js';
import { getDepartmentActivity, workforceCounts } from '../reports/statistics.service.js';
import { parseReportPeriod } from '../../utils/dates.js';
import { notFoundError } from '../../utils/httpError.js';
import { parseResourceId } from '../../utils/requestValidation.js';
import { Department } from './department.model.js';

/*
 * Read-only admin views of departments with operational status. Departments themselves stay
 * read-only (create/edit/delete is out of scope in docs/API_CONTRACT.md), so department, room,
 * and floor IDs and the map are never changed here. Staff are assigned to departments through
 * PATCH /api/admin/staff/:staffId.
 */
export const departmentAdminRouter = Router();

const zero = () => Object.fromEntries(activeTokenStatuses.map((status) => [status, 0]));

departmentAdminRouter.get('/', async (_request, response) => {
  const [departments, rooms, wards, staff, queue] = await Promise.all([
    Department.find().sort({ name: 1, _id: 1 }).lean(),
    Room.aggregate([{ $match: { isActive: { $ne: false }, departmentId: { $exists: true } } }, { $group: { _id: '$departmentId', count: { $sum: 1 } } }]),
    Ward.aggregate([{ $match: { isActive: { $ne: false }, departmentId: { $exists: true } } }, { $group: { _id: '$departmentId', count: { $sum: 1 } } }]),
    User.aggregate([
      { $match: { role: 'staff' } },
      {
        $group: {
          _id: { departmentId: '$departmentId', doctor: { $eq: ['$staffType', 'doctor'] }, inactive: { $eq: ['$isActive', false] } },
          count: { $sum: 1 },
        },
      },
    ]),
    QueueToken.aggregate([
      { $match: { status: { $in: activeTokenStatuses } } },
      { $group: { _id: { departmentId: '$departmentId', status: '$status' }, count: { $sum: 1 } } },
    ]),
  ]);

  const roomCounts = new Map(rooms.map((item) => [item._id, item.count]));
  const wardCounts = new Map(wards.map((item) => [item._id, item.count]));
  const workforce = new Map();
  for (const { _id: { departmentId, doctor, inactive }, count } of staff) {
    if (!workforce.has(departmentId)) workforce.set(departmentId, { doctors: { active: 0, inactive: 0 }, staff: { active: 0, inactive: 0 } });
    workforce.get(departmentId)[doctor ? 'doctors' : 'staff'][inactive ? 'inactive' : 'active'] += count;
  }
  const queues = new Map();
  for (const { _id: { departmentId, status }, count } of queue) {
    if (!queues.has(departmentId)) queues.set(departmentId, zero());
    queues.get(departmentId)[status] = count;
  }

  response.status(200).json({
    data: departments.map((department) => ({
      id: department._id,
      name: department.name,
      code: department.code,
      isActive: department.isActive !== false,
      ...(department.floor ? { floor: department.floor } : {}),
      roomCount: roomCounts.get(department._id) ?? 0,
      activeWardCount: wardCounts.get(department._id) ?? 0,
      workforce: workforce.get(department._id) ?? { doctors: { active: 0, inactive: 0 }, staff: { active: 0, inactive: 0 } },
      currentQueue: queues.get(department._id) ?? zero(),
    })),
  });
});

departmentAdminRouter.get('/:departmentId', async (request, response) => {
  const departmentId = parseResourceId(request.params.departmentId, 'departmentId');
  const period = parseReportPeriod(request.query, { timeZone: getHospitalTimeZone(), defaultPeriod: 'last7Days' });

  const department = await Department.findById(departmentId).lean();
  if (!department) {
    throw notFoundError('Department not found');
  }

  const [rooms, wards, workforce, activity] = await Promise.all([
    Room.find({ departmentId }).select('name roomNumber floorId type isActive').sort({ name: 1, _id: 1 }).lean(),
    Ward.find({ departmentId }).select('name code isActive').sort({ name: 1, _id: 1 }).lean(),
    workforceCounts(departmentId),
    getDepartmentActivity(departmentId, period),
  ]);

  response.status(200).json({
    data: {
      id: department._id,
      name: department.name,
      code: department.code,
      isActive: department.isActive !== false,
      ...(department.description ? { description: department.description } : {}),
      ...(department.floor ? { floor: department.floor } : {}),
      rooms: rooms.map((room) => ({
        id: room._id,
        name: room.name,
        ...(room.roomNumber ? { roomNumber: room.roomNumber } : {}),
        floorId: room.floorId,
        type: room.type,
        isActive: room.isActive !== false,
      })),
      wards: wards.map((ward) => ({ id: ward._id, name: ward.name, code: ward.code, isActive: ward.isActive !== false })),
      workforce,
      activity,
    },
  });
});

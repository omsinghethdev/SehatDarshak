import { isValidResourceId } from '../utils/requestValidation.js';

const isPositiveNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const isNonNegativeNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function checkIds(records, label, problems) {
  const seen = new Set();
  for (const { _id } of records) {
    if (!isValidResourceId(_id)) {
      problems.push(`${label} ID "${_id}" is not a valid resource ID`);
    }
    if (seen.has(_id)) {
      problems.push(`${label} ID "${_id}" is duplicated`);
    }
    seen.add(_id);
  }
}

function checkRoomPlacement(room, floor, problems) {
  const { x, y, width, height } = room.mapPosition ?? {};

  if (![x, y].every(isNonNegativeNumber) || ![width, height].every(isPositiveNumber)) {
    problems.push(`Room "${room._id}" needs non-negative x/y and positive width/height`);
    return;
  }

  if (x + width > floor.width || y + height > floor.height) {
    problems.push(`Room "${room._id}" extends outside floor "${floor._id}" (${floor.width} x ${floor.height})`);
  }
}

// Checks the floor/department/room relationships that the map and room APIs rely on.
// Returns a list of problems; an empty list means the data set is consistent.
export function findHospitalDataProblems({ floors, departments, rooms }) {
  const problems = [];

  checkIds(floors, 'Floor', problems);
  checkIds(departments, 'Department', problems);
  checkIds(rooms, 'Room', problems);

  const floorsById = new Map(floors.map((floor) => [floor._id, floor]));
  const departmentsById = new Map(departments.map((department) => [department._id, department]));
  const roomsById = new Map(rooms.map((room) => [room._id, room]));

  for (const floor of floors) {
    if (![floor.width, floor.height].every(isPositiveNumber)) {
      problems.push(`Floor "${floor._id}" needs a positive width and height`);
    }
  }

  const codes = new Set();
  for (const department of departments) {
    if (codes.has(department.code)) {
      problems.push(`Department code "${department.code}" is duplicated`);
    }
    codes.add(department.code);

    if (department.floor && !floorsById.has(department.floor)) {
      problems.push(`Department "${department._id}" references unknown floor "${department.floor}"`);
    }

    for (const roomId of department.roomIds ?? []) {
      const room = roomsById.get(roomId);
      if (!room) {
        problems.push(`Department "${department._id}" lists unknown room "${roomId}"`);
      } else if (room.departmentId && room.departmentId !== department._id) {
        problems.push(`Department "${department._id}" lists room "${roomId}" that belongs to "${room.departmentId}"`);
      }
    }
  }

  for (const room of rooms) {
    const floor = floorsById.get(room.floorId);
    if (!floor) {
      problems.push(`Room "${room._id}" references unknown floor "${room.floorId}"`);
    } else {
      checkRoomPlacement(room, floor, problems);
    }

    if (room.departmentId) {
      const department = departmentsById.get(room.departmentId);
      if (!department) {
        problems.push(`Room "${room._id}" references unknown department "${room.departmentId}"`);
      } else if (!(department.roomIds ?? []).includes(room._id)) {
        problems.push(`Room "${room._id}" is not listed in roomIds of department "${room.departmentId}"`);
      }
    }
  }

  return problems;
}

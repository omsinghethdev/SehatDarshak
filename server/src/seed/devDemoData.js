// Fictional development/demo data that `npm run seed` loads on top of the canonical fixtures in
// demoData.js. It mirrors the frontend mocks (client/src/features/departments/mockDepartments.js
// and client/src/features/navigation/mockFloorMaps.js) so the real API returns the same IDs,
// names, and map coordinates the UI was built against. Canonical records keep their IDs; the
// only change to one is that dept_demo_opd also lists its two consultation rooms.

import { demoDepartments, demoFloors, demoRooms } from './demoData.js';

const extraFloors = [
  { _id: 'floor_demo_first', displayName: 'First Floor', width: 1000, height: 700, level: 1 },
  // Deliberately has no rooms, so the map's "no locations on this floor" state can be checked.
  { _id: 'floor_demo_second', displayName: 'Second Floor', width: 1000, height: 700, level: 2 },
];

const extraDepartments = [
  {
    _id: 'dept_demo_med',
    name: 'General Medicine',
    code: 'MED',
    description: 'Fever, infections, diabetes, blood pressure, and other adult health concerns.',
    floor: 'floor_ground',
    roomIds: ['room_demo_med_1'],
  },
  {
    _id: 'dept_demo_ped',
    name: 'Paediatrics',
    code: 'PED',
    description: 'Outpatient care for children.',
    floor: 'floor_demo_first',
    roomIds: ['room_demo_ped_1'],
  },
  {
    _id: 'dept_demo_ort',
    name: 'Orthopaedics',
    code: 'ORT',
    description: 'Bone, joint, and muscle problems.',
    floor: 'floor_demo_first',
    roomIds: ['room_demo_ort_1', 'room_demo_ort_xray'],
  },
];

function room(_id, name, floorId, type, departmentId, x, y, width, height) {
  return {
    _id,
    name,
    floorId,
    type,
    ...(departmentId ? { departmentId } : {}),
    mapPosition: { x, y, width, height },
  };
}

const extraRooms = [
  room('room_demo_opd_1', 'OPD Consultation Room 1', 'floor_ground', 'consultation', 'dept_demo_opd', 320, 120, 160, 120),
  room('room_demo_opd_2', 'OPD Consultation Room 2', 'floor_ground', 'consultation', 'dept_demo_opd', 500, 120, 160, 120),
  room('room_demo_pharmacy', 'Pharmacy', 'floor_ground', 'facility', null, 720, 120, 200, 120),
  room('room_demo_washroom_g', 'Accessible Washroom', 'floor_ground', 'facility', null, 80, 300, 180, 100),
  room('room_demo_waiting_g', 'Main Waiting Area', 'floor_ground', 'facility', null, 320, 300, 340, 140),
  room('room_demo_lab', 'Sample Collection', 'floor_ground', 'diagnostic', null, 720, 300, 200, 140),
  room('room_demo_med_1', 'General Medicine Room', 'floor_ground', 'consultation', 'dept_demo_med', 80, 470, 180, 140),
  room('room_demo_lift_g', 'Lift', 'floor_ground', 'facility', null, 440, 480, 120, 90),
  room('room_demo_xray', 'X-ray Room', 'floor_ground', 'diagnostic', null, 720, 480, 200, 130),
  room('room_demo_entrance', 'Main Entrance', 'floor_ground', 'facility', null, 400, 610, 200, 70),
  room('room_demo_ped_1', 'Paediatrics Consultation Room', 'floor_demo_first', 'consultation', 'dept_demo_ped', 80, 120, 220, 140),
  room('room_demo_ped_waiting', 'Children’s Waiting Area', 'floor_demo_first', 'facility', null, 80, 300, 220, 160),
  room('room_demo_waiting_1', 'Waiting Area', 'floor_demo_first', 'facility', null, 340, 120, 320, 200),
  room('room_demo_ort_1', 'Orthopaedics Consultation Room', 'floor_demo_first', 'consultation', 'dept_demo_ort', 700, 120, 220, 140),
  room('room_demo_ort_xray', 'Orthopaedic X-ray', 'floor_demo_first', 'diagnostic', 'dept_demo_ort', 700, 300, 220, 140),
  room('room_demo_lift_1', 'Lift', 'floor_demo_first', 'facility', null, 440, 480, 120, 90),
  room('room_demo_washroom_1', 'Accessible Washroom', 'floor_demo_first', 'facility', null, 700, 480, 220, 100),
];

const opdConsultationRoomIds = ['room_demo_opd_1', 'room_demo_opd_2'];

export const devHospitalData = Object.freeze({
  floors: [...demoFloors, ...extraFloors],
  departments: [
    ...demoDepartments.map((department) =>
      department._id === 'dept_demo_opd'
        ? { ...department, roomIds: [...department.roomIds, ...opdConsultationRoomIds] }
        : department,
    ),
    ...extraDepartments,
  ],
  rooms: [...demoRooms, ...extraRooms],
});

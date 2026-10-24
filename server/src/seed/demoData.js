// Canonical fictional fixtures from docs/SHARED_INTEGRATION_CONTRACT.md section 6.
// Frontend mocks keep a separate copy; IDs, labels, and coordinates must stay in sync.

export const demoFloors = [
  { _id: 'floor_ground', displayName: 'Ground Floor', width: 1000, height: 700, level: 0 },
];

export const demoDepartments = [
  {
    _id: 'dept_demo_opd',
    name: 'Demo OPD',
    code: 'OPD',
    floor: 'floor_ground',
    roomIds: ['room_registration'],
  },
];

export const demoRooms = [
  {
    _id: 'room_registration',
    name: 'Registration Desk',
    floorId: 'floor_ground',
    type: 'facility',
    mapPosition: { x: 80, y: 120, width: 180, height: 100 },
  },
];

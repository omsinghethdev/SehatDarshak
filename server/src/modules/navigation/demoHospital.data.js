/*
 * SehatDarshak Demo Hospital — a FICTIONAL floor plan for development and demonstration.
 * It is not the layout of any real hospital and must never be presented as one.
 *
 * SHARED FILE: server/src/modules/navigation/demoHospital.data.js and
 * client/src/features/navigation/demoHospital.data.js must stay byte-for-byte identical
 * (server/tests/navigationShared.test.js checks this). Edit one, then copy it to the other.
 *
 * Coordinates use each floor's top-left-origin map units (x right, y down), the same system as
 * GET /api/map/floors/:floorId. Every floor is 1000 × 700 units.
 *
 * Walkable areas are an explicit graph:
 *   nodes     — `door` nodes sit on a room's boundary (one per navigable room); `junction` nodes
 *               sit on a corridor's centre line.
 *   edges     — the only walkable connections. `door` edges join a door to its corridor
 *               junction; `corridor` edges join junctions along a corridor; `lift` and `stairs`
 *               edges join lift/stair doors on different floors. Nothing else is connected:
 *               two points are never linked just because their coordinates line up.
 *   corridors — the drawn corridor areas; every corridor edge runs inside them.
 * The seed validator (server/src/seed/validateHospitalData.js) checks all of this.
 *
 * Distances are not measured from a real building: `metresPerMapUnit` sets a demo scale, and
 * walking speeds and lift times are planning assumptions, so any time shown is an estimate.
 * Step-free access is not modelled or verified; "avoid stairs" only skips stair edges.
 */

const floorGround = 'floor_ground';
const floorFirst = 'floor_demo_first';
const floorSecond = 'floor_demo_second';

function room(id, name, floorId, type, departmentId, x, y, width, height) {
  return { id, name, floorId, type, departmentId, x, y, width, height };
}

function door(roomId, floorId, x, y, extra = {}) {
  return { id: `door_${roomId}`, floorId, x, y, kind: 'door', roomId, ...extra };
}

function junction(id, floorId, x, y) {
  return { id, floorId, x, y, kind: 'junction' };
}

function edge(from, to, kind, extra = {}) {
  return { from, to, kind, ...extra };
}

export const DEMO_HOSPITAL = Object.freeze({
  id: 'navgraph_demo_hospital',
  name: 'SehatDarshak Demo Hospital (fictional)',

  routing: {
    // Demo scale: 20 map units = 1 metre, so a floor is 50 m × 35 m.
    metresPerMapUnit: 0.05,
    // Planning assumptions for time estimates, not measurements.
    walkingMetresPerSecond: 1,
    stairsMetresPerSecond: 0.5,
  },

  floors: [
    { id: floorGround, displayName: 'Ground Floor', level: 0, width: 1000, height: 700 },
    { id: floorFirst, displayName: 'First Floor', level: 1, width: 1000, height: 700 },
    { id: floorSecond, displayName: 'Second Floor', level: 2, width: 1000, height: 700 },
  ],

  // roomIds lists consultation rooms first: a department's first navigable room is where
  // "navigate to department" leads. Demo OPD keeps the canonical Registration Desk first in
  // roomIds, but that room has no departmentId, so it is never used as OPD's destination.
  departments: [
    {
      id: 'dept_demo_opd',
      name: 'Demo OPD',
      code: 'OPD',
      description: 'General outpatient consultations.',
      floor: floorGround,
      roomIds: ['room_registration', 'room_demo_opd_1', 'room_demo_opd_2'],
    },
    {
      id: 'dept_demo_med',
      name: 'General Medicine',
      code: 'MED',
      description: 'Fever, infections, diabetes, blood pressure, and other adult health concerns.',
      floor: floorGround,
      roomIds: ['room_demo_med_1'],
    },
    {
      id: 'dept_demo_rad',
      name: 'Radiology',
      code: 'RAD',
      description: 'X-ray and ultrasound imaging.',
      floor: floorGround,
      roomIds: ['room_demo_xray', 'room_demo_rad_us'],
    },
    {
      id: 'dept_demo_card',
      name: 'Cardiology',
      code: 'CAR',
      description: 'Heart and blood-vessel conditions.',
      floor: floorFirst,
      roomIds: ['room_demo_card_1', 'room_demo_card_ecg'],
    },
    {
      id: 'dept_demo_ped',
      name: 'Paediatrics',
      code: 'PED',
      description: 'Outpatient care for children.',
      floor: floorFirst,
      roomIds: ['room_demo_ped_1', 'room_demo_ped_vacc'],
    },
    {
      id: 'dept_demo_neu',
      name: 'Neurology',
      code: 'NEU',
      description: 'Headaches, seizures, and other brain and nerve problems.',
      floor: floorSecond,
      roomIds: ['room_demo_neu_1', 'room_demo_neu_eeg'],
    },
    {
      id: 'dept_demo_ort',
      name: 'Orthopaedics',
      code: 'ORT',
      description: 'Bone, joint, and muscle problems.',
      floor: floorSecond,
      roomIds: ['room_demo_ort_1', 'room_demo_ort_xray', 'room_demo_ort_plaster'],
    },
  ],

  rooms: [
    // Ground floor. Rooms north of the main corridor (y 260–300) end at y = 260; rooms to the
    // south start at y = 300. The south spine corridor (x 480–520) leads to the entrance.
    room('room_registration', 'Registration Desk', floorGround, 'facility', null, 80, 120, 180, 100),
    room('room_demo_opd_1', 'OPD Consultation Room 1', floorGround, 'consultation', 'dept_demo_opd', 300, 60, 160, 200),
    room('room_demo_opd_2', 'OPD Consultation Room 2', floorGround, 'consultation', 'dept_demo_opd', 480, 60, 160, 200),
    room('room_demo_pharmacy', 'Pharmacy', floorGround, 'facility', null, 660, 60, 160, 200),
    room('room_demo_rad_us', 'Ultrasound Room', floorGround, 'diagnostic', 'dept_demo_rad', 840, 60, 120, 200),
    room('room_demo_waiting_g', 'Main Waiting Area', floorGround, 'facility', null, 60, 300, 220, 320),
    room('room_demo_med_1', 'General Medicine Room', floorGround, 'consultation', 'dept_demo_med', 300, 320, 180, 130),
    room('room_demo_washroom_g', 'Accessible Washroom', floorGround, 'facility', null, 300, 470, 180, 110),
    room('room_demo_lab', 'Laboratory (Sample Collection)', floorGround, 'diagnostic', null, 520, 320, 200, 130),
    room('room_demo_xray', 'X-ray Room', floorGround, 'diagnostic', 'dept_demo_rad', 520, 470, 200, 60),
    room('room_demo_reception', 'Reception & Help Desk', floorGround, 'facility', null, 520, 550, 160, 70),
    room('room_demo_lift_g', 'Lift', floorGround, 'facility', null, 760, 300, 90, 80),
    room('room_demo_stairs_g', 'Stairs', floorGround, 'facility', null, 870, 300, 90, 80),
    room('room_demo_entrance', 'Main Entrance', floorGround, 'facility', null, 420, 620, 160, 50),

    // First floor: same corridor, lift, and stair positions as the ground floor.
    room('room_demo_card_1', 'Cardiology Consultation Room', floorFirst, 'consultation', 'dept_demo_card', 60, 60, 220, 200),
    room('room_demo_card_ecg', 'ECG Room', floorFirst, 'diagnostic', 'dept_demo_card', 300, 60, 160, 200),
    room('room_demo_waiting_1', 'Waiting Area', floorFirst, 'facility', null, 480, 60, 180, 200),
    room('room_demo_washroom_1', 'Accessible Washroom', floorFirst, 'facility', null, 680, 60, 140, 200),
    room('room_demo_ped_1', 'Paediatrics Consultation Room', floorFirst, 'consultation', 'dept_demo_ped', 60, 300, 220, 180),
    room('room_demo_ped_waiting', 'Children’s Waiting Area', floorFirst, 'facility', null, 300, 320, 180, 160),
    room('room_demo_ped_vacc', 'Vaccination Room', floorFirst, 'consultation', 'dept_demo_ped', 520, 320, 200, 160),
    room('room_demo_lift_1', 'Lift', floorFirst, 'facility', null, 760, 300, 90, 80),
    room('room_demo_stairs_1', 'Stairs', floorFirst, 'facility', null, 870, 300, 90, 80),

    // Second floor: same layout as the first floor.
    room('room_demo_neu_1', 'Neurology Consultation Room', floorSecond, 'consultation', 'dept_demo_neu', 60, 60, 220, 200),
    room('room_demo_neu_eeg', 'EEG Room', floorSecond, 'diagnostic', 'dept_demo_neu', 300, 60, 160, 200),
    room('room_demo_waiting_2', 'Waiting Area', floorSecond, 'facility', null, 480, 60, 180, 200),
    room('room_demo_washroom_2', 'Accessible Washroom', floorSecond, 'facility', null, 680, 60, 140, 200),
    room('room_demo_ort_1', 'Orthopaedics Consultation Room', floorSecond, 'consultation', 'dept_demo_ort', 60, 300, 220, 180),
    room('room_demo_ort_xray', 'Orthopaedic X-ray', floorSecond, 'diagnostic', 'dept_demo_ort', 300, 320, 180, 160),
    room('room_demo_ort_plaster', 'Plaster Room', floorSecond, 'consultation', 'dept_demo_ort', 520, 320, 200, 160),
    room('room_demo_lift_2', 'Lift', floorSecond, 'facility', null, 760, 300, 90, 80),
    room('room_demo_stairs_2', 'Stairs', floorSecond, 'facility', null, 870, 300, 90, 80),
  ],

  corridors: [
    { id: 'corridor_g_main', floorId: floorGround, x: 60, y: 260, width: 880, height: 40 },
    { id: 'corridor_g_spine', floorId: floorGround, x: 480, y: 300, width: 40, height: 320 },
    { id: 'corridor_1_main', floorId: floorFirst, x: 60, y: 260, width: 880, height: 40 },
    { id: 'corridor_1_spine', floorId: floorFirst, x: 480, y: 300, width: 40, height: 200 },
    { id: 'corridor_2_main', floorId: floorSecond, x: 60, y: 260, width: 880, height: 40 },
    { id: 'corridor_2_spine', floorId: floorSecond, x: 480, y: 300, width: 40, height: 200 },
  ],

  nodes: [
    // Ground floor junctions: main corridor centre line y = 280, spine centre line x = 500.
    junction('junction_g_170', floorGround, 170, 280),
    junction('junction_g_380', floorGround, 380, 280),
    junction('junction_g_500', floorGround, 500, 280),
    junction('junction_g_560', floorGround, 560, 280),
    junction('junction_g_740', floorGround, 740, 280),
    junction('junction_g_805', floorGround, 805, 280),
    junction('junction_g_860', floorGround, 860, 280),
    junction('junction_g_915', floorGround, 915, 280),
    junction('junction_g_s385', floorGround, 500, 385),
    junction('junction_g_s500', floorGround, 500, 500),
    junction('junction_g_s585', floorGround, 500, 585),
    // Ground floor doors.
    door('room_registration', floorGround, 170, 220),
    door('room_demo_opd_1', floorGround, 380, 260),
    door('room_demo_opd_2', floorGround, 560, 260),
    door('room_demo_pharmacy', floorGround, 740, 260),
    door('room_demo_rad_us', floorGround, 860, 260),
    door('room_demo_waiting_g', floorGround, 170, 300),
    door('room_demo_med_1', floorGround, 480, 385),
    door('room_demo_washroom_g', floorGround, 480, 500),
    door('room_demo_lab', floorGround, 520, 385),
    door('room_demo_xray', floorGround, 520, 500),
    door('room_demo_reception', floorGround, 520, 585),
    door('room_demo_lift_g', floorGround, 805, 300, { transition: 'lift' }),
    door('room_demo_stairs_g', floorGround, 915, 300, { transition: 'stairs' }),
    door('room_demo_entrance', floorGround, 500, 620, { entrance: true }),

    // First floor.
    junction('junction_1_170', floorFirst, 170, 280),
    junction('junction_1_380', floorFirst, 380, 280),
    junction('junction_1_500', floorFirst, 500, 280),
    junction('junction_1_570', floorFirst, 570, 280),
    junction('junction_1_750', floorFirst, 750, 280),
    junction('junction_1_805', floorFirst, 805, 280),
    junction('junction_1_915', floorFirst, 915, 280),
    junction('junction_1_s400', floorFirst, 500, 400),
    door('room_demo_card_1', floorFirst, 170, 260),
    door('room_demo_card_ecg', floorFirst, 380, 260),
    door('room_demo_waiting_1', floorFirst, 570, 260),
    door('room_demo_washroom_1', floorFirst, 750, 260),
    door('room_demo_ped_1', floorFirst, 170, 300),
    door('room_demo_ped_waiting', floorFirst, 480, 400),
    door('room_demo_ped_vacc', floorFirst, 520, 400),
    door('room_demo_lift_1', floorFirst, 805, 300, { transition: 'lift' }),
    door('room_demo_stairs_1', floorFirst, 915, 300, { transition: 'stairs' }),

    // Second floor.
    junction('junction_2_170', floorSecond, 170, 280),
    junction('junction_2_380', floorSecond, 380, 280),
    junction('junction_2_500', floorSecond, 500, 280),
    junction('junction_2_570', floorSecond, 570, 280),
    junction('junction_2_750', floorSecond, 750, 280),
    junction('junction_2_805', floorSecond, 805, 280),
    junction('junction_2_915', floorSecond, 915, 280),
    junction('junction_2_s400', floorSecond, 500, 400),
    door('room_demo_neu_1', floorSecond, 170, 260),
    door('room_demo_neu_eeg', floorSecond, 380, 260),
    door('room_demo_waiting_2', floorSecond, 570, 260),
    door('room_demo_washroom_2', floorSecond, 750, 260),
    door('room_demo_ort_1', floorSecond, 170, 300),
    door('room_demo_ort_xray', floorSecond, 480, 400),
    door('room_demo_ort_plaster', floorSecond, 520, 400),
    door('room_demo_lift_2', floorSecond, 805, 300, { transition: 'lift' }),
    door('room_demo_stairs_2', floorSecond, 915, 300, { transition: 'stairs' }),
  ],

  edges: [
    // Ground floor: main corridor, west to east.
    edge('junction_g_170', 'junction_g_380', 'corridor'),
    edge('junction_g_380', 'junction_g_500', 'corridor'),
    edge('junction_g_500', 'junction_g_560', 'corridor'),
    edge('junction_g_560', 'junction_g_740', 'corridor'),
    edge('junction_g_740', 'junction_g_805', 'corridor'),
    edge('junction_g_805', 'junction_g_860', 'corridor'),
    edge('junction_g_860', 'junction_g_915', 'corridor'),
    // Ground floor: spine corridor, north to south.
    edge('junction_g_500', 'junction_g_s385', 'corridor'),
    edge('junction_g_s385', 'junction_g_s500', 'corridor'),
    edge('junction_g_s500', 'junction_g_s585', 'corridor'),
    // Ground floor doors.
    edge('door_room_registration', 'junction_g_170', 'door'),
    edge('door_room_demo_waiting_g', 'junction_g_170', 'door'),
    edge('door_room_demo_opd_1', 'junction_g_380', 'door'),
    edge('door_room_demo_opd_2', 'junction_g_560', 'door'),
    edge('door_room_demo_pharmacy', 'junction_g_740', 'door'),
    edge('door_room_demo_lift_g', 'junction_g_805', 'door'),
    edge('door_room_demo_rad_us', 'junction_g_860', 'door'),
    edge('door_room_demo_stairs_g', 'junction_g_915', 'door'),
    edge('door_room_demo_med_1', 'junction_g_s385', 'door'),
    edge('door_room_demo_lab', 'junction_g_s385', 'door'),
    edge('door_room_demo_washroom_g', 'junction_g_s500', 'door'),
    edge('door_room_demo_xray', 'junction_g_s500', 'door'),
    edge('door_room_demo_reception', 'junction_g_s585', 'door'),
    edge('door_room_demo_entrance', 'junction_g_s585', 'door'),

    // First floor.
    edge('junction_1_170', 'junction_1_380', 'corridor'),
    edge('junction_1_380', 'junction_1_500', 'corridor'),
    edge('junction_1_500', 'junction_1_570', 'corridor'),
    edge('junction_1_570', 'junction_1_750', 'corridor'),
    edge('junction_1_750', 'junction_1_805', 'corridor'),
    edge('junction_1_805', 'junction_1_915', 'corridor'),
    edge('junction_1_500', 'junction_1_s400', 'corridor'),
    edge('door_room_demo_card_1', 'junction_1_170', 'door'),
    edge('door_room_demo_ped_1', 'junction_1_170', 'door'),
    edge('door_room_demo_card_ecg', 'junction_1_380', 'door'),
    edge('door_room_demo_waiting_1', 'junction_1_570', 'door'),
    edge('door_room_demo_washroom_1', 'junction_1_750', 'door'),
    edge('door_room_demo_lift_1', 'junction_1_805', 'door'),
    edge('door_room_demo_stairs_1', 'junction_1_915', 'door'),
    edge('door_room_demo_ped_waiting', 'junction_1_s400', 'door'),
    edge('door_room_demo_ped_vacc', 'junction_1_s400', 'door'),

    // Second floor.
    edge('junction_2_170', 'junction_2_380', 'corridor'),
    edge('junction_2_380', 'junction_2_500', 'corridor'),
    edge('junction_2_500', 'junction_2_570', 'corridor'),
    edge('junction_2_570', 'junction_2_750', 'corridor'),
    edge('junction_2_750', 'junction_2_805', 'corridor'),
    edge('junction_2_805', 'junction_2_915', 'corridor'),
    edge('junction_2_500', 'junction_2_s400', 'corridor'),
    edge('door_room_demo_neu_1', 'junction_2_170', 'door'),
    edge('door_room_demo_ort_1', 'junction_2_170', 'door'),
    edge('door_room_demo_neu_eeg', 'junction_2_380', 'door'),
    edge('door_room_demo_waiting_2', 'junction_2_570', 'door'),
    edge('door_room_demo_washroom_2', 'junction_2_750', 'door'),
    edge('door_room_demo_lift_2', 'junction_2_805', 'door'),
    edge('door_room_demo_stairs_2', 'junction_2_915', 'door'),
    edge('door_room_demo_ort_xray', 'junction_2_s400', 'door'),
    edge('door_room_demo_ort_plaster', 'junction_2_s400', 'door'),

    // Between floors: only these explicit lift and stair connections exist. The lift serves
    // every floor (time includes an assumed wait); each flight of stairs links adjacent floors.
    edge('door_room_demo_lift_g', 'door_room_demo_lift_1', 'lift', { seconds: 45 }),
    edge('door_room_demo_lift_1', 'door_room_demo_lift_2', 'lift', { seconds: 45 }),
    edge('door_room_demo_lift_g', 'door_room_demo_lift_2', 'lift', { seconds: 50 }),
    edge('door_room_demo_stairs_g', 'door_room_demo_stairs_1', 'stairs', { metres: 8 }),
    edge('door_room_demo_stairs_1', 'door_room_demo_stairs_2', 'stairs', { metres: 8 }),
  ],
});

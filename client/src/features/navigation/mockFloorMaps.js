/*
 * DEVELOPMENT-ONLY fictional floor maps, shaped like GET /api/map/floors/:floorId
 * (docs/API_CONTRACT.md → Basic 2D floor-map response).
 *
 * Canonical fixtures (docs/SHARED_INTEGRATION_CONTRACT.md §6): `floor_ground` (1000 × 700)
 * and `room_registration` at (80, 120, 180, 100). Everything else is a small set of extra
 * fictional locations (`room_demo_*`) added to demonstrate the layout; they are not real
 * hospital locations and are not part of the shared fixture set.
 *
 * The contract only documents the `facility` roomType; `consultation` and `diagnostic`
 * are mock values pending a team decision on the roomType vocabulary.
 */

const MAP_META = { width: 1000, height: 700, coordinateOrigin: 'top-left', coordinateUnit: 'map-unit' };

function location(id, displayName, roomType, departmentId, x, y, width, height) {
  return { id, displayName, roomType, departmentId, x, y, width, height };
}

export const MOCK_FLOOR_MAPS = Object.freeze([
  {
    id: 'floor_ground',
    displayName: 'Ground Floor',
    ...MAP_META,
    locations: [
      location('room_registration', 'Registration Desk', 'facility', null, 80, 120, 180, 100),
      location('room_demo_opd_1', 'OPD Consultation Room 1', 'consultation', 'dept_demo_opd', 320, 120, 160, 120),
      location('room_demo_opd_2', 'OPD Consultation Room 2', 'consultation', 'dept_demo_opd', 500, 120, 160, 120),
      location('room_demo_pharmacy', 'Pharmacy', 'facility', null, 720, 120, 200, 120),
      location('room_demo_washroom_g', 'Accessible Washroom', 'facility', null, 80, 300, 180, 100),
      location('room_demo_waiting_g', 'Main Waiting Area', 'facility', null, 320, 300, 340, 140),
      location('room_demo_lab', 'Sample Collection', 'diagnostic', null, 720, 300, 200, 140),
      location('room_demo_med_1', 'General Medicine Room', 'consultation', 'dept_demo_med', 80, 470, 180, 140),
      location('room_demo_lift_g', 'Lift', 'facility', null, 440, 480, 120, 90),
      location('room_demo_xray', 'X-ray Room', 'diagnostic', null, 720, 480, 200, 130),
      location('room_demo_entrance', 'Main Entrance', 'facility', null, 400, 610, 200, 70),
    ],
  },
  {
    id: 'floor_demo_first',
    displayName: 'First Floor',
    ...MAP_META,
    locations: [
      location('room_demo_ped_1', 'Paediatrics Consultation Room', 'consultation', 'dept_demo_ped', 80, 120, 220, 140),
      location('room_demo_ped_waiting', 'Children’s Waiting Area', 'facility', null, 80, 300, 220, 160),
      location('room_demo_waiting_1', 'Waiting Area', 'facility', null, 340, 120, 320, 200),
      location('room_demo_ort_1', 'Orthopaedics Consultation Room', 'consultation', 'dept_demo_ort', 700, 120, 220, 140),
      location('room_demo_ort_xray', 'Orthopaedic X-ray', 'diagnostic', 'dept_demo_ort', 700, 300, 220, 140),
      location('room_demo_lift_1', 'Lift', 'facility', null, 440, 480, 120, 90),
      location('room_demo_washroom_1', 'Accessible Washroom', 'facility', null, 700, 480, 220, 100),
    ],
  },
  {
    // Deliberately unmapped, to show how the UI handles a floor without location data.
    id: 'floor_demo_second',
    displayName: 'Second Floor',
    ...MAP_META,
    locations: [],
  },
]);

/*
 * DEVELOPMENT-ONLY fictional department fixtures.
 *
 * `dept_demo_opd` is the canonical demo department (docs/SHARED_INTEGRATION_CONTRACT.md §6).
 * The other entries are extra fictional departments so selection can be demonstrated; they
 * are not part of the shared fixture set and the backend seed may not include them.
 *
 * Public fields match the Department model: id, name, code, description?, floor?, roomIds?.
 * `simulatedQueueLength` is mock-only (never part of an API response): it seeds how many
 * fictional patients are ahead when a new token is booked.
 */
export const MOCK_DEPARTMENTS = Object.freeze([
  {
    id: 'dept_demo_opd',
    name: 'Demo OPD',
    code: 'OPD',
    description: 'General outpatient consultations.',
    floor: 'floor_ground',
    roomIds: ['room_registration'],
    simulatedQueueLength: 4,
  },
  {
    id: 'dept_demo_med',
    name: 'General Medicine',
    code: 'MED',
    description: 'Fever, infections, diabetes, blood pressure, and other adult health concerns.',
    simulatedQueueLength: 6,
  },
  {
    id: 'dept_demo_ped',
    name: 'Paediatrics',
    code: 'PED',
    description: 'Outpatient care for children.',
    simulatedQueueLength: 3,
  },
  {
    id: 'dept_demo_ort',
    name: 'Orthopaedics',
    code: 'ORT',
    description: 'Bone, joint, and muscle problems.',
    simulatedQueueLength: 5,
  },
]);

export function toPublicDepartment({ simulatedQueueLength: _internal, ...department }) {
  return department;
}

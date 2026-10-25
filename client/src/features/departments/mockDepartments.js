import { DEMO_HOSPITAL } from '../navigation/demoHospital.data';

/*
 * DEVELOPMENT-ONLY fictional departments of the "SehatDarshak Demo Hospital"
 * (features/navigation/demoHospital.data.js, shared with the server seed).
 * `dept_demo_opd` is the canonical demo department (docs/SHARED_INTEGRATION_CONTRACT.md §6).
 *
 * Public fields match the Department model: id, name, code, description?, floor?, roomIds?.
 * `simulatedQueueLength` is mock-only (never part of an API response): it seeds how many
 * fictional patients are ahead when a new token is booked.
 */
const SIMULATED_QUEUE_LENGTHS = {
  dept_demo_opd: 4,
  dept_demo_med: 6,
  dept_demo_rad: 2,
  dept_demo_card: 4,
  dept_demo_ped: 3,
  dept_demo_neu: 2,
  dept_demo_ort: 5,
};

export const MOCK_DEPARTMENTS = Object.freeze(
  DEMO_HOSPITAL.departments.map((department) => ({
    ...department,
    roomIds: [...department.roomIds],
    simulatedQueueLength: SIMULATED_QUEUE_LENGTHS[department.id] ?? 3,
  })),
);

export function toPublicDepartment({ simulatedQueueLength: _internal, ...department }) {
  return department;
}

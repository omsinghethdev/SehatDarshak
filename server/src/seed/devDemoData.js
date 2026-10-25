// Fictional development/demo data that `npm run seed` loads: the "SehatDarshak Demo Hospital"
// (modules/navigation/demoHospital.data.js), converted to the database shape. The same data
// file is shared with the frontend mocks, so the real API and mock mode show the same hospital.
//
// The canonical fixtures in demoData.js stay first and unchanged (Ground Floor, Demo OPD, and
// the Registration Desk at its contract coordinates); the demo hospital is built around them.
// Every room that earlier versions of this file seeded keeps its ID, so re-seeding an existing
// database updates those rooms in place instead of leaving stale copies behind.

import { DEMO_HOSPITAL } from '../modules/navigation/demoHospital.data.js';

const toFloor = ({ id, displayName, width, height, level }) => ({ _id: id, displayName, width, height, level });

const toDepartment = ({ id, name, code, description, floor, roomIds }) => ({
  _id: id,
  name,
  code,
  ...(description ? { description } : {}),
  ...(floor ? { floor } : {}),
  roomIds: [...roomIds],
});

const toRoom = ({ id, name, floorId, type, departmentId, x, y, width, height }) => ({
  _id: id,
  name,
  floorId,
  type,
  ...(departmentId ? { departmentId } : {}),
  mapPosition: { x, y, width, height },
});

const toNavigationGraph = ({ id, name, routing, corridors, nodes, edges }) => ({
  _id: id,
  name,
  routing: { ...routing },
  corridors: corridors.map((corridor) => ({ ...corridor })),
  nodes: nodes.map((node) => ({ ...node })),
  edges: edges.map((edge) => ({ ...edge })),
});

export const devHospitalData = Object.freeze({
  floors: DEMO_HOSPITAL.floors.map(toFloor),
  departments: DEMO_HOSPITAL.departments.map(toDepartment),
  rooms: DEMO_HOSPITAL.rooms.map(toRoom),
  navigationGraphs: [toNavigationGraph(DEMO_HOSPITAL)],
});

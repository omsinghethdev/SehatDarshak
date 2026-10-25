import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Department } from '../modules/departments/department.model.js';
import { Floor } from '../modules/map/floor.model.js';
import { NavigationGraph } from '../modules/navigation/navigationGraph.model.js';
import { Room } from '../modules/rooms/room.model.js';
import { demoDepartments, demoFloors, demoRooms } from './demoData.js';
import { devHospitalData } from './devDemoData.js';
import { findHospitalDataProblems } from './validateHospitalData.js';

const managedPaths = new Set(['_id', '__v', 'createdAt', 'updatedAt']);

// Upserts each fixture by its stable ID and resets it to the fixture values: fields the
// fixture omits are unset and the record is re-activated. Other records are never touched.
async function upsertAll(Model, documents) {
  const optionalPaths = Object.keys(Model.schema.paths).filter((path) => !managedPaths.has(path));

  for (const { _id, ...fields } of documents) {
    const values = { isActive: true, ...fields };
    const unset = Object.fromEntries(
      optionalPaths.filter((path) => !(path in values)).map((path) => [path, '']),
    );

    await Model.updateOne(
      { _id },
      { $set: values, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
      { upsert: true, runValidators: true },
    );
  }
}

export async function seedDemoData({
  floors = demoFloors,
  departments = demoDepartments,
  rooms = demoRooms,
  navigationGraphs = [],
} = {}) {
  const problems = findHospitalDataProblems({ floors, departments, rooms, navigationGraphs });
  if (problems.length > 0) {
    throw new Error(`Demo data is inconsistent: ${problems.join('; ')}`);
  }

  // Make sure unique indexes (e.g. Department.code) exist before writing.
  await Promise.all([Floor.init(), Department.init(), Room.init(), NavigationGraph.init()]);

  await upsertAll(Floor, floors);
  await upsertAll(Department, departments);
  await upsertAll(Room, rooms);
  await upsertAll(NavigationGraph, navigationGraphs);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await connectDatabase();
    // The CLI loads the canonical fixtures plus the fictional development data that matches the UI.
    await seedDemoData(devHospitalData);
    const { floors, departments, rooms, navigationGraphs } = devHospitalData;
    const [graph] = navigationGraphs;
    console.log(
      `Seeded ${floors.length} floor(s), ${departments.length} department(s), ${rooms.length} room(s), ` +
        `and a walking graph (${graph.nodes.length} nodes, ${graph.edges.length} edges) for the fictional demo hospital.`,
    );
  } catch (error) {
    console.error(`Seeding failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

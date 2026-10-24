import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoDepartments, demoFloors, demoRooms } from '../src/seed/demoData.js';
import { findHospitalDataProblems } from '../src/seed/validateHospitalData.js';

const demoData = { floors: demoFloors, departments: demoDepartments, rooms: demoRooms };

// Builds a variant of the demo data with one collection replaced.
const withChanges = (changes) => structuredClone({ ...demoData, ...changes });

test('canonical demo data matches the shared integration contract fixtures', () => {
  assert.deepEqual(demoFloors, [
    { _id: 'floor_ground', displayName: 'Ground Floor', width: 1000, height: 700, level: 0 },
  ]);
  assert.deepEqual(demoDepartments.map(({ _id, name, code }) => ({ _id, name, code })), [
    { _id: 'dept_demo_opd', name: 'Demo OPD', code: 'OPD' },
  ]);
  assert.deepEqual(demoRooms.map(({ _id, name, type, floorId, mapPosition }) => ({ _id, name, type, floorId, mapPosition })), [
    {
      _id: 'room_registration',
      name: 'Registration Desk',
      type: 'facility',
      floorId: 'floor_ground',
      mapPosition: { x: 80, y: 120, width: 180, height: 100 },
    },
  ]);
});

test('canonical demo data has consistent relationships and coordinates', () => {
  assert.deepEqual(findHospitalDataProblems(demoData), []);
});

test('detects rooms on unknown floors or outside floor bounds', () => {
  const [room] = demoRooms;
  const problems = findHospitalDataProblems(withChanges({
    rooms: [
      { ...room, _id: 'room_lost', floorId: 'floor_missing' },
      { ...room, _id: 'room_wide', mapPosition: { x: 900, y: 120, width: 180, height: 100 } },
      { ...room, _id: 'room_tall', mapPosition: { x: 80, y: 650, width: 180, height: 100 } },
      { ...room, _id: 'room_flat', mapPosition: { x: 80, y: 120, width: 0, height: 100 } },
      { ...room, _id: 'room_negative', mapPosition: { x: -1, y: 120, width: 10, height: 10 } },
      room,
    ],
  }));

  assert.equal(problems.length, 5, problems.join('\n'));
  assert.match(problems.join('\n'), /room_lost.*unknown floor/);
  assert.match(problems.join('\n'), /room_wide.*outside floor/);
  assert.match(problems.join('\n'), /room_tall.*outside floor/);
  assert.match(problems.join('\n'), /room_flat.*positive width\/height/);
  assert.match(problems.join('\n'), /room_negative.*non-negative x\/y/);
});

test('detects broken department-room relationships', () => {
  const [department] = demoDepartments;
  const [room] = demoRooms;
  const problems = findHospitalDataProblems(withChanges({
    departments: [
      { ...department, roomIds: ['room_registration', 'room_missing'] },
      { _id: 'dept_other', name: 'Other', code: 'OTH', floor: 'floor_unknown', roomIds: ['room_owned'] },
    ],
    rooms: [
      room,
      { ...room, _id: 'room_owned', departmentId: 'dept_demo_opd', mapPosition: { x: 0, y: 0, width: 10, height: 10 } },
      { ...room, _id: 'room_orphan', departmentId: 'dept_missing', mapPosition: { x: 0, y: 0, width: 10, height: 10 } },
    ],
  }));
  const report = problems.join('\n');

  assert.match(report, /dept_demo_opd.*unknown room "room_missing"/);
  assert.match(report, /dept_other.*unknown floor "floor_unknown"/);
  assert.match(report, /dept_other.*room "room_owned" that belongs to "dept_demo_opd"/);
  assert.match(report, /room_owned.*not listed in roomIds of department "dept_demo_opd"/);
  assert.match(report, /room_orphan.*unknown department "dept_missing"/);
});

test('detects duplicate or unfetchable IDs and duplicate department codes', () => {
  const [floor] = demoFloors;
  const [department] = demoDepartments;
  const problems = findHospitalDataProblems(withChanges({
    floors: [floor, { ...floor }, { ...floor, _id: 'floor.bad' }],
    departments: [department, { ...department, _id: 'dept_copy', roomIds: [] }],
  }));
  const report = problems.join('\n');

  assert.match(report, /Floor ID "floor_ground" is duplicated/);
  assert.match(report, /Floor ID "floor.bad" is not a valid resource ID/);
  assert.match(report, /Department code "OPD" is duplicated/);
});

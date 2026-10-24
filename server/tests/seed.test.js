import assert from 'node:assert/strict';
import { after, beforeEach, describe, test } from 'node:test';
import mongoose from 'mongoose';
import { Department } from '../src/modules/departments/department.model.js';
import { Floor } from '../src/modules/map/floor.model.js';
import { Room } from '../src/modules/rooms/room.model.js';
import { demoDepartments, demoFloors, demoRooms } from '../src/seed/demoData.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { connectTestDatabase, dropTestDatabase } from './helpers/database.js';

const databaseUnavailable = await connectTestDatabase('seed');

const countAll = async () => ({
  floors: await Floor.countDocuments(),
  departments: await Department.countDocuments(),
  rooms: await Room.countDocuments(),
});

describe('seedDemoData', { skip: databaseUnavailable }, () => {
  beforeEach(() => Promise.all([Floor.deleteMany({}), Department.deleteMany({}), Room.deleteMany({})]));
  after(dropTestDatabase);

  test('creates the canonical demo records', async () => {
    await seedDemoData();

    assert.deepEqual(await countAll(), {
      floors: demoFloors.length,
      departments: demoDepartments.length,
      rooms: demoRooms.length,
    });
    const room = await Room.findById('room_registration').lean();
    assert.deepEqual(room.mapPosition, { x: 80, y: 120, width: 180, height: 100 });
    assert.equal(room.isActive, true);
  });

  test('running repeatedly does not create duplicates or change creation timestamps', async () => {
    await seedDemoData();
    const before = await countAll();
    const { createdAt } = await Department.findById('dept_demo_opd').lean();

    await seedDemoData();
    await seedDemoData();

    assert.deepEqual(await countAll(), before);
    assert.deepEqual((await Department.findById('dept_demo_opd').lean()).createdAt, createdAt);
  });

  test('re-seeding leaves unrelated records untouched', async () => {
    await seedDemoData();
    await Floor.create({ _id: 'floor_custom', displayName: 'Custom Floor', width: 300, height: 200, level: 4 });
    await Department.create({ _id: 'dept_custom', name: 'Custom Dept', code: 'CUST', isActive: false });
    await Room.create({
      _id: 'room_custom',
      name: 'Custom Room',
      floorId: 'floor_custom',
      type: 'facility',
      mapPosition: { x: 1, y: 1, width: 5, height: 5 },
    });
    await mongoose.connection.collection('users').insertOne({ identifier: 'unrelated.user' });

    await seedDemoData();

    assert.deepEqual(await countAll(), { floors: 2, departments: 2, rooms: 2 });
    assert.equal((await Department.findById('dept_custom').lean()).isActive, false);
    assert.equal((await Room.findById('room_custom').lean()).name, 'Custom Room');
    assert.equal(await mongoose.connection.collection('users').countDocuments({ identifier: 'unrelated.user' }), 1);
  });

  test('re-seeding restores drifted demo records to the fixture values', async () => {
    await seedDemoData();
    await Room.updateOne(
      { _id: 'room_registration' },
      { $set: { name: 'Renamed', isActive: false, departmentId: 'dept_demo_opd', roomNumber: 'X-1' } },
    );
    await Floor.updateOne({ _id: 'floor_ground' }, { $set: { width: 10 } });

    await seedDemoData();

    const room = await Room.findById('room_registration').lean();
    assert.equal(room.name, 'Registration Desk');
    assert.equal(room.isActive, true);
    assert.equal('departmentId' in room, false);
    assert.equal('roomNumber' in room, false);
    assert.equal((await Floor.findById('floor_ground').lean()).width, 1000);
  });

  test('inconsistent data is rejected before anything is written', async () => {
    await assert.rejects(
      () => seedDemoData({
        floors: demoFloors,
        departments: demoDepartments,
        rooms: [...demoRooms, { ...demoRooms[0], _id: 'room_off_map', floorId: 'floor_missing' }],
      }),
      /Demo data is inconsistent: .*room_off_map/,
    );

    assert.deepEqual(await countAll(), { floors: 0, departments: 0, rooms: 0 });
  });

  test('a conflicting department code in unrelated data makes seeding fail loudly', async () => {
    await Department.init();
    await Department.create({ _id: 'dept_other_opd', name: 'Other OPD', code: 'OPD' });

    await assert.rejects(() => seedDemoData(), /duplicate key/);
    assert.equal(await Department.countDocuments({ _id: 'dept_other_opd' }), 1);
  });
});

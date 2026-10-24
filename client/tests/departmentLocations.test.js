import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { groupLocationsByDepartment, resolveDepartmentMapLink } from '../src/features/navigation/departmentLocations.js';

const MAP = '/navigation';
const location = (id, displayName, departmentId) => ({ id, displayName, roomType: 'consultation', departmentId, x: 0, y: 0, width: 1, height: 1 });

// Mirrors the demo data: the server's Registration Desk has no departmentId, even though the
// department record lists it in roomIds; the mock maps mark consultation rooms per department.
const maps = [
  {
    id: 'floor_ground',
    displayName: 'Ground Floor',
    locations: [
      location('room_registration', 'Registration Desk', null),
      location('room_demo_opd_1', 'OPD Consultation Room 1', 'dept_demo_opd'),
      location('room_demo_opd_2', 'OPD Consultation Room 2', 'dept_demo_opd'),
      location('room_demo_med_1', 'General Medicine Room', 'dept_demo_med'),
    ],
  },
  {
    id: 'floor_first',
    displayName: 'First Floor',
    locations: [location('room_demo_ort_1', 'Orthopaedics Consultation Room', 'dept_demo_ort')],
  },
];
const success = (data) => ({ status: 'success', data });

describe('department map locations', () => {
  test("rooms are grouped by the map's own departmentId, each with its floor", () => {
    const byDepartment = groupLocationsByDepartment(maps);

    assert.deepEqual([...byDepartment.keys()].sort(), ['dept_demo_med', 'dept_demo_opd', 'dept_demo_ort']);
    assert.deepEqual(byDepartment.get('dept_demo_ort'), [
      { id: 'room_demo_ort_1', displayName: 'Orthopaedics Consultation Room', floorId: 'floor_first', floorName: 'First Floor' },
    ]);
    assert.equal(byDepartment.get('dept_demo_opd').length, 2);
  });

  test('a room without a departmentId is never attributed to a department', () => {
    const byDepartment = groupLocationsByDepartment([{ id: 'floor_ground', displayName: 'Ground Floor', locations: [location('room_registration', 'Registration Desk', null)] }]);

    assert.equal(byDepartment.size, 0);
  });

  test('malformed maps and locations are skipped instead of producing broken links', () => {
    const byDepartment = groupLocationsByDepartment([
      null,
      { displayName: 'No ID', locations: [location('room_x', 'X', 'dept_demo_opd')] },
      { id: 'floor_ground', displayName: 'Ground Floor', locations: [null, { displayName: 'No ID', departmentId: 'dept_demo_opd' }, location('', 'Blank', 'dept_demo_opd')] },
      { id: 'floor_first', displayName: 'First Floor' },
    ]);

    assert.equal(byDepartment.size, 0);
    assert.equal(groupLocationsByDepartment(undefined).size, 0);
  });

  test('a single mapped room deep-links to its floor and room', () => {
    const lookup = success({ byDepartment: groupLocationsByDepartment(maps), failedFloors: 0 });

    const target = resolveDepartmentMapLink('dept_demo_ort', lookup, MAP);

    assert.equal(target.kind, 'located');
    assert.deepEqual(target.links.map((link) => link.to), ['/navigation?floor=floor_first&location=room_demo_ort_1']);
  });

  test('several mapped rooms each get their own link; none is picked by guesswork', () => {
    const lookup = success({ byDepartment: groupLocationsByDepartment(maps), failedFloors: 0 });

    const target = resolveDepartmentMapLink('dept_demo_opd', lookup, MAP);

    assert.deepEqual(target.links.map((link) => link.to), [
      '/navigation?floor=floor_ground&location=room_demo_opd_1',
      '/navigation?floor=floor_ground&location=room_demo_opd_2',
    ]);
  });

  test('a department with no marked room opens the plain map, without a floor or room', () => {
    const lookup = success({ byDepartment: groupLocationsByDepartment(maps), failedFloors: 0 });

    assert.deepEqual(resolveDepartmentMapLink('dept_demo_ped', lookup, MAP), { kind: 'unmapped', to: MAP });
  });

  test('when some floors failed to load, a missing room is reported as unchecked, not as absent', () => {
    const lookup = success({ byDepartment: groupLocationsByDepartment(maps), failedFloors: 1 });

    assert.deepEqual(resolveDepartmentMapLink('dept_demo_ped', lookup, MAP), { kind: 'unchecked', to: MAP });
    // A room found on a floor that did load is still linked.
    assert.equal(resolveDepartmentMapLink('dept_demo_med', lookup, MAP).kind, 'located');
  });

  test('while loading there is no link; if the map fails, the plain map is offered', () => {
    assert.deepEqual(resolveDepartmentMapLink('dept_demo_opd', { status: 'loading' }, MAP), { kind: 'checking' });
    assert.deepEqual(resolveDepartmentMapLink('dept_demo_opd', { status: 'error', error: new Error('offline') }, MAP), {
      kind: 'unavailable',
      to: MAP,
    });
  });

  test('IDs in deep links are URL-encoded', () => {
    const lookup = success({
      byDepartment: groupLocationsByDepartment([{ id: 'floor 1', displayName: 'Floor 1', locations: [location('room&1', 'Room', 'dept_x')] }]),
      failedFloors: 0,
    });

    assert.equal(resolveDepartmentMapLink('dept_x', lookup, MAP).links[0].to, '/navigation?floor=floor+1&location=room%261');
  });
});

import { groupLocationsByDepartment } from './departmentLocations';
import { navigationService } from './navigationService';

/**
 * Load every floor map through the documented map endpoints. Floors that fail are counted and
 * reported, never silently replaced.
 */
export async function loadFloorMaps(signal) {
  const floors = await navigationService.listFloors({ signal });
  const results = await Promise.all(
    floors.map((floor) =>
      navigationService.getFloorMap(floor.id, { signal }).then(
        (map) => ({ map }),
        (error) => {
          if (error?.name === 'AbortError') throw error;
          return { error };
        },
      ),
    ),
  );
  return {
    maps: results.filter((entry) => entry.map).map((entry) => entry.map),
    failedFloors: results.filter((entry) => entry.error).length,
  };
}

/** Rooms on the map linked to a department, each with its floor. */
export async function findDepartmentLocations(departmentId, signal) {
  const { maps, failedFloors } = await loadFloorMaps(signal);
  const locations = maps.flatMap((map) =>
    (map.locations ?? [])
      .filter((location) => location.departmentId && location.departmentId === departmentId)
      .map((location) => ({ ...location, floorId: map.id, floorName: map.displayName })),
  );
  return { locations, failedFloors };
}

/** One mapped location by ID, with its floor, or `location: null` if no loaded floor has it. */
export async function findLocation(locationId, signal) {
  const { maps, failedFloors } = await loadFloorMaps(signal);
  for (const map of maps) {
    const location = (map.locations ?? []).find((item) => item.id === locationId);
    if (location) return { location, floor: { id: map.id, displayName: map.displayName }, failedFloors };
  }
  return { location: null, floor: null, failedFloors };
}

/** Every department's mapped rooms, from one load of all floors (see departmentLocations.js). */
export async function loadDepartmentLocations(signal) {
  const { maps, failedFloors } = await loadFloorMaps(signal);
  return { byDepartment: groupLocationsByDepartment(maps), failedFloors };
}

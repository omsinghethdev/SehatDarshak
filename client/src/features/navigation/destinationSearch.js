/*
 * Destination search over the navigable places (GET /api/map/destinations) and departments.
 * A department result leads to the department's own mapped room, chosen exactly as the server
 * does: the first room in its roomIds that the map assigns to it (see routeEngine.js).
 */

const normalise = (text) => (text ?? '').toString().trim().toLowerCase();

/** The place a department's directions lead to, or null when none is mapped. */
export function departmentPlace(department, placesById) {
  for (const id of department.roomIds ?? []) {
    const place = placesById.get(id);
    if (place && place.departmentId === department.id) return place;
  }
  return null;
}

/**
 * Results for `query`: departments (with their mapped room) first, then rooms. Rooms whose
 * name starts with the query rank above other matches. Returns at most `limit` results.
 *   → [{ kind: 'department', department, place } | { kind: 'place', place, department? }]
 */
export function searchDestinations({ places, departments = [], query, limit = 8 }) {
  const needle = normalise(query);
  if (!needle) return [];
  const placesById = new Map(places.map((place) => [place.id, place]));
  const departmentById = new Map(departments.map((department) => [department.id, department]));

  const departmentResults = departments
    .filter((department) => [department.name, department.code].some((text) => normalise(text).includes(needle)))
    .map((department) => ({ kind: 'department', department, place: departmentPlace(department, placesById) }))
    .filter((result) => result.place);

  const rank = (place) => (normalise(place.displayName).startsWith(needle) ? 0 : 1);
  const placeResults = places
    .filter((place) => {
      const department = departmentById.get(place.departmentId);
      return [place.displayName, department?.name, department?.code].some((text) => normalise(text).includes(needle));
    })
    .map((place, index) => ({ place, index }))
    .sort((a, b) => rank(a.place) - rank(b.place) || a.index - b.index)
    .map(({ place }) => ({ kind: 'place', place, department: departmentById.get(place.departmentId) ?? null }));

  return [...departmentResults, ...placeResults].slice(0, limit);
}

/** Places grouped by floor (in the order given), for the starting-point list. */
export function groupPlacesByFloor(places) {
  const groups = [];
  for (const place of places) {
    let group = groups.find((item) => item.floorId === place.floorId);
    if (!group) {
      group = { floorId: place.floorId, floorName: place.floorName, places: [] };
      groups.push(group);
    }
    group.places.push(place);
  }
  return groups;
}

import { mapLocationPath } from '../../routes/paths';

const isId = (value) => typeof value === 'string' && value.length > 0;

/**
 * Groups mapped rooms by department, using only the map's own link (`location.departmentId`).
 * The department record's `floor`/`roomIds` are not used: their relationship to the map is not
 * confirmed (docs/SHARED_INTEGRATION_CONTRACT.md), so relying on them could point to the wrong
 * place. Entries without a usable ID are skipped rather than linked.
 *   maps: FloorMap[] → Map<departmentId, Array<{ id, displayName, floorId, floorName }>>
 */
export function groupLocationsByDepartment(maps) {
  const byDepartment = new Map();
  for (const map of maps ?? []) {
    if (!isId(map?.id)) continue;
    for (const location of map.locations ?? []) {
      if (!isId(location?.id) || !isId(location.departmentId)) continue;
      const list = byDepartment.get(location.departmentId) ?? [];
      list.push({ id: location.id, displayName: location.displayName, floorId: map.id, floorName: map.displayName });
      byDepartment.set(location.departmentId, list);
    }
  }
  return byDepartment;
}

/**
 * Where a department's "Find on map" action should go.
 *   lookup: { status: 'loading'|'success'|'error', data?: { byDepartment, failedFloors } }
 * Returns one of:
 *   { kind: 'checking' }                         — maps still loading
 *   { kind: 'located', links: [{ to, location }] } — verified room(s), deep-linked to floor + room
 *   { kind: 'unmapped', to }                     — every floor loaded; no room is marked for it
 *   { kind: 'unchecked', to }                    — some floors failed, so absence is not certain
 *   { kind: 'unavailable', to }                  — the map could not be loaded at all
 * Every non-located result links to the plain hospital map; no room or floor is guessed.
 */
export function resolveDepartmentMapLink(departmentId, lookup, mapPath) {
  if (lookup.status === 'error') return { kind: 'unavailable', to: mapPath };
  if (lookup.status !== 'success' || !lookup.data) return { kind: 'checking' };

  const locations = lookup.data.byDepartment.get(departmentId) ?? [];
  if (locations.length > 0) {
    return {
      kind: 'located',
      links: locations.map((location) => ({ to: mapLocationPath(location.floorId, location.id), location })),
    };
  }
  return { kind: lookup.data.failedFloors > 0 ? 'unchecked' : 'unmapped', to: mapPath };
}

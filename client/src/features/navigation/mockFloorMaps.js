import { DEMO_HOSPITAL } from './demoHospital.data';

/*
 * DEVELOPMENT-ONLY floor maps, shaped like GET /api/map/floors/:floorId, built from the
 * fictional "SehatDarshak Demo Hospital" (demoHospital.data.js — the same file the server
 * seeds from). Not a real hospital layout.
 */
const MAP_META = { coordinateOrigin: 'top-left', coordinateUnit: 'map-unit' };

export const MOCK_FLOOR_MAPS = Object.freeze(
  DEMO_HOSPITAL.floors.map((floor) => ({
    id: floor.id,
    displayName: floor.displayName,
    width: floor.width,
    height: floor.height,
    ...MAP_META,
    // Same order as the API: by name, then ID.
    locations: DEMO_HOSPITAL.rooms
      .filter((room) => room.floorId === floor.id)
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map(({ id, name, type, departmentId, x, y, width, height }) => ({
        id,
        displayName: name,
        roomType: type,
        departmentId: departmentId ?? null,
        x,
        y,
        width,
        height,
      })),
  })),
);

import { API_ERROR_CODES } from '../../services/apiClient';
import { departmentService } from '../departments/departmentService';
import { findDepartmentLocations, findLocation } from '../navigation/locationLookup';

/** The QR code's ID does not exist in the hospital data. */
export class UnknownDestinationError extends Error {
  constructor() {
    super('Unknown QR destination');
    this.code = 'UNKNOWN_DESTINATION';
  }
}

/** Some floor maps failed, so a missing location cannot be called unknown with confidence. */
export class IncompleteMapError extends Error {
  constructor() {
    super('Some floor maps could not be loaded');
    this.code = 'MAP_INCOMPLETE';
  }
}

async function loadDepartment(departmentId, signal) {
  try {
    return await departmentService.getDepartment(departmentId, { signal });
  } catch (error) {
    if (error?.code === API_ERROR_CODES.NOT_FOUND) throw new UnknownDestinationError();
    throw error;
  }
}

/**
 * Turn a validated QR payload into real data from the existing services (documented endpoints
 * in API mode, mock services in mock mode). Nothing is invented: unknown IDs raise
 * UnknownDestinationError, and other service failures propagate unchanged.
 */
export async function resolveQrDestination({ type, id }, signal) {
  if (type === 'hospital') return { type };

  if (type === 'department' || type === 'queue') {
    const department = await loadDepartment(id, signal);
    // Map rooms are helpful extra detail; a map failure must not hide the department.
    const map = await findDepartmentLocations(id, signal).then(
      (result) => ({ ...result, error: null }),
      (error) => {
        if (error?.name === 'AbortError') throw error;
        return { locations: [], failedFloors: 0, error };
      },
    );
    return { type, department, map };
  }

  // type === 'location'
  const { location, floor, failedFloors } = await findLocation(id, signal);
  if (!location) throw failedFloors > 0 ? new IncompleteMapError() : new UnknownDestinationError();
  const department = location.departmentId
    ? await departmentService.getDepartment(location.departmentId, { signal }).catch((error) => {
        if (error?.name === 'AbortError') throw error;
        return null;
      })
    : null;
  return { type, location, floor, department };
}

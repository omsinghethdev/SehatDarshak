import { API_ERROR_CODES } from '../../services/apiClient';
import { departmentService } from '../departments/departmentService';
import { findDepartmentLocations, findLocation } from '../navigation/locationLookup';
import { tokenLookupService } from '../queue/queueService';

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

/**
 * The scanned token does not exist or this account may not see it. The server answers both with
 * 404 so a token's existence is never revealed; this error keeps them indistinguishable too.
 */
export class TokenUnavailableError extends Error {
  constructor() {
    super('Queue token not available');
    this.code = 'TOKEN_UNAVAILABLE';
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

  if (type === 'token') {
    let token;
    try {
      token = await tokenLookupService.getToken(id, { signal });
    } catch (error) {
      if (error?.code === API_ERROR_CODES.NOT_FOUND || error?.code === API_ERROR_CODES.FORBIDDEN) {
        throw new TokenUnavailableError();
      }
      throw error;
    }
    // The department name is helpful context; a failure here must not hide the token.
    const department = await departmentService.getDepartment(token.departmentId, { signal }).catch((error) => {
      if (error?.name === 'AbortError') throw error;
      return null;
    });
    return { type, token, department };
  }

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

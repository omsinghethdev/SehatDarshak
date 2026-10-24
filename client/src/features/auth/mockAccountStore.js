import { API_ERROR_CODES, ApiError } from '../../services/apiClient';
import { ACCOUNT_TYPES } from './accountTypes';
import { MOCK_DEMO_ACCOUNTS } from './mockDemoAccounts';

/*
 * DEVELOPMENT-ONLY store for accounts created in mock mode (this browser's localStorage).
 * Records keep the account category (`kind`), a password digest, and no plain-text password.
 * Role and department are always derived from ACCOUNT_TYPES, never read from a stored field.
 */

const ACCOUNTS_STORAGE_KEY = 'sehatdarsak.mockAccounts';

export function readMockAccounts() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCOUNTS_STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeMockAccounts(accounts) {
  try {
    window.localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    throw new ApiError({
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: 'Demo accounts could not be saved in this browser.',
      status: 500,
    });
  }
}

/** The category of a stored account. Accounts created before categories existed are patients. */
export function accountType(account) {
  return ACCOUNT_TYPES[account.kind ?? 'patient'] ?? null;
}

/** Mock-internal lookup of a staff user's assigned department (server-only in the contract). */
export function getMockStaffDepartmentId(userId) {
  const demo = MOCK_DEMO_ACCOUNTS.find((account) => account.user.id === userId);
  if (demo) return demo.departmentId ?? null;
  const stored = readMockAccounts().find((account) => account.id === userId);
  return stored ? (accountType(stored)?.departmentId ?? null) : null;
}

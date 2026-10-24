import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './AuthContext';
import { AUTH_MODE, IS_MOCK_AUTH } from './authConfig';
import { authService } from './authService';
import { setUnauthorizedHandler } from '../../services/apiClient';
import {
  SESSION_STORAGE_KEY,
  clearStoredSession,
  isValidSession,
  readSession,
  writeSession,
} from '../../services/authStorage';

/**
 * Restore a stored session only if it was created by the current auth mode, so a mock
 * session is never sent to the real API (and vice versa).
 */
function readSessionForCurrentMode() {
  const session = readSession();
  if (session && session.source !== AUTH_MODE) {
    clearStoredSession();
    return null;
  }
  return session;
}

/**
 * Session state for the app. A session is created only from an auth-service response
 * (`login`, `register`, or the mock-only `loginAsDemoPatient`).
 *
 * `authEvent` ("signedIn" | "registered") is kept in memory only, so pages can show a
 * one-time confirmation after sign-in without it reappearing on refresh.
 */
export function AuthProvider({ children }) {
  const [state, setState] = useState(() => ({ session: readSessionForCurrentMode(), authEvent: null }));

  const startSession = useCallback((result, authEvent) => {
    const session = { accessToken: result?.accessToken, user: result?.user, source: AUTH_MODE };
    if (!isValidSession(session)) {
      throw new Error('The sign-in response did not include a valid access token and user.');
    }
    writeSession(session);
    setState({ session, authEvent });
    return session.user;
  }, []);

  const login = useCallback(
    async (credentials) => startSession(await authService.login(credentials), 'signedIn'),
    [startSession],
  );

  const register = useCallback(
    async (details) => startSession(await authService.register(details), 'registered'),
    [startSession],
  );

  const loginAsDemoPatient = useMemo(
    () =>
      authService.loginAsDemoPatient
        ? async () => startSession(await authService.loginAsDemoPatient(), 'signedIn')
        : null,
    [startSession],
  );

  // The contract has no logout endpoint, so signing out clears the local session.
  const logout = useCallback(() => {
    clearStoredSession();
    setState({ session: null, authEvent: null });
  }, []);

  const dismissAuthEvent = useCallback(() => {
    setState((current) => (current.authEvent ? { ...current, authEvent: null } : current));
  }, []);

  // Clear the local session when the API rejects the stored token.
  useEffect(() => setUnauthorizedHandler(logout), [logout]);

  // Keep tabs in sync when the session changes elsewhere.
  useEffect(() => {
    function handleStorage(event) {
      if (event.key === null || event.key === SESSION_STORAGE_KEY) {
        setState({ session: readSessionForCurrentMode(), authEvent: null });
      }
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const { session, authEvent } = state;

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      role: session?.user?.role ?? null,
      isAuthenticated: Boolean(session),
      authMode: AUTH_MODE,
      isMockAuth: IS_MOCK_AUTH,
      authEvent,
      login,
      register,
      loginAsDemoPatient,
      logout,
      dismissAuthEvent,
    }),
    [session, authEvent, login, register, loginAsDemoPatient, logout, dismissAuthEvent],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

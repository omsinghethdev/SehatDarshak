import { useCallback } from 'react';
import { usePagedList } from '../../hooks/usePagedList';
import { assistanceService } from './assistanceService';

/** The signed-in patient's requests (GET /api/assistance-requests/me), newest first. */
export function useAssistanceHistory() {
  const fetchPage = useCallback((options) => assistanceService.listMyRequests(options), []);
  return usePagedList(fetchPage, 10);
}

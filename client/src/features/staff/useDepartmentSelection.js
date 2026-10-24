import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

const PREFERENCE_KEY = 'sehatdarsak.staffDepartment';

function readPreference() {
  try {
    return window.localStorage.getItem(PREFERENCE_KEY);
  } catch {
    return null;
  }
}

/**
 * Selected department for staff views: `?department=` in the URL, else the last choice on this
 * device, else the first department. The contract does not expose a staff member's assigned
 * department to the client, so the server (or mock) answers 403 for departments they cannot manage.
 */
export function useDepartmentSelection(departments) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('department') ?? readPreference();
  const selectedId = departments?.some((department) => department.id === requested)
    ? requested
    : departments?.[0]?.id ?? null;

  const select = useCallback(
    (departmentId) => {
      try {
        window.localStorage.setItem(PREFERENCE_KEY, departmentId);
      } catch {
        // A UI preference only; ignore storage failures.
      }
      setSearchParams({ department: departmentId }, { replace: true });
    },
    [setSearchParams],
  );

  return [selectedId, select];
}

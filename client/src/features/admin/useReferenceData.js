import { useCallback, useMemo } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { adminService } from './adminService';

/**
 * Departments and wards as returned by the admin service, for filter and form options and for
 * turning IDs in audit entries into names. Department names always come from this data, never
 * from hard-coded lists.
 */
export function useReferenceData() {
  const load = useCallback(async (signal) => {
    const [departments, wards] = await Promise.all([
      adminService.listDepartments({ signal }),
      adminService.listWards({ limit: 100, signal }),
    ]);
    return { departments, wards: wards.items };
  }, []);
  const state = useAsyncData(load);

  return useMemo(() => {
    const departments = state.data?.departments ?? [];
    const wards = state.data?.wards ?? [];
    return {
      status: state.status,
      error: state.error,
      reload: state.reload,
      departments,
      wards,
      departmentOptions: departments.map((department) => ({
        value: department.id,
        label: `${department.name} (${department.code})${department.isActive ? '' : ' — inactive'}`,
      })),
      activeDepartmentOptions: departments
        .filter((department) => department.isActive)
        .map((department) => ({ value: department.id, label: `${department.name} (${department.code})` })),
      wardOptions: wards.map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})${ward.isActive ? '' : ' — inactive'}` })),
      activeWardOptions: wards.filter((ward) => ward.isActive).map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.code})` })),
      names: {
        departments: new Map(departments.map((department) => [department.id, department.name])),
        wards: new Map(wards.map((ward) => [ward.id, ward.name])),
      },
    };
  }, [state.data, state.status, state.error, state.reload]);
}

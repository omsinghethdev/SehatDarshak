/*
 * Admin route components, loaded on demand (see routes/router.jsx) so patients and staff never
 * download the administration code. Access is still decided by ProtectedRoute before any of
 * these load, and by the server on every request.
 */
import { AdminLayout } from '../../features/admin/AdminLayout';
import { AdminDashboardPage } from '../AdminDashboardPage';
import { ActivityPage } from './ActivityPage';
import { DepartmentDetailPage, DepartmentsWardsPage, WardDetailPage } from './OperationsPages';
import { StaffCreatePage, StaffDetailPage, StaffDirectoryPage } from './StaffPages';
import { PatientDetailPage, VisitDetailPage, VisitsPage } from './VisitPages';

export { ActivityPage, AdminDashboardPage, AdminLayout, DepartmentDetailPage, DepartmentsWardsPage, PatientDetailPage, VisitDetailPage, VisitsPage, WardDetailPage };

export const DoctorDirectoryPage = () => <StaffDirectoryPage key="doctor" staffType="doctor" />;
export const DoctorCreatePage = () => <StaffCreatePage key="doctor-new" staffType="doctor" />;
export const DoctorDetailPage = () => <StaffDetailPage key="doctor-detail" staffType="doctor" />;
export const StaffMemberDirectoryPage = () => <StaffDirectoryPage key="staff" staffType="staff" />;
export const StaffMemberCreatePage = () => <StaffCreatePage key="staff-new" staffType="staff" />;
export const StaffMemberDetailPage = () => <StaffDetailPage key="staff-detail" staffType="staff" />;

import { createBrowserRouter } from 'react-router';
import { AppLayout } from '../components/layout/AppLayout';
import { AssistancePage } from '../pages/AssistancePage';
import { BookTokenPage } from '../pages/BookTokenPage';
import { DashboardPage } from '../pages/DashboardPage';
import { DepartmentsPage } from '../pages/DepartmentsPage';
import { HomePage } from '../pages/HomePage';
import { LoginPage } from '../pages/LoginPage';
import { NavigationPage } from '../pages/NavigationPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { QrCodesPage } from '../pages/QrCodesPage';
import { RegisterAccountPage, RegisterPage } from '../pages/RegisterPage';
import { ScanPage } from '../pages/ScanPage';
import { StaffAssistancePage } from '../pages/StaffAssistancePage';
import { StaffQueuePage } from '../pages/StaffQueuePage';
import { TokenHistoryPage } from '../pages/TokenHistoryPage';
import { TokenStatusPage } from '../pages/TokenStatusPage';
import { UnauthorizedPage } from '../pages/UnauthorizedPage';
import { GuestRoute } from './GuestRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { RouteErrorPage } from './RouteErrorPage';
import { PATHS } from './paths';

// Admin pages load as one on-demand chunk the first time an admin opens an admin route.
const loadAdminRoutes = () => import('../pages/admin/adminRouteComponents');
const adminComponent = (name) => async () => ({ Component: (await loadAdminRoutes())[name] });

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [
          { path: PATHS.home, element: <HomePage /> },
          { path: PATHS.unauthorized, element: <UnauthorizedPage /> },
          // Public: validates the QR payload and asks visitors to sign in before showing data.
          { path: PATHS.scan, element: <ScanPage /> },
          {
            element: <GuestRoute />,
            children: [
              { path: PATHS.login, element: <LoginPage /> },
              { path: PATHS.register, element: <RegisterPage /> },
              { path: PATHS.registerPatient, element: <RegisterAccountPage kind="patient" /> },
              { path: PATHS.registerStaffOpd, element: <RegisterAccountPage kind="staff_opd" /> },
              { path: PATHS.registerStaffMed, element: <RegisterAccountPage kind="staff_med" /> },
              { path: PATHS.registerAdmin, element: <RegisterAccountPage kind="admin" /> },
            ],
          },
          {
            // Any signed-in role (department and map endpoints are open to all authenticated users).
            element: <ProtectedRoute />,
            children: [
              { path: PATHS.dashboard, element: <DashboardPage /> },
              { path: PATHS.departments, element: <DepartmentsPage /> },
              { path: PATHS.navigation, element: <NavigationPage /> },
              { path: PATHS.qrCodes, element: <QrCodesPage /> },
            ],
          },
          {
            // Patient-only actions. Staff/admin token and assistance views are not built yet.
            element: <ProtectedRoute allowedRoles={['patient']} />,
            children: [
              { path: PATHS.bookToken, element: <BookTokenPage /> },
              { path: PATHS.tokenStatus, element: <TokenStatusPage /> },
              { path: PATHS.tokenHistory, element: <TokenHistoryPage /> },
              { path: PATHS.assistance, element: <AssistancePage /> },
            ],
          },
          {
            // Queue and assistance management: assigned-department staff or admin (API contract).
            // The server/mock also enforces department scope on every request.
            element: <ProtectedRoute allowedRoles={['staff', 'admin']} />,
            children: [
              { path: PATHS.staffQueue, element: <StaffQueuePage /> },
              { path: PATHS.staffAssistance, element: <StaffAssistancePage /> },
            ],
          },
          {
            // Administration is admin-only; the server also enforces it on every /api/admin request.
            element: <ProtectedRoute allowedRoles={['admin']} />,
            children: [
              {
                // Loaded on demand: the administration code is a separate chunk.
                lazy: adminComponent('AdminLayout'),
                children: [
                  { path: PATHS.admin, lazy: adminComponent('AdminDashboardPage') },
                  { path: PATHS.adminDoctors, lazy: adminComponent('DoctorDirectoryPage') },
                  { path: PATHS.adminDoctorNew, lazy: adminComponent('DoctorCreatePage') },
                  { path: PATHS.adminDoctor, lazy: adminComponent('DoctorDetailPage') },
                  { path: PATHS.adminStaff, lazy: adminComponent('StaffMemberDirectoryPage') },
                  { path: PATHS.adminStaffNew, lazy: adminComponent('StaffMemberCreatePage') },
                  { path: PATHS.adminStaffMember, lazy: adminComponent('StaffMemberDetailPage') },
                  { path: PATHS.adminVisits, lazy: adminComponent('VisitsPage') },
                  { path: PATHS.adminVisit, lazy: adminComponent('VisitDetailPage') },
                  { path: PATHS.adminPatient, lazy: adminComponent('PatientDetailPage') },
                  { path: PATHS.adminDepartments, lazy: adminComponent('DepartmentsWardsPage') },
                  { path: PATHS.adminDepartment, lazy: adminComponent('DepartmentDetailPage') },
                  { path: PATHS.adminWard, lazy: adminComponent('WardDetailPage') },
                  { path: PATHS.adminActivity, lazy: adminComponent('ActivityPage') },
                ],
              },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

import { createBrowserRouter } from 'react-router';
import { AppLayout } from '../components/layout/AppLayout';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
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
import { TokenStatusPage } from '../pages/TokenStatusPage';
import { UnauthorizedPage } from '../pages/UnauthorizedPage';
import { GuestRoute } from './GuestRoute';
import { ProtectedRoute } from './ProtectedRoute';
import { RouteErrorPage } from './RouteErrorPage';
import { PATHS } from './paths';

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
            // Dashboard statistics are admin-only.
            element: <ProtectedRoute allowedRoles={['admin']} />,
            children: [{ path: PATHS.admin, element: <AdminDashboardPage /> }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

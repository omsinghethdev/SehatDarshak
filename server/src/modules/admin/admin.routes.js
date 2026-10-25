import { Router } from 'express';
import { authenticate, authorizeRoles } from '../../middleware/authenticate.js';
import { auditAdminRouter } from '../audit/audit.routes.js';
import { departmentAdminRouter } from '../departments/department.admin.routes.js';
import { patientAdminRouter } from '../patients/patient.admin.routes.js';
import { statisticsAdminRouter } from '../reports/statistics.routes.js';
import { staffAdminRouter } from '../staff/staff.routes.js';
import { visitAdminRouter } from '../visits/visit.routes.js';
import { wardAdminRouter } from '../wards/ward.routes.js';

/*
 * Every /api/admin endpoint requires a valid token for an active account with the `admin` role.
 * The check runs once here, before any sub-router, so no admin endpoint can be added without it.
 * Patients, staff, and doctors receive 403; missing or invalid tokens receive 401.
 */
export const adminRouter = Router();

adminRouter.use(authenticate, authorizeRoles('admin'));

adminRouter.use('/staff', staffAdminRouter);
adminRouter.use('/patients', patientAdminRouter);
adminRouter.use('/visits', visitAdminRouter);
adminRouter.use('/wards', wardAdminRouter);
adminRouter.use('/departments', departmentAdminRouter);
adminRouter.use('/statistics', statisticsAdminRouter);
adminRouter.use('/audit', auditAdminRouter);

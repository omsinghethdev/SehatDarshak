import { Router } from 'express';
import { getHospitalTimeZone } from '../../config/hospital.js';
import { parseReportPeriod } from '../../utils/dates.js';
import { parseOptionalBooleanQuery } from '../../utils/requestValidation.js';
import { getAdminStatistics } from './statistics.service.js';

// Mounted under /api/admin/statistics; the admin router authenticates and requires the admin role.
// GET /api/dashboard/statistics (all-time queue summary used by the current admin UI) is unchanged.
export const statisticsAdminRouter = Router();

statisticsAdminRouter.get('/', async (request, response) => {
  const period = parseReportPeriod(request.query, { timeZone: getHospitalTimeZone(), defaultPeriod: 'last7Days' });
  const compare = parseOptionalBooleanQuery(request.query.compare, 'compare') ?? true;
  response.status(200).json({ data: await getAdminStatistics(period, { compare }) });
});

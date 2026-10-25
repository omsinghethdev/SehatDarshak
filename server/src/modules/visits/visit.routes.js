import { Router } from 'express';
import { getHospitalTimeZone } from '../../config/hospital.js';
import { parseReportPeriod } from '../../utils/dates.js';
import { validationError } from '../../utils/httpError.js';
import {
  parseNullableResourceId,
  parseObjectBody,
  parseOptionalEnumValue,
  parseOptionalResourceId,
  parseOptionalText,
  parseOptionalUserId,
  parsePagination,
  parseResourceId,
} from '../../utils/requestValidation.js';
import { correctVisit, getVisit, listVisits, visitStatuses } from './visit.service.js';

const adminNoteMaxLength = 500;

// Mounted under /api/admin/visits; the admin router authenticates and requires the admin role.
export const visitAdminRouter = Router();

visitAdminRouter.get('/', async (request, response) => {
  const { query } = request;
  const filters = {
    // Defaults to the last 30 days; `period=all` lists every visit (use with patientId).
    period: parseReportPeriod(query, { timeZone: getHospitalTimeZone(), defaultPeriod: 'last30Days', allowAll: true }),
    patientId: parseOptionalUserId(query.patientId, 'patientId'),
    departmentId: parseOptionalResourceId(query.departmentId, 'departmentId'),
    wardId: parseOptionalResourceId(query.wardId, 'wardId'),
    doctorId: parseOptionalUserId(query.doctorId, 'doctorId'),
    status: parseOptionalEnumValue(query.status, 'status', visitStatuses),
    pagination: parsePagination(query),
  };
  response.status(200).json(await listVisits(filters));
});

visitAdminRouter.get('/:visitId', async (request, response) => {
  const visitId = parseResourceId(request.params.visitId, 'visitId');
  response.status(200).json({ data: await getVisit(visitId) });
});

visitAdminRouter.patch('/:visitId', async (request, response) => {
  const visitId = parseResourceId(request.params.visitId, 'visitId');
  const body = parseObjectBody(request.body, ['wardId', 'adminNote']);
  const input = {};
  if (body.wardId !== undefined) input.wardId = parseNullableResourceId(body.wardId, 'wardId');
  if (body.adminNote !== undefined) {
    input.adminNote = parseOptionalText(body.adminNote, 'adminNote', adminNoteMaxLength, { nullable: true });
  }
  if (Object.keys(input).length === 0) {
    throw validationError('body: Provide wardId and/or adminNote', [{ field: 'body', message: 'Provide wardId and/or adminNote' }]);
  }

  response.status(200).json({ data: await correctVisit(request.user, visitId, input) });
});

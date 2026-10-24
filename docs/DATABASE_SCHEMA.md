# Proposed Database Schema

This is documentation only; no Mongoose models are implemented yet. All records must use fictional demo data during development.

## User

Represents a patient, staff member, or administrator. Proposed fields: `name`, `identifier` (a unique username), `passwordHash`, `preferredLanguage` (optional supported language code), `role` (`patient`, `staff`, `admin`), `departmentId` for assigned staff, and audit timestamps. Passwords are never stored in plaintext. Public registration creates only `patient` users; staff department and elevated roles are server-controlled. Retention policy still requires team review.

## Department

Represents an OPD or hospital service. Proposed fields: `name`, `code`, `description`, `floor`, `roomIds`, `isActive`, and map metadata. One department can have many rooms, staff members, and queue tokens.

## Room

Represents a navigable location. Proposed fields: `name`, `roomNumber`, `floorId`, `type`, `departmentId` (optional), `mapPosition`, `isAccessible`, and `isActive`. `mapPosition` contains numeric `x`, `y`, `width`, and `height` values in the same top-left-origin coordinate system as its floor canvas. This supports the basic SVG-based 2D map only; it does not imply route-finding or external map integration.

## QueueToken

Represents a patient visit in a departmental queue. Proposed fields: `displayNumber`, `patientId`, `departmentId`, `status`, `issuedAt`, `calledAt`, `completedAt`, `estimatedWaitMinutes`, and `patientsAheadSnapshot`. Statuses are `waiting`, `called`, `in_consultation`, `completed`, `skipped`, and `cancelled`; estimates are simulated in the MVP. `waiting`, `called`, and `in_consultation` are active, while the other statuses are terminal. The backend must enforce one active token per patient and department, and only one `called` token per department.

## AssistanceRequest

Represents a request for staff help, not guaranteed emergency response. Proposed fields: `patientId`, `departmentId`, `location`, `message`, `status`, `acknowledgedBy`, `createdAt`, and `acknowledgedAt`. Status is either `open` or `acknowledged`; no resolution workflow is included in the MVP. `departmentId` scopes staff access to authorized requests.

## Relationships

- A Department has zero or more Rooms, staff Users, and QueueTokens.
- A patient User can receive many QueueTokens and submit many AssistanceRequests.
- A staff User belongs to zero or one Department initially and may acknowledge many AssistanceRequests.
- A QueueToken belongs to one patient and one Department.
- An AssistanceRequest belongs to one patient and one Department; a staff User may acknowledge it only within their assigned department.

Use object IDs for references, validate authorization server-side, minimize personal data, and define retention/deletion rules before real use.

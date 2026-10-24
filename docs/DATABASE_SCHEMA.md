# Proposed Database Schema

This is documentation only; no Mongoose models are implemented yet. All records must use fictional demo data during development.

## User

Represents a patient, staff member, or administrator. Proposed fields: `name`, `phoneOrIdentifier`, `preferredLanguage`, `role` (`patient`, `staff`, `admin`), `departmentId` for assigned staff, and audit timestamps. Authentication fields and retention policy require team review.

## Department

Represents an OPD or hospital service. Proposed fields: `name`, `code`, `description`, `floor`, `roomIds`, `isActive`, and map metadata. One department can have many rooms, staff members, and queue tokens.

## Room

Represents a navigable location. Proposed fields: `name`, `roomNumber`, `floor`, `type`, `departmentId` (optional), `mapPosition`, `isAccessible`, and `isActive`. `mapPosition` should support the future SVG map without committing to a map library.

## QueueToken

Represents a patient visit in a departmental queue. Proposed fields: `displayNumber`, `patientId`, `departmentId`, `status`, `issuedAt`, `calledAt`, `completedAt`, `estimatedWaitMinutes`, and `patientsAheadSnapshot`. Status vocabulary must be agreed before implementation; estimates are simulated in the MVP.

## AssistanceRequest

Represents a request for staff help, not guaranteed emergency response. Proposed fields: `patientId` (optional), `location`, `message`, `status`, `acknowledgedBy`, `createdAt`, and `acknowledgedAt`.

## Relationships

- A Department has zero or more Rooms, staff Users, and QueueTokens.
- A patient User can receive many QueueTokens and submit many AssistanceRequests.
- A staff User belongs to zero or one Department initially and may acknowledge many AssistanceRequests.
- A QueueToken belongs to one patient and one Department.

Use object IDs for references, validate authorization server-side, minimize personal data, and define retention/deletion rules before real use.

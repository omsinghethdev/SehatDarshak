# Database Schema

The backend uses MongoDB through Mongoose. Models live in `server/src/modules/*/*.model.js`. Each
section below says whether a model or field is **implemented** or **proposed** (agreed MVP scope that
is not implemented yet). All records must use fictional demo data during development.

## Identifiers

- **Departments, rooms, floors, queue tokens, and assistance requests** use stable string IDs as
  their `_id`, for example `dept_demo_opd`, `room_registration`, `floor_ground`, `token_…`, and
  `assist_…`. The fixed demo IDs come from the shared fixtures in
  [SHARED_INTEGRATION_CONTRACT.md](SHARED_INTEGRATION_CONTRACT.md). Token and assistance IDs are
  random and unguessable.
- **Users** use MongoDB ObjectIds, exposed as strings.
- References between collections store these IDs (for example `QueueToken.departmentId` is a
  department's string ID).

## User (implemented; `isActive` proposed)

Represents a patient, staff member (including doctors), or administrator.

| Field | Status | Notes |
| --- | --- | --- |
| `name` | Implemented | Required |
| `identifier` | Implemented | Unique username, stored in lower case |
| `passwordHash` | Implemented | scrypt hash with per-user salt; never selected by default or returned |
| `preferredLanguage` | Implemented | Optional; `en` or `hi` |
| `role` | Implemented | `patient`, `staff`, or `admin` |
| `departmentId` | Implemented | Assigned department for staff |
| `createdAt`, `updatedAt` | Implemented | Timestamps |
| `isActive` | **Proposed** | Boolean, default `true`. Admins toggle it for staff accounts. Inactive accounts cannot sign in or use protected endpoints. |

Rules:

- Public registration creates only `patient` users.
- Staff accounts are created only by admins (Proposed admin endpoints), and admin accounts only by a
  maintainer directly in the database.
- Roles, departments, and account status are server-controlled.
- Retention policy still requires team review.

## Department (implemented)

Represents an OPD or hospital service. Fields: `name`, `code` (unique), `description`, `floor`,
`roomIds`, and `isActive`, with timestamps. One department can have many rooms, staff members, and
queue tokens. "Map metadata" mentioned in earlier drafts is not defined or implemented. Departments
are read-only through the API; create/edit/delete is out of scope.

## Floor (implemented)

Represents one floor of the 2D map. Fields: `displayName`, `width`, `height` (map units), `level`
(server-only display order), and `isActive`. Read-only through the API.

## Room (implemented)

Represents a navigable location. Fields: `name`, `roomNumber`, `floorId`, `type`, `departmentId`
(optional), `mapPosition`, `isAccessible`, and `isActive`. `mapPosition` contains numeric `x`, `y`,
`width`, and `height` values in the same top-left-origin coordinate system as its floor canvas. This
supports the basic SVG-based 2D map only; it does not imply route-finding or external map
integration. Read-only through the API.

## QueueToken (implemented; `statusHistory` proposed)

Represents a patient visit in a departmental queue.

| Field | Status | Notes |
| --- | --- | --- |
| `displayNumber` | Implemented | For example `OPD-001` |
| `sequence` | Implemented | Server-only queue position within the department |
| `patientId` | Implemented | Owning patient; never returned by the API |
| `departmentId` | Implemented | |
| `status` | Implemented | `waiting`, `called`, `in_consultation`, `completed`, `skipped`, `cancelled` |
| `issuedAt`, `calledAt`, `completedAt` | Implemented | Server timestamps |
| `estimatedWaitMinutes`, `patientsAheadSnapshot` | Implemented | Simulated values at creation time |
| `statusHistory` | **Proposed** | Embedded, append-only audit entries; see below |

Estimates are simulated in the MVP. `waiting`, `called`, and `in_consultation` are active, while the
other statuses are terminal.

Implemented database rules (MongoDB 6.0 or later is required for the partial indexes):

- Unique partial index on (`patientId`, `departmentId`) for active statuses: one active token per
  patient and department.
- Unique partial index on `departmentId` where `status` is `called`: only one called token per
  department.
- Unique index on (`departmentId`, `sequence`).

A separate `TokenCounter` collection (implemented) holds one atomically incremented counter per
department for display numbers.

### `statusHistory` audit entries (Proposed)

Each successful status change appends one entry in the **same atomic update** that changes `status`,
so a change and its audit entry are always written together without database transactions.

| Field | Notes |
| --- | --- |
| `_id` | Entry ID (ObjectId) |
| `fromStatus`, `toStatus` | Previous and new status |
| `action` | `call_next` or `status_update` |
| `actorId`, `actorRole` | The authenticated `staff` or `admin` user who made the change |
| `occurredAt` | Server timestamp |

- `departmentId`, `tokenId`, and `displayNumber` come from the token document itself.
- Entries are never returned in patient or staff token responses. They are read only through the
  admin audit endpoint, which flattens them across tokens.
- Requests that do not change the status (invalid transitions, lost races, forbidden callers) append
  nothing.
- An index on `statusHistory.occurredAt` (and on `departmentId`) supports admin filtering.

## AssistanceRequest (implemented)

Represents a request for staff help, not guaranteed emergency response. Fields: `patientId`,
`departmentId`, `location`, `message`, `status`, `acknowledgedBy`, `acknowledgedAt`, and timestamps.
Status is either `open` or `acknowledged`; no resolution workflow is included in the MVP.
`departmentId` scopes staff access to authorized requests.

## Relationships

- A Department has zero or more Rooms, staff Users, and QueueTokens.
- A Floor has zero or more Rooms.
- A patient User can receive many QueueTokens and submit many AssistanceRequests.
- A staff User belongs to zero or one Department and may acknowledge many AssistanceRequests and
  change many QueueToken statuses (recorded in `statusHistory`, Proposed).
- A QueueToken belongs to one patient and one Department.
- An AssistanceRequest belongs to one patient and one Department; a staff User may acknowledge it
  only within their assigned department.

Validate authorization server-side, minimize personal data, and define retention/deletion rules
(including for audit history) before real use.

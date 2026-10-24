# API Contract

> **Status:** MVP scope finalized for the hackathon. Endpoints marked **Proposed** are agreed scope
> but are not implemented yet; their exact shapes must be confirmed by the team before
> implementation. Items listed under [Decisions for team review](#decisions-for-team-review) are
> still open.

## Implementation status

Status labels used in this document:

- **Implemented and verified**: present in `server/src` and covered by passing automated tests in
  `server/tests` (154 tests passing on 2026-10-24). See [TESTING.md](TESTING.md).
- **Implemented, needs verification**: present in code but not yet covered by automated tests.
- **Proposed**: agreed MVP scope that is not implemented.

| Method | Path | Access | Status |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Implemented and verified |
| `POST` | `/api/auth/register` | Public | Implemented and verified |
| `POST` | `/api/auth/login` | Public | Implemented and verified |
| `GET` | `/api/auth/me` | Any authenticated role | Implemented and verified (adding staff `departmentId` is Proposed) |
| `GET` | `/api/patients/me` | Patient | Implemented and verified |
| `GET` | `/api/patients/me/queue-tokens/active` | Patient | Implemented and verified |
| `GET` | `/api/departments`, `/api/departments/:departmentId` | Authenticated | Implemented and verified |
| `GET` | `/api/rooms?floor=&departmentId=&page=&limit=`, `/api/rooms/:roomId` | Authenticated | Implemented and verified |
| `GET` | `/api/map/floors`, `/api/map/floors/:floorId` | Authenticated | Implemented and verified |
| `POST` | `/api/queue-tokens` | Patient | Implemented and verified |
| `GET` | `/api/queue-tokens/:tokenId` | Token owner, assigned-department staff, admin | Implemented and verified (also used for QR lookup) |
| `GET` | `/api/queue-tokens/:tokenId/status` | Token owner, assigned-department staff, admin | Implemented and verified |
| `GET` | `/api/queues/:departmentId?page=&limit=` | Assigned-department staff, admin | Implemented and verified |
| `POST` | `/api/queues/:departmentId/call-next` | Assigned-department staff, admin | Implemented and verified (audit recording is Proposed) |
| `PATCH` | `/api/queue-tokens/:tokenId/status` | Assigned-department staff, admin | Implemented and verified (audit recording is Proposed) |
| `POST` | `/api/assistance-requests` | Patient | Implemented and verified |
| `GET` | `/api/assistance-requests/me?page=&limit=` | Patient | Implemented and verified |
| `GET` | `/api/assistance-requests?status=&page=&limit=` | Assigned-department staff, admin | Implemented and verified |
| `PATCH` | `/api/assistance-requests/:requestId/acknowledge` | Assigned-department staff, admin | Implemented and verified |
| `GET` | `/api/dashboard/statistics` | Admin | Implemented and verified (response shape pending team approval) |
| `GET` | `/api/admin/staff?departmentId=&isActive=&page=&limit=` | Admin | **Proposed** |
| `POST` | `/api/admin/staff` | Admin | **Proposed** |
| `PATCH` | `/api/admin/staff/:staffId` | Admin | **Proposed** |
| `GET` | `/api/admin/audit/queue-token-status-changes?…` | Admin | **Proposed** |
| — | Rejecting deactivated staff accounts (all protected routes and login) | — | **Proposed** |

## Scope and conventions

The API base path is **`/api`**. Every endpoint below shows its full path and uses JSON. This MVP
uses fictional demo data only. It does not include email OTP, real hospital integrations, clinical
triage, WebSockets, or guaranteed emergency-response functionality.

**In scope:** patient registration and tokens, simulated wait estimates, read-only departments,
rooms and a basic 2D floor map, assistance requests, staff (doctor) queue operations, token QR
codes, admin statistics and queue monitoring, admin staff-account management, and protected audit
history of queue-token status changes.

**Out of scope:** route calculation or turn-by-turn indoor navigation (future scope), live indoor
positioning or tracking, create/edit/delete of departments, rooms or floors, public staff or admin
registration, payments, prescriptions, medical records, and emergency dispatch.

### Success responses

Successful responses use `data`, with optional `message` and `meta` for paginated lists.

```json
{
  "data": {},
  "message": "Optional human-readable message",
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

Use `200 OK` for reads/updates, `201 Created` for new resources, and `204 No Content` only when a
response body is unnecessary.

### Error responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "departmentId is required",
    "details": [{ "field": "departmentId", "message": "Required" }]
  }
}
```

Use these codes consistently: `VALIDATION_ERROR` (`400`), `UNAUTHORIZED` (`401`), `FORBIDDEN`
(`403`), `NOT_FOUND` (`404`), `CONFLICT` (`409`), and `INTERNAL_ERROR` (`500`). Do not expose stack
traces or sensitive details.

Rules applied across all endpoints (implemented and verified):

- **400 `VALIDATION_ERROR`**: malformed JSON, request bodies that are too large or cannot be
  decoded, malformed URL encoding, invalid IDs or query values, and **any request-body field that
  the endpoint does not accept**. Unknown fields are rejected, so clients cannot submit
  server-controlled values such as `role`, `patientId`, `status`, or `departmentId`.
- **401 `UNAUTHORIZED`**: missing, malformed, expired, or tampered Bearer token, or a token whose
  user no longer exists.
- **403 `FORBIDDEN`**: the authenticated role may not use the endpoint, or a staff member requests
  a department queue they are not assigned to.
- **404 `NOT_FOUND` for out-of-scope records**: when a caller asks for a specific token or
  assistance request they may not access (another patient's token, or another department's token
  or request), the API answers exactly as if the record did not exist. This deliberately avoids
  revealing that the record exists.
- **409 `CONFLICT`**: business-rule conflicts, such as duplicate usernames, duplicate active tokens,
  invalid status transitions, an already-called token, or a repeated acknowledgement.

For growing lists, accept `page` (default `1`) and `limit` (default `20`, maximum `100`; larger
values return `400`) and return the `meta` object above. Empty query values (for example
`?page=`) are treated as omitted.

## Authentication and authorization

Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

Roles are `patient`, `staff`, and `admin`. Doctors use the `staff` role; there is no separate
`doctor` role.

- **patient**: may access only their own profile, tokens, and assistance requests.
- **staff** (including doctors): may view and manage only queues, tokens, and assistance requests
  for their assigned department.
- **admin**: may access dashboard statistics and queue monitoring across departments, act on any
  department's queue and assistance requests, manage staff accounts (Proposed), and view the
  queue-token audit history (Proposed). Department, room, and floor CRUD remain out of scope.

Server-side authorization is mandatory. Hiding a frontend route is not authorization. The server
derives the authenticated user, role, patient identity, staff department, and account status from
its own database record for the user identified by the verified JWT, on every request. It never
trusts a client-supplied `patientId`, `role`, or department assignment, and the `role` claim inside
the JWT is not used for authorization.

JWTs are signed with HS256 using the server's `AUTH_SECRET` and expire after `AUTH_TOKEN_EXPIRES_IN`
(default `1h`). There is no refresh or logout endpoint; clients sign out by discarding the token.

### Account status (Proposed)

Staff accounts can be deactivated by an admin (see [Admin: staff accounts](#admin-staff-accounts-proposed)).

- A deactivated account cannot sign in. After the password has been verified, `POST /api/auth/login`
  returns `403 FORBIDDEN` with the message "This account is deactivated. Contact an administrator."
  An incorrect password still returns the generic `401` response, so account status is never
  revealed to someone without the password.
- Any request carrying a token for a deactivated account returns `401 UNAUTHORIZED`. This takes
  effect immediately for existing sessions, because the user record is loaded on every request,
  and makes clients clear the stored session.
- Reactivating an account restores access; previously issued tokens work again until they expire.

## Authentication and patient profile

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | Public | Register a fictional demo patient, assign the `patient` role, and automatically sign them in. |
| `POST` | `/api/auth/login` | Public | Authenticate and issue a JWT. |
| `GET` | `/api/auth/me` | Any authenticated role | Return the authenticated user. |
| `GET` | `/api/patients/me` | Patient | Return the patient's own profile. |
| `GET` | `/api/patients/me/queue-tokens/active` | Patient | Return the patient's active tokens, if any. |

### Login example

`POST /api/auth/login`

```json
{ "identifier": "demo.patient", "password": "demo-password" }
```

```json
{
  "data": {
    "accessToken": "<jwt>",
    "user": { "id": "user_demo_01", "name": "Asha Devi", "role": "patient" }
  }
}
```

Incorrect usernames and incorrect passwords both return the same `401` message, "Invalid username
or password". Usernames are matched case-insensitively.

### Patient registration example

`POST /api/auth/register`

```json
{
  "name": "Asha Devi",
  "identifier": "demo.patient",
  "password": "demo-password",
  "preferredLanguage": "hi"
}
```

```json
{
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "user_demo_01",
      "name": "Asha Devi",
      "role": "patient",
      "preferredLanguage": "hi"
    }
  }
}
```

The response is `201 Created` and automatically signs in the newly registered patient. Fields:

- `name`: required, up to 100 characters.
- `identifier`: the required, unique username. It must be 3–30 characters using letters, numbers,
  dots, hyphens, or underscores, and is stored in lower case.
- `password`: required, 8–128 characters.
- `preferredLanguage`: optional, and must be a supported language code (currently `en` or `hi`).

The request must not accept a role, patient ID, staff department, or admin privileges; such fields
are rejected with `400`. A duplicate username returns `409 CONFLICT`. Passwords are stored using a
password-hashing algorithm (scrypt) and never in plaintext.

### Current-user responses

`GET /api/auth/me` and `GET /api/patients/me` both return the safe user object:

```json
{ "data": { "user": { "id": "665f…", "name": "Asha Devi", "role": "patient", "preferredLanguage": "hi" } } }
```

**Proposed:** for `staff` users, `user` additionally includes `departmentId` (string or `null`) in
the login and `/api/auth/me` responses. The staff UI needs it to open the correct department queue;
today the client has to guess it and relies on the server's `403`. `departmentId` is display
information only and never authorizes anything.

## Departments, rooms, and navigation map

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/departments` | Authenticated | List active OPD departments. |
| `GET` | `/api/departments/:departmentId` | Authenticated | Get department and location summary. |
| `GET` | `/api/rooms?floor=&departmentId=&page=&limit=` | Authenticated | List rooms/facilities. |
| `GET` | `/api/rooms/:roomId` | Authenticated | Get room and map-location details. |
| `GET` | `/api/map/floors` | Authenticated | List floors available to the 2D navigation UI. |
| `GET` | `/api/map/floors/:floorId` | Authenticated | Return one floor's SVG-safe map metadata, rooms, departments, and facilities. |

These endpoints are read-only. Only active records are returned; inactive or unknown IDs return
`404`. The `floor` query parameter of `/api/rooms` is a floor ID (for example `floor_ground`).

Map responses should contain only presentation/location metadata needed by the 2D UI; no patient or
operational queue data is included. The map shows where locations are; it does not calculate routes
or give directions (future scope).

`GET /api/map/floors` returns a list of floor summaries without `locations`:

```json
{
  "data": [
    {
      "id": "floor_ground",
      "displayName": "Ground Floor",
      "width": 1000,
      "height": 700,
      "coordinateOrigin": "top-left",
      "coordinateUnit": "map-unit"
    }
  ]
}
```

### Basic 2D floor-map response

`GET /api/map/floors/:floorId` returns one floor plan using a top-left origin: `x` increases to the
right and `y` increases downward. The floor canvas and every location use the same numeric map-unit
coordinate system.

```json
{
  "data": {
    "id": "floor_ground",
    "displayName": "Ground Floor",
    "width": 1000,
    "height": 700,
    "coordinateOrigin": "top-left",
    "coordinateUnit": "map-unit",
    "locations": [
      {
        "id": "room_registration",
        "displayName": "Registration Desk",
        "roomType": "facility",
        "departmentId": null,
        "x": 80,
        "y": 120,
        "width": 180,
        "height": 100
      }
    ]
  }
}
```

Each room or facility has a stable ID, display name, numeric coordinates and dimensions, plus a room
type and associated department when applicable. This supports rendering only; route-finding, 3D
maps, external map services, and other map dependencies are out of scope.

## Queue tokens

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/queue-tokens` | Patient | Create a token for the authenticated patient. |
| `GET` | `/api/queue-tokens/:tokenId` | Token owner, assigned-department staff, or admin | Return token details permitted for the caller. Also used for staff QR lookup. |
| `GET` | `/api/queue-tokens/:tokenId/status` | Token owner, assigned-department staff, or admin | Return patient-safe queue status. |
| `GET` | `/api/queues/:departmentId?page=&limit=` | Assigned-department staff or admin | Return a departmental queue. |
| `POST` | `/api/queues/:departmentId/call-next` | Assigned-department staff or admin | Call the next eligible waiting token. |
| `PATCH` | `/api/queue-tokens/:tokenId/status` | Assigned-department staff or admin | Update a consultation status. |

### Token creation example

`POST /api/queue-tokens`

```json
{ "departmentId": "dept_demo_opd" }
```

```json
{
  "data": {
    "id": "token_demo_101",
    "displayNumber": "OPD-101",
    "departmentId": "dept_demo_opd",
    "status": "waiting",
    "patientsAhead": 4,
    "estimatedWaitMinutes": 20,
    "estimateLabel": "Simulated estimate"
  }
}
```

The server derives the patient from the JWT. A patient may have one active token per department and
may hold active tokens in different departments. Active statuses are `waiting`, `called`, and
`in_consultation`; `completed`, `skipped`, and `cancelled` are terminal. Creating another active
token for the same patient and department returns `409 CONFLICT`. An unknown or inactive department
returns `404`.

The backend must enforce this rule safely under duplicate or concurrent creation requests so that
only one active token is created for a patient in a department. (Implemented with a partial unique
database index; requires MongoDB 6.0 or later.)

Token IDs are random, unguessable strings (for example `token_4836c8cdbe336eaf35b7a5e4`). Display
numbers use the department code and a per-department sequence (for example `OPD-001`).
`patientsAhead` counts waiting tokens issued earlier in the same department, and
`estimatedWaitMinutes` is `patientsAhead × 5`. Both are recalculated on every request. The patient
ID is never included in any token response.

### Patient-safe status lookup example

`GET /api/queue-tokens/token_demo_101/status`

```json
{
  "data": {
    "id": "token_demo_101",
    "displayNumber": "OPD-101",
    "status": "waiting",
    "patientsAhead": 4,
    "estimatedWaitMinutes": 20,
    "estimateLabel": "Simulated estimate"
  }
}
```

Estimated waiting times are simulated for the hackathon MVP and must always be labelled as such.

### Token QR codes

The QR workflow lets a patient show their token and lets staff in the token's department open it
quickly. **It does not need a new endpoint**: the existing `GET /api/queue-tokens/:tokenId` already
requires authentication, validates the token ID, and enforces staff department scope.

**QR payload (frontend-generated):** the text `sehatdarshak-token:<tokenId>`, for example
`sehatdarshak-token:token_4836c8cdbe336eaf35b7a5e4`.

- It contains only the random token ID: no patient name, username, user ID, JWT, or other personal
  information.
- The prefix lets the staff scanner reject QR codes that do not belong to SehatDarshak.
- **Possession of a QR code grants nothing.** The token ID is only a reference; every lookup still
  needs a valid staff or admin session and passes the department check.

**Patient side:** the token card and token status page show the QR code for **active** tokens only,
always together with the large display number (for example `OPD-001`) as a text alternative. No API
change is needed; the QR is generated in the browser from the token ID.

**Staff side:**

1. The staff screen scans the code with the device camera.
2. The client checks that the text starts with `sehatdarshak-token:` and that the ID matches
   `^[A-Za-z0-9_-]{1,64}$`. Anything else is an invalid QR, handled in the client without a request.
3. The client calls `GET /api/queue-tokens/:tokenId` with the staff JWT.
4. The client shows the token and offers only the valid next statuses, using the existing
   `PATCH /api/queue-tokens/:tokenId/status` (for example `called` → `in_consultation`).

| Situation | Behaviour |
| --- | --- |
| QR is not a SehatDarshak token, or the ID is malformed | Client shows "This QR code is not a SehatDarshak token"; no request is sent. A malformed ID sent anyway returns `400`. |
| Token does not exist | `404 NOT_FOUND`: "Token not found". |
| Token belongs to another department (staff) | `404 NOT_FOUND`, the same response as a missing token, so other departments' tokens are not revealed. |
| Caller is a patient scanning someone else's code | `404 NOT_FOUND`. |
| No session, expired session, or deactivated account | `401 UNAUTHORIZED`; the client asks the user to sign in again. |
| Token is in a terminal status | `200` with the terminal status; no status actions are offered. |
| Camera permission denied, no camera, or unsupported browser | Client explains how to allow camera access and offers the fallback: choose the token from the department queue list. |
| Scan fails or times out | Client lets the user retry or use the queue list. |

Staff responses use the same token shape as patients and do not include the patient's identity.
Whether staff need a patient name to confirm identity at the counter is a
[team decision](#decisions-for-team-review).

### Queue status vocabulary and transitions

Valid statuses are `waiting`, `called`, `in_consultation`, `completed`, `skipped`, and `cancelled`.

| Current status | Allowed next status | Actor |
| --- | --- | --- |
| `waiting` | `called` | Assigned-department staff/admin via `call-next` |
| `waiting` | `cancelled` | Assigned-department staff/admin |
| `called` | `in_consultation`, `skipped`, `cancelled` | Assigned-department staff/admin |
| `in_consultation` | `completed`, `cancelled` | Assigned-department staff/admin |
| `completed`, `skipped`, `cancelled` | None (terminal) | — |

Patients cannot change any queue status. Invalid transitions return `409 CONFLICT`. Requesting
`called` through `PATCH` returns `409` with a message to use `call-next`, and an unknown status value
returns `400`.

Only one token may be `called` in a department at a time. A token in `in_consultation` does not
prevent staff from calling the next eligible `waiting` token.

### Departmental queue

`GET /api/queues/:departmentId` returns the department's **active** tokens in queue order, using the
token shape above, with pagination `meta`. Patient identities are never included. A staff member
requesting another department receives `403`.

### Staff queue actions

`POST /api/queues/dept_demo_opd/call-next`

Request body:

```json
{}
```

Response:

```json
{ "data": { "id": "token_demo_101", "displayNumber": "OPD-101", "status": "called" } }
```

`PATCH /api/queue-tokens/token_demo_101/status`

```json
{ "status": "in_consultation" }
```

```json
{ "data": { "id": "token_demo_101", "status": "in_consultation" } }
```

`call-next` may select the next eligible `waiting` token only when no token in that department is
`called`. If a token is already `called`, return `409 CONFLICT` and explain that the current called
token must move to `in_consultation`, `skipped`, or `cancelled` before another token can be called.
If no token is waiting, return `409 CONFLICT` with a message that the queue is empty.

`call-next` must be safe under duplicate or concurrent requests: the same `waiting` token must never
be called twice, and two tokens must not become `called` in the same department. The server must
make eligibility checking, selection, and transition an indivisible operation using any suitable
implementation strategy. Each request returns one safely called token or `409 CONFLICT` when it
cannot safely call one. (Implemented with an atomic `findOneAndUpdate` plus a partial unique index;
no database transactions are required.)

Status updates use compare-and-set: the change applies only if the token still has the status the
server validated against. If another request changed it first, the later request receives `409`.

Every successful `call-next` and `PATCH` status change will be recorded in the audit history
(Proposed; see [Admin: queue-token status audit history](#admin-queue-token-status-audit-history-proposed)).

## Assistance requests

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/assistance-requests` | Patient | Create a request to hospital staff. |
| `GET` | `/api/assistance-requests/me?page=&limit=` | Patient | List the patient's own requests and statuses. |
| `GET` | `/api/assistance-requests?status=&page=&limit=` | Assigned-department staff or admin | List requests within permitted scope. |
| `PATCH` | `/api/assistance-requests/:requestId/acknowledge` | Assigned-department staff or admin | Acknowledge a request. |

Assistance requests have only two MVP statuses: `open` when created and `acknowledged` when an
authorized staff member or admin acknowledges it. The only valid status transition is `open` to
`acknowledged`. Patients may create requests and view only their own requests. Staff may view and
acknowledge requests only for their assigned department; admins may do so for every department.
There is no `resolved` status or resolution endpoint in this MVP.

Implemented details:

- `location` is required (up to 200 characters) and `message` is required (up to 500 characters).
  Both are trimmed.
- A second acknowledgement returns `409`, and only one of several concurrent acknowledgements
  succeeds.
- Acknowledging another department's request returns `404`.
- Staff without an assigned department receive `403` on the list.
- Lists are ordered newest first.
- `GET /api/assistance-requests/me` items use the public shape (`id`, `status`, `createdAt`,
  `notice`).
- `GET /api/assistance-requests` items additionally include `departmentId`, `location`, and
  `message`, which staff need in order to help.

### Create and acknowledge examples

`POST /api/assistance-requests`

```json
{
  "departmentId": "dept_demo_opd",
  "location": "Ground floor registration desk",
  "message": "Need help finding the OPD"
}
```

```json
{
  "data": {
    "id": "assist_demo_01",
    "status": "open",
    "createdAt": "2026-10-24T10:00:00.000Z",
    "notice": "Request sent to hospital staff; this is not guaranteed emergency medical response."
  }
}
```

`PATCH /api/assistance-requests/assist_demo_01/acknowledge`

Request body:

```json
{}
```

Response:

```json
{ "data": { "id": "assist_demo_01", "status": "acknowledged" } }
```

Assistance requests are for hospital staff and must never be represented as a guaranteed emergency
medical response.

## Dashboard

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard/statistics` | Admin | Return basic aggregate operational counts and queue summaries for monitoring. |

Dashboard statistics must avoid unnecessary patient-sensitive information. Detailed queue monitoring
uses `GET /api/queues/:departmentId`, which admins may call for any department.

The implemented response shape is below. It is **pending team approval**; clients should not build
on it until it is approved.

```json
{
  "data": {
    "generatedAt": "2026-10-24T10:48:44.962Z",
    "queueTokens": {
      "total": 1,
      "active": 1,
      "byStatus": { "waiting": 1, "called": 0, "in_consultation": 0, "completed": 0, "skipped": 0, "cancelled": 0 }
    },
    "assistanceRequests": { "total": 0, "byStatus": { "open": 0, "acknowledged": 0 } },
    "departments": [
      {
        "id": "dept_demo_opd",
        "name": "Demo OPD",
        "code": "OPD",
        "queue": {
          "waiting": 1,
          "called": 0,
          "in_consultation": 0,
          "active": 1,
          "currentCalledDisplayNumber": null,
          "estimatedWaitMinutes": 5,
          "estimateLabel": "Simulated estimate"
        },
        "openAssistanceRequests": 0
      }
    ]
  }
}
```

Counts cover all time and come from stored records. `departments` lists active departments only.

## Admin: staff accounts (Proposed)

Admins create staff (doctor) accounts, assign or change their department, and activate or deactivate
them. These endpoints manage `staff` accounts only. They cannot create admins, change any user's
role, or modify patient accounts, and there is no public staff or admin registration. Admin accounts
are created by a maintainer directly in the database.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/admin/staff?departmentId=&isActive=&page=&limit=` | Admin | List staff accounts. |
| `POST` | `/api/admin/staff` | Admin | Create a staff account. |
| `PATCH` | `/api/admin/staff/:staffId` | Admin | Change department and/or active status. |

Staff account response shape (admins only):

```json
{
  "id": "6660…",
  "name": "Dr. Meera Rao",
  "identifier": "dr.meera",
  "role": "staff",
  "departmentId": "dept_demo_opd",
  "isActive": true,
  "createdAt": "2026-10-24T10:00:00.000Z",
  "updatedAt": "2026-10-24T10:00:00.000Z"
}
```

The password hash is never returned.

### List staff

`GET /api/admin/staff?departmentId=dept_demo_opd&isActive=true&page=1&limit=20` returns
`{ "data": [staff, …], "meta": { "page", "limit", "total" } }`, sorted by name.

- `departmentId` is an optional valid department ID.
- `isActive` is optional and must be `true` or `false`; anything else returns `400`.

### Create staff

`POST /api/admin/staff`

```json
{
  "name": "Dr. Meera Rao",
  "identifier": "dr.meera",
  "password": "an-initial-password",
  "departmentId": "dept_demo_opd"
}
```

Returns `201 Created` with `{ "data": staff }`. The new account always has `role: "staff"` and
`isActive: true`.

- `name`, `identifier`, and `password` follow the registration rules.
- `departmentId` must be an existing active department. Unknown or inactive departments return
  `404 NOT_FOUND`.
- A duplicate username returns `409 CONFLICT`.
- Unknown fields, including `role` and `isActive`, return `400`.
- The admin shares the initial password with the staff member outside the system.

### Update staff

`PATCH /api/admin/staff/:staffId`

```json
{ "departmentId": "dept_demo_cardio", "isActive": false }
```

Returns `200` with `{ "data": staff }`.

- At least one of `departmentId` (an existing active department; `null` is not allowed) or
  `isActive` (boolean) is required.
- Other fields return `400`.
- `:staffId` must identify a user with role `staff`. Unknown users, patients, and admins return
  `404 NOT_FOUND`, so admins cannot be deactivated or re-assigned through this endpoint.
- Changes take effect on the staff member's next request, because the server loads the user on every
  request. A re-assigned staff member immediately loses access to the old department and gains
  access to the new one. A deactivated staff member receives `401` from then on (see
  [Account status](#account-status-proposed)).

### Errors (all staff-account endpoints)

| Situation | Response |
| --- | --- |
| No or invalid token | `401 UNAUTHORIZED` |
| Patient or staff caller | `403 FORBIDDEN` |
| Invalid body, query, or ID | `400 VALIDATION_ERROR` with `details` |
| Unknown department, or staff ID not found | `404 NOT_FOUND` |
| Duplicate username | `409 CONFLICT` |

## Admin: queue-token status audit history (Proposed)

Every **successful** queue-token status change is recorded on the server. This covers `call-next`
(`waiting` → `called`) and every successful `PATCH /api/queue-tokens/:tokenId/status`. Records are
written only by the server, from the verified user and the database state, and are never accepted
from clients. There is no endpoint to create, edit, or delete audit records.

Each audit entry contains:

| Field | Meaning |
| --- | --- |
| `id` | Stable entry ID |
| `tokenId`, `displayNumber` | The token that changed |
| `departmentId` | The token's department |
| `fromStatus`, `toStatus` | Previous and new status |
| `action` | `call_next` or `status_update` |
| `actor.id`, `actor.role` | The authenticated user who made the change (`staff` or `admin`) |
| `occurredAt` | Server timestamp (ISO 8601) |

**Atomicity:** the audit entry is appended inside the same single-document atomic update that
changes the token's status, as an embedded `statusHistory` entry on the token (see
[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)). A status change therefore cannot succeed without its
audit entry, or the other way round, and no MongoDB transactions are needed.

**Rejected or invalid changes:**

- No audit entry is written for a request that does not change the token: an invalid transition
  (`409`), a lost concurrent compare-and-set (`409`), `call-next` with no waiting token (`409`), an
  out-of-scope token (`404`), a forbidden role (`403`), or an invalid body (`400`).
- The audit history contains only changes that actually happened, so it never shows a misleading
  "successful change".
- Recording rejected attempts is out of scope for the MVP.

Token creation (no previous status) is not a status change and is not recorded; see
[Decisions for team review](#decisions-for-team-review).

### Read audit history

`GET /api/admin/audit/queue-token-status-changes?tokenId=&departmentId=&actorId=&from=&to=&page=&limit=`

| Query parameter | Rule |
| --- | --- |
| `tokenId`, `departmentId` | Optional valid resource IDs |
| `actorId` | Optional user ID |
| `from`, `to` | Optional ISO 8601 timestamps, inclusive; `from` must not be after `to` |
| `page`, `limit` | As elsewhere (limit max 100) |

Invalid values return `400`. Results are newest first:

```json
{
  "data": [
    {
      "id": "6661…",
      "tokenId": "token_4836c8cdbe336eaf35b7a5e4",
      "displayNumber": "OPD-001",
      "departmentId": "dept_demo_opd",
      "fromStatus": "called",
      "toStatus": "in_consultation",
      "action": "status_update",
      "actor": { "id": "6660…", "role": "staff" },
      "occurredAt": "2026-10-24T11:02:13.120Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1 }
}
```

Access: admins only. No token or an invalid token returns `401`; patients and staff receive `403`.
Entries contain no patient identity.

## Decisions for team review

- Supported preferred-language codes and the fallback language (backend currently accepts `en` and
  `hi`).
- Approval of the dashboard statistics response shape above.
- Status codes for deactivated accounts as proposed: `403` at login and `401` for existing sessions.
- Whether staff should see a patient name or other identity detail after a QR scan or in the queue
  (currently none is returned).
- Whether token creation should also appear in the audit history, and whether audit entries should
  include the actor's display name.
- Whether admins can reset staff passwords (not in scope yet), and how initial passwords are shared.
- Whether out-of-scope token and assistance lookups should keep returning `404` (current behaviour)
  instead of `403`.
- The canonical fixture `room_registration` is listed in `dept_demo_opd.roomIds` but has
  `departmentId: null` on the map, so `GET /api/rooms?departmentId=dept_demo_opd` does not return
  it. The team should decide which is correct.
- Data-retention/privacy rules beyond the MVP's fictional demo data, including audit retention.

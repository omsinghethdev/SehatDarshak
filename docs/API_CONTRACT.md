# API Contract (Draft)

> This is a draft for team review. It is not frozen automatically and must be agreed before routes, clients, models, or authorization are implemented.

## Scope and conventions

The API base path is **`/api`**. Every endpoint below shows its full path and uses JSON. This MVP uses fictional demo data only. It does not include email OTP, real hospital integrations, clinical triage, WebSockets, or guaranteed emergency-response functionality.

### Success responses

Successful responses use `data`, with optional `message` and `meta` for paginated lists.

```json
{
  "data": {},
  "message": "Optional human-readable message",
  "meta": { "page": 1, "limit": 20, "total": 42 }
}
```

Use `200 OK` for reads/updates, `201 Created` for new resources, and `204 No Content` only when a response body is unnecessary.

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

Use these codes consistently: `VALIDATION_ERROR` (`400`), `UNAUTHORIZED` (`401`), `FORBIDDEN` (`403`), `NOT_FOUND` (`404`), `CONFLICT` (`409`), and `INTERNAL_ERROR` (`500`). Do not expose stack traces or sensitive details.

For growing lists, accept `page` (default `1`) and `limit` (default `20`, maximum `100`) and return the `meta` object above.

## Authentication and authorization

Protected endpoints require:

```http
Authorization: Bearer <JWT>
```

Roles are `patient`, `staff`, and `admin`.

- **patient**: may access only their own profile, tokens, and assistance requests.
- **staff**: may view and manage only queues and assistance requests for their assigned department.
- **admin**: may access basic dashboard statistics and queue monitoring. Department, room, and staff-management CRUD are out of scope for this MVP.

Server-side authorization is mandatory. Hiding a frontend route is not authorization. The server must derive the authenticated user, role, patient identity, and staff department from the verified JWT/session data; it must never trust a client-supplied `patientId`, `role`, or department assignment.

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

The response is `201 Created` and automatically signs in the newly registered patient. `identifier` is the required, unique username; `password` is required and must contain at least 8 characters; `preferredLanguage` is optional and must be a supported language code. The request must not accept a role, patient ID, staff department, or admin privileges. Passwords must be stored using an appropriate password-hashing algorithm and never in plaintext.

For login, `identifier` is the unique username and `password` is the account password. A successful `POST /api/auth/login` returns the JWT and user object shown above.

## Departments, rooms, and navigation map

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/departments` | Authenticated | List active OPD departments. |
| `GET` | `/api/departments/:departmentId` | Authenticated | Get department and location summary. |
| `GET` | `/api/rooms?floor=&departmentId=&page=&limit=` | Authenticated | List rooms/facilities. |
| `GET` | `/api/rooms/:roomId` | Authenticated | Get room and map-location details. |
| `GET` | `/api/map/floors` | Authenticated | List floors available to the 2D navigation UI. |
| `GET` | `/api/map/floors/:floorId` | Authenticated | Return one floor's SVG-safe map metadata, rooms, departments, and facilities. |

Map responses should contain only presentation/location metadata needed by the 2D UI; no patient or operational queue data is included.

### Basic 2D floor-map response

`GET /api/map/floors/:floorId` returns one floor plan using a top-left origin: `x` increases to the right and `y` increases downward. The floor canvas and every location use the same numeric map-unit coordinate system.

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

Each room or facility has a stable ID, display name, numeric coordinates and dimensions, plus a room type and associated department when applicable. This supports rendering only; route-finding, 3D maps, external map services, and other map dependencies are out of scope.

## Queue tokens

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/queue-tokens` | Patient | Create a token for the authenticated patient. |
| `GET` | `/api/queue-tokens/:tokenId` | Token owner, assigned-department staff, or admin | Return token details permitted for the caller. |
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

The server derives the patient from the JWT. A patient may have one active token per department and may hold active tokens in different departments. Active statuses are `waiting`, `called`, and `in_consultation`; `completed`, `skipped`, and `cancelled` are terminal. Creating another active token for the same patient and department returns `409 CONFLICT`.

The backend must enforce this rule safely under duplicate or concurrent creation requests so that only one active token is created for a patient in a department.

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

### Queue status vocabulary and transitions

Valid statuses are `waiting`, `called`, `in_consultation`, `completed`, `skipped`, and `cancelled`.

| Current status | Allowed next status | Actor |
| --- | --- | --- |
| `waiting` | `called` | Assigned-department staff/admin via `call-next` |
| `waiting` | `cancelled` | Assigned-department staff/admin |
| `called` | `in_consultation`, `skipped`, `cancelled` | Assigned-department staff/admin |
| `in_consultation` | `completed`, `cancelled` | Assigned-department staff/admin |
| `completed`, `skipped`, `cancelled` | None (terminal) | — |

Patients cannot change any queue status. Invalid transitions return `409 CONFLICT`.

Only one token may be `called` in a department at a time. A token in `in_consultation` does not prevent staff from calling the next eligible `waiting` token.

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

`call-next` may select the next eligible `waiting` token only when no token in that department is `called`. If a token is already `called`, return `409 CONFLICT` and explain that the current called token must move to `in_consultation`, `skipped`, or `cancelled` before another token can be called.

`call-next` must be safe under duplicate or concurrent requests: the same `waiting` token must never be called twice, and two tokens must not become `called` in the same department. The server must make eligibility checking, selection, and transition an indivisible operation using any suitable implementation strategy. Each request returns one safely called token or `409 CONFLICT` when it cannot safely call one.

## Assistance requests

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/assistance-requests` | Patient | Create a request to hospital staff. |
| `GET` | `/api/assistance-requests/me?page=&limit=` | Patient | List the patient's own requests and statuses. |
| `GET` | `/api/assistance-requests?status=&page=&limit=` | Assigned-department staff or admin | List requests within permitted scope. |
| `PATCH` | `/api/assistance-requests/:requestId/acknowledge` | Assigned-department staff or admin | Acknowledge a request. |

Assistance requests have only two MVP statuses: `open` when created and `acknowledged` when an authorized staff member or admin acknowledges it. The only valid status transition is `open` to `acknowledged`. Patients may create requests and view only their own requests. Staff may view and acknowledge requests only for their assigned department; admins may do so according to their role. There is no `resolved` status or resolution endpoint in this MVP.

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

Assistance requests are for hospital staff and must never be represented as a guaranteed emergency medical response.

## Dashboard

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard/statistics` | Admin | Return basic aggregate operational counts and queue summaries for monitoring. |

Dashboard statistics must avoid unnecessary patient-sensitive information. Department, room, and staff-management CRUD are out of scope for this MVP.

## Decisions for Team Review

- Supported preferred-language codes and the fallback language.
- Data-retention/privacy rules beyond the MVP's fictional demo data.

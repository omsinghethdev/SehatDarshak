# Shared Integration Contract

> Integration reference for separate frontend and backend contributors. It describes intended behavior. Which backend endpoints are implemented, implemented but needing verification, or only proposed is tracked in the [implementation status](API_CONTRACT.md#implementation-status) table; frontend status is reported per branch and is not claimed here.

## 1. Project scope and source of truth

SehatDarshak is a fictional-data hackathon MVP for government-hospital OPD queues, accessible language-aware patient flows, basic SVG-based 2D floor maps, staff assistance requests, staff (doctor) queue actions including token QR scanning, admin statistics/queue monitoring, admin staff-account management, and a protected audit history of queue-token status changes.

Roles are `patient`, `staff`, and `admin`; doctors use the `staff` role. The stack is React/Vite/JavaScript/Tailwind on the client; Node/Express/REST JSON on the server; MongoDB (Atlas in production) with Mongoose for persistence. The client polls for queue updates. Out of scope: route calculation or turn-by-turn navigation (future scope), live indoor positioning, 3D maps, department/room/floor create/edit/delete, public staff or admin registration, real hospital integrations, clinical triage, payments, prescriptions, medical records, emergency dispatch, WebSockets, and email OTP.

- [API_CONTRACT.md](API_CONTRACT.md) is authoritative for endpoint behavior, authorization, status values, request/response envelopes, and errors.
- This document is authoritative for frontend/backend ownership and integration conventions.
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) records the persistence model (implemented and proposed parts). If it conflicts with the API contract, stop and raise the gap; do not guess.

## 2. Ownership boundaries

| Area | Frontend (`client/`) | Backend (`server/`) |
| --- | --- | --- |
| UI | Pages, components, routing, forms, accessibility, language selection, and loading/error/empty states. | No UI implementation. |
| API and auth | Central API client, Bearer-token storage/attachment, UI state, and rendering responses. | Express routes, validation, authentication, authorization, consistent JSON and errors. |
| Data and rules | Contract-compatible mocks only; no direct database access. | MongoDB persistence, seed/demo data, models, services, and queue/assistance business rules. |
| Security | May hide unavailable UI but must not rely on that for security. | Enforces every permission, ownership rule, department scope, and concurrency constraint. |

Each contributor works only in their assigned source directory. Neither contributor edits the other contributor's source directory or independently changes shared contracts.

## 3. Shared data models

All IDs are strings in API JSON. Timestamps are ISO 8601 strings. Fields below are limited to the current documents; `TODO — team decision` means clients must not invent a value.

### User

| Public/API response | Request-only | Server-only |
| --- | --- | --- |
| `id: string`, `name: string`, `role: "patient" \| "staff" \| "admin"`, `preferredLanguage?: string`; **Proposed:** `departmentId?: string \| null` for `staff` users only | `identifier: string` (unique username), `password: string` for register/login | `passwordHash`, account status (`isActive`, Proposed), authorization claims/source |

Public registration accepts `name`, `identifier`, `password` (minimum 8 characters), and optional supported `preferredLanguage`. It always creates a `patient`; it cannot assign a role or staff department.

A staff user's `departmentId` in login and `/api/auth/me` responses is Proposed. It lets the staff UI open the right queue, but it is display information only: the server re-checks the assignment on every request.

```json
{
  "id": "user_demo_01",
  "name": "Asha Devi",
  "role": "patient",
  "preferredLanguage": "hi"
}
```

### Department

| Public/API response | Request fields | Server-only |
| --- | --- | --- |
| `id: string`, `name: string`, `code: string`, `description?: string`, `floor?: string`, `roomIds?: string[]` | None in the current MVP | `isActive` and map metadata are controlled by the server |

`floor` is documented in the database schema while map routes use `floorId`; whether `floor` must equal the FloorMap ID is **TODO — team decision**. Do not rely on that relationship until it is confirmed.

```json
{
  "id": "dept_demo_opd",
  "name": "Demo OPD",
  "code": "OPD",
  "floor": "floor_ground",
  "roomIds": ["room_registration"]
}
```

### Room

| Public/API response | Request fields | Server-only |
| --- | --- | --- |
| `id: string`, `name: string`, `roomNumber?: string`, `floorId: string`, `type: string`, `departmentId?: string`, `mapPosition: { x, y, width, height }`, `isAccessible?: boolean` | None in the current MVP | `isActive` |

`x`, `y`, `width`, and `height` are numbers in the floor's map-unit system.

```json
{
  "id": "room_registration",
  "name": "Registration Desk",
  "floorId": "floor_ground",
  "type": "facility",
  "mapPosition": { "x": 80, "y": 120, "width": 180, "height": 100 }
}
```

### FloorMap

| Public/API response | Request fields | Server-only |
| --- | --- | --- |
| `id: string`, `displayName: string`, `width: number`, `height: number`, `coordinateOrigin: "top-left"`, `coordinateUnit: "map-unit"`, `locations: RoomOrFacility[]` | Path parameter `floorId` | Source/authoring details |

`locations` use stable IDs, display names, `roomType`, optional `departmentId`, and numeric `x`, `y`, `width`, and `height`. The origin is top-left; `x` grows rightward and `y` downward. Map data contains no patient or queue data.

```json
{
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
```

### QueueToken

| Public/API response | Request fields | Server-only |
| --- | --- | --- |
| `id: string`, `displayNumber: string`, `departmentId: string`, `status`, `patientsAhead: number`, `estimatedWaitMinutes: number`, `estimateLabel: "Simulated estimate"` | Create: `departmentId`; status update: `status` | `patientId`, timestamps, ordering/selection data, authorization decisions |

Valid status values are `waiting`, `called`, `in_consultation`, `completed`, `skipped`, and `cancelled`. Active: `waiting`, `called`, `in_consultation`. Terminal: `completed`, `skipped`, `cancelled`. The API contract defines valid transitions. Patients never send a patient ID or update status. The token's status history (audit entries, Proposed) is server-only and is never part of this response.

**Token QR code:** the frontend encodes exactly `sehatdarshak-token:<id>` and nothing else (no names, user IDs, or JWTs), and always shows `displayNumber` as text beside it. Staff scanning uses the existing `GET /api/queue-tokens/:tokenId`; possession of a QR code never grants access. See [API_CONTRACT.md → Token QR codes](API_CONTRACT.md#token-qr-codes) for scanner validation and error handling.

```json
{
  "id": "token_demo_101",
  "displayNumber": "OPD-101",
  "departmentId": "dept_demo_opd",
  "status": "waiting",
  "patientsAhead": 4,
  "estimatedWaitMinutes": 20,
  "estimateLabel": "Simulated estimate"
}
```

### AssistanceRequest

| Public/API response | Request fields | Server-only |
| --- | --- | --- |
| `id: string`, `status: "open" \| "acknowledged"`, `createdAt: string`, `notice: string` | Create: `departmentId`, `location`, `message`; acknowledge: no body | `patientId`, `acknowledgedBy`, `acknowledgedAt`, authorization decisions |

The only transition is `open` to `acknowledged`. It is a staff-assistance request, never a guaranteed emergency medical response.

```json
{
  "id": "assist_demo_01",
  "status": "open",
  "createdAt": "2026-10-24T10:00:00.000Z",
  "notice": "Request sent to hospital staff; this is not guaranteed emergency medical response."
}
```

### DashboardStatistics

| Public/API response | Request fields | Server-only |
| --- | --- | --- |
| Basic aggregate operational counts and queue summaries | None in the current contract | Any patient-level data, calculation inputs, and authorization decisions |

The backend implements the shape documented in [API_CONTRACT.md → Dashboard](API_CONTRACT.md#dashboard). That shape is **pending team approval**: frontend must not build against it, or invent other field names, until it is approved.

### StaffAccount (Proposed, admin only)

| Public/API response (admins only) | Request fields | Server-only |
| --- | --- | --- |
| `id`, `name`, `identifier`, `role: "staff"`, `departmentId`, `isActive`, `createdAt`, `updatedAt` | Create: `name`, `identifier`, `password`, `departmentId`; update: `departmentId?`, `isActive?` | `passwordHash` |

Admins cannot set `role`, create admins, or modify patients through these endpoints.

### QueueTokenStatusChange (Proposed audit entry, admin only)

| Public/API response (admins only) | Request fields | Server-only |
| --- | --- | --- |
| `id`, `tokenId`, `displayNumber`, `departmentId`, `fromStatus`, `toStatus`, `action: "call_next" \| "status_update"`, `actor: { id, role }`, `occurredAt` | None. Entries are created only by the server on successful status changes. | Storage location (embedded `statusHistory`) |

Audit entries contain no patient identity, and clients can never create, edit, or delete them.

## 4. API integration rules

- Configure the client base URL with the existing `VITE_API_BASE_URL` variable; the local example is `http://localhost:5000/api` (use the server's actual `PORT`, for example `5001` on macOS when port 5000 is taken by AirPlay Receiver). Do not hardcode production URLs or secrets.
- Use one centralized client-side API module under `client/src/services/`. It owns JSON serialization, base URL handling, and `Authorization: Bearer <JWT>` for protected calls.
- Send and read JSON envelopes exactly as defined in [API_CONTRACT.md](API_CONTRACT.md): successful payloads use `data` with optional `message`/`meta`; errors use `error.code`, `error.message`, and optional `error.details`.
- Treat `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, and `INTERNAL_ERROR` as explicit UI states. Show accessible, actionable messages; do not expose internal error details.
- The API client may remove/clear local authentication state after `UNAUTHORIZED`; redirect behavior is a frontend decision. Server authorization remains mandatory.
- A `NOT_FOUND` for a specific token or assistance request can also mean "not yours / not your department"; show a neutral "not found or not available to you" message.
- Do not invent endpoints, request fields, response fields, or status values. Report contract gaps before implementing them.

## 5. Shared workflow and feature ownership

| Feature | Frontend responsibility | Backend responsibility | Contract reference |
| --- | --- | --- | --- |
| Registration/login | Forms, token handling, validation/error UI | Register/login, JWT issuance, password hashing | API: Authentication |
| Patient dashboard/active tokens | Display `/me` and active-token state | Ownership-filtered profile/token reads | API: Authentication and patient profile |
| Token creation/tracking | Department selection, token/status UI, simulated-estimate label | Per-department active-token constraint, status reads | API: Queue tokens |
| Departments, rooms, 2D map | Browsing UI and SVG rendering with text alternatives | Read endpoints and coordinate data | API: Departments, rooms, and navigation map |
| Staff queue management | Queue view, call-next/status controls and conflict UI | Department authorization, transitions, concurrent `call-next` safety | API: Queue tokens |
| Assistance requests | Create/list/acknowledgement UI and non-emergency notice | Department-scoped access and `open` → `acknowledged` rule | API: Assistance requests |
| Admin statistics/monitoring | Aggregate dashboard and queue-monitoring UI | Admin-only aggregate statistics, no unnecessary patient data | API: Dashboard |
| Token QR codes | Patient QR display with text alternative; staff camera scanner, payload validation, camera-denied and scan-failure fallbacks | Existing authenticated, department-scoped token lookup and status update | API: Token QR codes |
| Staff account management (Proposed) | Admin UI to list, create, re-assign, activate, and deactivate staff | Admin-only endpoints, `staff`-only scope, deactivation enforced on every request | API: Admin: staff accounts |
| Audit history (Proposed) | Admin read-only audit list with filters | Atomic, server-only recording of successful status changes; admin-only read endpoint | API: Admin: queue-token status audit history |

Frontend and backend can progress independently with contract-compliant mock/seed data, then integrate against the real API.

## 6. Shared demo data

This document is the canonical fixture reference for the small shared demo set. Frontend-only mocks belong under `client/src/` and backend-persisted seeds belong under `server/src/`; they are separate copies and must match these IDs, labels, relationships, and status values.

| Entity | Canonical fictional value |
| --- | --- |
| Patient | `user_demo_01`, Asha Devi, username `demo.patient`, role `patient` |
| Department | `dept_demo_opd`, Demo OPD, code `OPD` |
| Floor | `floor_ground`, Ground Floor, `1000 × 700` map units |
| Facility | `room_registration`, Registration Desk, `facility`, at `(80, 120, 180, 100)` |
| Token | `token_demo_101`, `OPD-101`, `waiting`, department `dept_demo_opd` |
| Assistance request | `assist_demo_01`, `open`, department `dept_demo_opd` |
| Staff (Proposed) | username `demo.staff`, Demo Staff, role `staff`, department `dept_demo_opd` |
| Admin (Proposed) | username `demo.admin`, Demo Admin, role `admin` |

The backend seed (`npm run seed`) currently loads only the floor, department, and facility. The patient, token, assistance request, and the proposed staff and admin demo accounts are not seeded yet. Demo account passwords must be set locally and never shared as real credentials.

Never use real patient information, real credentials, production secrets, or external hospital data. Frontend mocks are display/development data only; backend seeds are persisted demo data only. Password examples must never become real shared credentials.

## 7. Integration and acceptance checklist

- [ ] Client uses `VITE_API_BASE_URL`; no production URL or secret is hardcoded.
- [ ] Request/response field names and JSON envelopes match [API_CONTRACT.md](API_CONTRACT.md).
- [ ] Registration and login handle success and invalid credentials; protected calls send a Bearer token.
- [ ] Patient ownership and staff department authorization are enforced by the server and represented in UI states.
- [ ] Duplicate active-token creation and invalid transitions produce `409 CONFLICT`; concurrent `call-next` cannot call a token twice or call two tokens in one department.
- [ ] Map renders the documented coordinates and provides a text alternative.
- [ ] Assistance requests create as `open` and authorized acknowledgement changes them to `acknowledged`.
- [ ] Loading, validation, unauthorized, forbidden, not-found, conflict, server-error, empty, responsive, and keyboard/screen-reader states are handled.
- [ ] Client and server local environments are configured, start independently, and the client can reach `/api`.
- [ ] Token QR codes contain only `sehatdarshak-token:<id>`, appear only for active tokens with the display number as text, and staff scanning handles invalid codes, `401`, `404`, camera denial, and scan failure.
- [ ] Staff UI uses the server-provided department (Proposed `departmentId`) and handles `403` for other departments.
- [ ] Admin staff management and audit history UIs are reachable only for admins and handle `401`/`403`/`400`/`404`/`409` (after the Proposed endpoints are implemented).
- [ ] A deactivated staff account is signed out on its next request (`401`) and sees the deactivation message at login (after implementation).

## 8. Working agreement for separate AI agents

> Read this document plus the relevant API and database docs before changing code. Work only in your assigned source directory. Do not independently change shared contracts. If a contract gap blocks work, report it instead of inventing behavior. Use mock data only where appropriate and keep it contract-compatible. Report files changed, commands/tests run, and remaining integration gaps. Never commit or push automatically.

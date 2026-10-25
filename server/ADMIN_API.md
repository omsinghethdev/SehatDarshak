# Admin & hospital operations API (server reference)

Endpoints, request/response shapes, permissions, and metric definitions for the admin features
added on top of [docs/API_CONTRACT.md](../docs/API_CONTRACT.md). They follow that contract's
conventions: base path `/api`, Bearer JWT, `{ data, message?, meta? }` responses,
`{ error: { code, message, details? } }` errors, `page`/`limit` pagination (limit ≤ 100), unknown
body fields rejected with `400`.

> **Status:** implemented and covered by `server/tests` (see the final section). Per
> [SHARED_INTEGRATION_CONTRACT.md §8](../docs/SHARED_INTEGRATION_CONTRACT.md#8-working-agreement-for-separate-ai-agents),
> the shared contract documents in `docs/` were **not** edited. This file is the proposal to fold
> into `docs/API_CONTRACT.md` and `docs/DATABASE_SCHEMA.md` after team review.

## Roles and permissions

Roles stay `patient`, `staff`, `admin` (the contract's role model). **Doctors are `staff` accounts
with `staffType: "doctor"`**; general staff have `staffType: "staff"` (or no value, for accounts
created earlier). `staffType` is an administrative category only — doctors have exactly the
department-scoped staff permissions, so the existing queue, token, and assistance rules apply
unchanged.

| Who | Access |
| --- | --- |
| Admin (active) | Everything under `/api/admin/*` and the existing admin endpoints. |
| Staff / doctor | Their assigned department's queue, tokens, and assistance requests (unchanged). `403` on every `/api/admin/*` endpoint. |
| Patient | Their own profile, tokens, and assistance requests (unchanged). `403` on every `/api/admin/*` endpoint. |
| Anyone | `POST /api/auth/register` always creates a `patient`. There is no public staff/admin registration, and no API creates admins or changes a role. |

Every `/api/admin/*` route passes through one router-level check (`authenticate` +
`authorizeRoles('admin')`), so no admin endpoint can be added without it.

**Account status** (contract's proposed rules, now implemented): a deactivated account gets `401`
on every request immediately (the user is loaded on each request), and `403` "This account is
deactivated…" at login — only after the password is verified, so status is not revealed to
someone without the password. Accounts without `isActive` (created earlier) are active.

**Credentials**
- `POST /api/admin/staff/:staffId/password-reset` (admin) issues a random temporary password,
  returned once with `Cache-Control: no-store`, never stored in plain text or logged. All existing
  sessions of that account stop working (tokens issued before the reset get `401`), and the account
  is flagged `mustChangePassword: true` (shown in login and `/auth/me` user objects only when true).
- `POST /api/auth/change-password` (any signed-in user) `{ currentPassword, newPassword }` →
  `{ data: { accessToken, user } }`. Earlier tokens stop working; the new token is returned.
  The flag is advisory: the API does not block other requests until the password is changed.
- **Rate limits** (in-memory, per server process): 10 wrong passwords per username + client
  address in 15 minutes → `429 TOO_MANY_REQUESTS` with `Retry-After`; 5 wrong current passwords
  per user in 15 minutes on change-password. `429` is a new error code (an additive extension of
  the contract's list).

## Time zone and periods

All dates are **service dates in the hospital time zone** (`HOSPITAL_TIMEZONE`, default
`Asia/Kolkata`). A token issued at 00:10 local time counts on that local day even though it is the
previous day in UTC.

Report endpoints accept `period`:

| `period` | Meaning |
| --- | --- |
| `today` | The current local date |
| `last7Days` | Today and the 6 days before it |
| `last30Days` | Today and the 29 days before it |
| `custom` | Requires `from` and `to` (`YYYY-MM-DD`, inclusive, `from ≤ to`, at most 366 days) |
| `all` | Visit list only: no date restriction |

`from`/`to` are rejected unless `period=custom`.

## Metric definitions

| Metric | Definition |
| --- | --- |
| Registered patients | Patient accounts that exist now (`registeredTotal`); created in the period (`registeredInPeriod`). |
| **Visit** (encounter) | One patient on one service date with at least one queue token. Several tokens and departments the same day are **one** visit. |
| Unique visiting patients | Distinct patients with ≥ 1 visit in the period. 3 visits on 3 days = 1 unique patient, 3 visits. `repeatVisitors` = patients with ≥ 2 visits in the period. |
| Department visit | One visit's use of one department (two tokens in the same department during one visit count once). |
| Tokens issued | Queue tokens issued in the period, broken down by their **current** status. |
| Consultations completed | Tokens moved to `completed` during the period (by `completedAt`). Issuing a token is never a consultation. |
| Visit status (derived) | `in_progress` (a token is waiting/called/in consultation), `completed` (no active token, ≥ 1 completed), `not_completed` (all tokens skipped/cancelled). Never stored. |
| Doctor attribution | The account that moved the token to `in_consultation` (from status history). Only `staffType: "doctor"` accounts appear in `byDoctor`; other completions are counted in `consultationsNotAttributedToDoctor` (started by general staff or an admin, or before history was recorded). |
| Current queue | Tokens waiting / called / in consultation right now (not period-based). |
| Assistance requests | Created in the period by current status; `currentlyOpen` = open now. |

Aggregate statistics never include patient names, usernames, or IDs.

## Endpoints

All require an active admin unless stated.

### Statistics — `GET /api/admin/statistics?period=&from=&to=&compare=`

`compare` (`true` default, or `false`) adds the same-length previous period.
`GET /api/dashboard/statistics` (all-time queue summary used by the current admin UI) is unchanged.

```json
{
  "data": {
    "generatedAt": "2026-03-08T06:00:00.000Z",
    "timeZone": "Asia/Kolkata",
    "period": { "key": "custom", "from": "2026-03-01", "to": "2026-03-07", "days": 7 },
    "patients": { "registeredTotal": 3, "registeredInPeriod": 0, "uniqueVisiting": 2, "repeatVisitors": 2 },
    "visits": { "total": 4, "today": 0, "departmentVisits": 5 },
    "queueTokens": {
      "issued": 6,
      "issuedByCurrentStatus": { "waiting": 1, "called": 0, "in_consultation": 0, "completed": 3, "skipped": 1, "cancelled": 1 },
      "consultationsCompleted": 3,
      "currentlyWaiting": 1,
      "currentlyActive": 1
    },
    "assistanceRequests": { "createdInPeriod": 0, "byStatus": { "open": 0, "acknowledged": 0 }, "currentlyOpen": 0 },
    "workforce": { "doctors": { "active": 2, "inactive": 0 }, "staff": { "active": 1, "inactive": 0 } },
    "trend": [{ "date": "2026-03-01", "visits": 0, "uniquePatients": 0, "tokensIssued": 0, "consultationsCompleted": 0 }],
    "byDepartment": [{
      "id": "dept_demo_opd", "name": "Demo OPD", "code": "OPD", "isActive": true,
      "departmentVisits": 3, "uniquePatients": 2, "tokensIssued": 4, "skipped": 1, "cancelled": 0,
      "consultationsCompleted": 2, "currentlyWaiting": 1
    }],
    "byWard": [{ "id": "ward_obs_1", "name": "Observation Ward", "code": "OBS-1", "visits": 1 }],
    "byDoctor": {
      "doctors": [{ "id": "66…", "name": "Dr. …", "departmentId": "dept_demo_opd", "departmentName": "Demo OPD", "consultationsCompleted": 2 }],
      "consultationsNotAttributedToDoctor": 1
    },
    "comparison": {
      "previousPeriod": { "from": "2026-02-22", "to": "2026-02-28", "days": 7 },
      "visits": { "current": 4, "previous": 1, "change": 3, "changePercent": 300 },
      "uniqueVisiting": { "current": 2, "previous": 1, "change": 1, "changePercent": 100 },
      "tokensIssued": { "current": 6, "previous": 1, "change": 5, "changePercent": 500 },
      "consultationsCompleted": { "current": 3, "previous": 1, "change": 2, "changePercent": 200 }
    }
  }
}
```

`trend` has one zero-filled entry per day. `byDepartment` lists every active department plus
inactive ones with activity in the period. `byDoctor.doctors` lists every active doctor (zero-filled)
plus inactive doctors with consultations in the period. `changePercent` is `null` when the previous
value is 0. Valid empty periods return zeros.

### Staff and doctor accounts — `/api/admin/staff`

Extends the contract's proposed staff-account endpoints (all of whose rules hold).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/staff?departmentId=&wardId=&staffType=doctor\|staff&isActive=true\|false&q=&page=&limit=` | List, sorted by name. `q` matches name, username prefix, or specialization (literal text, case-insensitive). |
| `POST` | `/api/admin/staff` | Create. |
| `GET` | `/api/admin/staff/:staffId` | One account. |
| `PATCH` | `/api/admin/staff/:staffId` | Update profile, assignment, or status. |
| `POST` | `/api/admin/staff/:staffId/password-reset` | Temporary password (see above). Body `{}`. |

Create:

```json
{
  "name": "Dr. Meera Rao", "identifier": "dr.meera", "password": "an-initial-password",
  "departmentId": "dept_demo_opd", "staffType": "doctor",
  "wardId": "ward_obs_1", "phone": "+91 90000 00000", "email": "meera@example.test",
  "designation": "Consultant", "specialization": "General Medicine", "registrationNumber": "REG/123"
}
```

Required: `name`, `identifier`, `password` (registration rules), `departmentId` (existing active
department, else `404`). Optional: `staffType` (default `staff`), `wardId` (active ward, else `404`),
`phone`, `email`, `designation`; `specialization` and `registrationNumber` only for doctors.
Professional details are free text the app cannot verify, so none is mandatory. `role`,
`isActive`, and any other field → `400`. Duplicate username (any role) → `409`.

Response (`201` / `200`):

```json
{
  "data": {
    "id": "6660…", "name": "Dr. Meera Rao", "identifier": "dr.meera", "role": "staff",
    "staffType": "doctor", "departmentId": "dept_demo_opd", "departmentName": "Demo OPD",
    "wardId": "ward_obs_1", "wardName": "Observation Ward", "isActive": true,
    "phone": "+91 90000 00000", "email": "meera@example.test", "designation": "Consultant",
    "specialization": "General Medicine", "registrationNumber": "REG/123",
    "mustChangePassword": false,
    "createdAt": "2026-10-25T10:00:00.000Z", "updatedAt": "2026-10-25T10:00:00.000Z"
  }
}
```

Update body: any of `name`, `departmentId` (not `null`), `wardId` (`null` unassigns), `staffType`,
`isActive`, `phone`, `email`, `designation`, `specialization`, `registrationNumber` (`null` clears).
Changing a doctor to `staffType: "staff"` clears doctor-only fields. Patients, admins, and unknown
IDs → `404`. Re-assignment and deactivation take effect on the account's next request. Concurrent
conflicting edits → `409` for the loser. Accounts are never deleted.

### Patients — `/api/admin/patients`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/patients?q=&page=&limit=` | Search by username prefix, name (contains), or exact account ID. |
| `GET` | `/api/admin/patients/:patientId` | Profile and visit summary. |

```json
{
  "data": {
    "id": "6660…", "name": "Asha Devi", "identifier": "demo.patient", "preferredLanguage": "hi",
    "isActive": true, "registeredAt": "2026-10-01T09:00:00.000Z",
    "visitSummary": {
      "totalVisits": 2, "firstVisitDate": "2026-03-02", "lastVisitDate": "2026-03-05",
      "tokensIssued": 4, "consultationsCompleted": 2, "activeTokens": 0, "assistanceRequests": 0,
      "departments": [{ "id": "dept_demo_opd", "name": "Demo OPD", "departmentVisits": 2 }]
    }
  }
}
```

Only stored registration fields are returned; the app holds no medical records.

### Visits — `/api/admin/visits`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/visits?period=&from=&to=&patientId=&departmentId=&wardId=&doctorId=&status=&page=&limit=` | Visits, newest first. Default period `last30Days`; `period=all` for full history (use with `patientId`). |
| `GET` | `/api/admin/visits/:visitId` | Visit with its tokens, departments, and status history. |
| `PATCH` | `/api/admin/visits/:visitId` | Correct administrative metadata: `{ "wardId": "ward_obs_1" \| null, "adminNote": "…" \| null }`. |

List item:

```json
{
  "id": "visit_20260302_6660…", "serviceDate": "2026-03-02", "status": "completed",
  "patient": { "id": "6660…", "name": "Asha Devi", "identifier": "demo.patient" },
  "departments": [{ "id": "dept_demo_opd", "name": "Demo OPD" }, { "id": "dept_test_med", "name": "Test Medicine" }],
  "ward": null, "tokenCount": 3, "consultationsCompleted": 2, "firstTokenAt": "2026-03-02T04:30:00.000Z"
}
```

Detail adds `adminNote` and `tokens[]` with `id`, `displayNumber`, `department`, `status`,
`issuedAt`, `calledAt`, `completedAt`, `consultedBy` (`{ id, name, role, staffType }` or `null`) and
`statusHistory[]`. Only `wardId` and `adminNote` (≤ 500 characters, administrative — not for
clinical information) can be corrected; tokens, statuses, dates, and patients cannot. Corrections
are audited; the note's text is not copied into the audit trail.

### Wards — `/api/admin/wards`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/wards?departmentId=&isActive=&page=&limit=` | List with department/floor names and active assigned staff counts. |
| `POST` | `/api/admin/wards` | `{ "name", "code" (2–16 letters/digits/hyphens, unique), "description"?, "departmentId"?, "floorId"? }` → ID `ward_<code>`. |
| `GET` | `/api/admin/wards/:wardId` | Details plus `visitsRecorded`. |
| `PATCH` | `/api/admin/wards/:wardId` | `name`, `description`, `departmentId`, `floorId` (`null` clears), `isActive`. The code/ID is permanent. |

No delete: wards are deactivated. Inactive wards cannot receive new staff or visit assignments.
Wards have no map geometry and never change departments, rooms, floors, the map, or QR behaviour.

### Departments — `/api/admin/departments` (read-only)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/departments` | All departments including inactive, with room and active-ward counts, workforce (doctors/staff active/inactive), and current queue. |
| `GET` | `/api/admin/departments/:departmentId?period=&from=&to=` | Adds rooms, wards, and period activity (`departmentVisits`, `uniquePatients`, `tokensIssued`, `issuedByCurrentStatus`, `consultationsCompleted`, `currentQueue`, `assistanceRequests`). |

Department create/edit stays out of scope (contract), so department, room, and floor IDs and map
connections are unchanged. Staff are assigned to departments through `PATCH /api/admin/staff/:id`.

### Audit history — `/api/admin/audit`

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/audit/queue-token-status-changes?tokenId=&departmentId=&actorId=&from=&to=&page=&limit=` | The contract's proposed endpoint, as specified (shape, filters, newest first, no patient identity). |
| `GET` | `/api/admin/audit/admin-actions?targetType=staff\|account\|visit\|ward&targetId=&actorId=&action=&from=&to=&page=&limit=` | Administrative actions. |

`from`/`to` are inclusive ISO 8601 timestamps. Admin-action entry:

```json
{
  "id": "6661…", "targetType": "staff", "targetId": "6660…", "targetName": "Dr. Meera Rao",
  "action": "staff_assignment_changed",
  "actor": { "id": "6650…", "role": "admin", "name": "Demo Admin" },
  "occurredAt": "2026-10-25T10:05:00.000Z",
  "changes": [{ "field": "departmentId", "from": "dept_demo_opd", "to": "dept_test_med" }]
}
```

Actions: `staff_created`, `staff_profile_updated`, `staff_assignment_changed`, `staff_deactivated`,
`staff_reactivated`, `staff_password_reset`, `password_changed`, `visit_metadata_corrected`,
`ward_created`, `ward_updated`, `ward_deactivated`, `ward_reactivated`. Changed values are recorded
for assignment and status fields; for phone, email, registration number, and visit notes only the
field name is recorded. Passwords, hashes, and tokens are never recorded. Visit entries name only
the visit; patient accounts are never named (`targetName: null`).

## Data model changes

| Collection | Change |
| --- | --- |
| `users` | `isActive` (default `true`; missing = active), `staffType`, `wardId`, `phone`, `email`, `designation`, `specialization`, `registrationNumber`, `passwordChangedAt`, `mustChangePassword`, `auditTrail[]` (not selected by default). New indexes on role/department/status, role/staffType, role/ward, audit time. |
| `queuetokens` | `visitId` (optional for older tokens), `statusHistory[]` (the contract's proposed embedded audit; not selected by default, never returned to patients or staff). New reporting indexes (`issuedAt`, `status`+`completedAt`, `visitId`, `patientId`+`issuedAt`, `statusHistory.occurredAt`). |
| `visits` (new) | `_id` = `visit_<YYYYMMDD>_<patientId>`, `patientId`, `serviceDate`, `firstTokenAt`, `wardId?`, `adminNote?`, `source` (`token`/`migration`/`correction`), `auditTrail[]`. Unique (`patientId`, `serviceDate`). |
| `wards` (new) | `_id` = `ward_<code>`, `name`, `code` (unique), `description?`, `departmentId?`, `floorId?`, `isActive`, `auditTrail[]`. |

**Atomicity without transactions.** Every audited change appends its audit entry in the **same
single-document atomic update** as the change (the contract's `statusHistory` approach), so a change
and its audit entry are written together or not at all. Edits use compare-and-set on the previous
values, so concurrent conflicting edits cannot both apply. This works on a standalone MongoDB, which
has no multi-document transactions.

**Visits** are opened when a patient's first token of the day is created (after the token exists,
so a visit never exists without a token). Reports group tokens by `visitId`, deriving it in the
hospital time zone for older tokens, so counts are correct even before the migration runs.

**Migration** (`npm run migrate:up` / `npm run migrate:down`): `up` links older tokens to their
visits and creates the missing visit records (idempotent). `down` removes exactly that, keeping
visit records an admin has corrected. Indexes are created by Mongoose at startup.

## Tests

`npm test` (MongoDB required, see README): `accountStatus`, `adminStaff`, `adminVisits`,
`adminWards`, `auditHistory`, and `dates` cover authorization for every admin endpoint
(none/invalid token, deactivated admin, patient, staff, doctor), creation/validation/duplicates,
filters, pagination, re-assignment effects, deactivation, concurrency, visit/unique-patient/
department-visit counts across a time-zone boundary, empty periods, the migration (up, re-run,
down), audit recording and redaction, and the existing APIs for regressions.

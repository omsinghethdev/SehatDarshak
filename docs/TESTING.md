# Testing

## How to run

```bash
cd server
npm test
```

- Tests use Node's built-in test runner (`node --test`).
- These files need a reachable MongoDB 6.0+ at `MONGODB_TEST_URI` (default `mongodb://127.0.0.1:27017`): `auth.routes`, `hospital.routes`, `seed`, `devSeed`, `queueTokens`, `queueOperations`, `assistanceRequests`, and `dashboard`.
- Each file uses its own `sehatdarshak_*_test` database and drops it afterwards.
- Without MongoDB those suites are **skipped**, not failed, so check that the summary reports `skipped 0`.

Last recorded run (2026-10-24, `main` branch): **154 tests, 154 passed, 0 failed, 0 skipped.**

The frontend has no automated test or lint scripts yet; frontend checks so far have been manual browser QA.

## Labels

- **Existing**: an automated test in `server/tests/` verifies the case today. The test is named as `file → test name`.
- **Planned**: required for agreed scope but not written yet. Every Planned case below belongs to a Proposed feature in [API_CONTRACT.md](API_CONTRACT.md), except where noted.

## RBAC and authentication

| Case | Expected | Status |
| --- | --- | --- |
| Registration with `role`, `departmentId`, `id`, or `patientId` in the body | `400`, no user created | Existing: `auth.routes → rejects attempts to set role, department, or IDs` |
| Registration always creates a `patient` | `201`, `role: "patient"` | Existing: `auth.routes → creates a patient, signs them in, and returns only safe user data` |
| Missing, malformed, or non-Bearer `Authorization` header | `401` | Existing: `auth.middleware → requests without an Authorization header are rejected`, `→ non-Bearer and malformed Authorization headers are rejected` |
| Tampered, wrong-key, expired, or `alg: none` JWT | `401` | Existing: `auth.middleware → tokens that are tampered, signed with another key, expired, or unsigned are rejected` |
| Valid JWT for a deleted user | `401` | Existing: `auth.middleware → tokens for users that no longer exist are rejected`; `auth.routes → rejects a valid token once the user has been deleted` |
| JWT `role` claim says `admin` for a patient | `403`; the stored role is used | Existing: `auth.middleware → role authorization uses the stored role, not the token role claim` |
| Allowed vs forbidden role for a protected route | `200` / `403` | Existing: `auth.middleware → role authorization allows permitted roles and forbids others` |
| Every hospital-data endpoint without or with an invalid token | `401` | Existing: `hospital.routes → every endpoint requires authentication` |
| Staff and admin reading departments, rooms, and map | `200` | **Planned** (currently tested with a patient token only) |
| Staff and admin calling `GET /api/auth/me` | `200` | **Planned** (currently tested with a patient only) |
| Admin calling `GET /api/patients/me` | `403` | **Planned** (staff → `403` is Existing: `auth.routes → is limited to authenticated patients`) |
| Invalid token on every queue and assistance endpoint | `401` | **Planned** (missing token is Existing on each endpoint; invalid token is covered centrally) |
| Login to a deactivated staff account with the correct password | `403` "account is deactivated" | **Planned** |
| Login to a deactivated account with a wrong password | `401` generic, status not revealed | **Planned** |
| Existing session of a staff member who is then deactivated | `401` on the next request | **Planned** |
| Reactivated staff can sign in and operate again | `200` | **Planned** |
| Staff `departmentId` returned by login and `/api/auth/me`; never for patients or admins | present / absent | Existing: `auth.routes → login and /auth/me return the assigned department for staff`; `→ unassigned staff get departmentId null`; `→ patients and admins never get a departmentId`; `→ a department change is reflected on the next /auth/me` |

## Patient data ownership

| Case | Expected | Status |
| --- | --- | --- |
| Another patient reads a token or its status | `404`, no details | Existing: `queueTokens → other patients get 404 without any token details` |
| Token and queue responses never include `patientId` | not present | Existing: `queueTokens → responses never expose the patient ID`; `queueOperations → does not expose patient information` |
| Active-token list contains only the caller's tokens | own tokens only | Existing: `queueTokens → lists only the caller's active tokens across departments` |
| Assistance `/me` contains only the caller's requests | own only | Existing: `assistanceRequests → lists only the caller's own requests, newest first, in the public shape` |
| Client-supplied `patientId`/`status` on create | `400` | Existing: `queueTokens → rejects client-supplied patient, status, or display-number fields`; `assistanceRequests → rejects invalid fields, client-supplied server fields, and unknown departments` |

## Staff department scope

| Case | Expected | Status |
| --- | --- | --- |
| Staff list another department's queue, or unassigned staff list any queue | `403` | Existing: `queueOperations → enforces role and department permissions` (list) |
| Staff call-next in another department | `403`, nothing called | Existing: `queueOperations → enforces role and department permissions` (call-next) |
| Staff update a token in another department | `404`, unchanged | Existing: `queueOperations → staff can only update tokens in their assigned department` |
| Staff read another department's token | `404` | Existing: `queueTokens → assigned-department staff and admins can read; other staff cannot` |
| Staff see only their department's assistance requests | own department only | Existing: `assistanceRequests → staff see only their department; admins see all departments` |
| Staff acknowledge another department's request | `404`, still open | Existing: `assistanceRequests → staff cannot acknowledge requests outside their department` |
| Re-assigned staff lose the old department and gain the new one immediately | `403`/`404` old, `200` new | **Planned** |

## Admin-only features

| Case | Expected | Status |
| --- | --- | --- |
| Dashboard: none or invalid token / patient / staff / admin | `401` / `403` / `403` / `200` | Existing: `dashboard → only admins may read statistics` |
| Dashboard has no write endpoints | `404` | Existing: `dashboard → no write or management endpoints exist under /api/dashboard` |
| Staff-account endpoints: none or invalid token / patient / staff | `401` / `403` / `403` | **Planned** |
| Admin creates staff; `role` and `isActive` in the body are rejected | `201`; `400` | **Planned** |
| Create staff with a duplicate username or unknown department | `409`; `404` | **Planned** |
| `PATCH` targets a patient or admin ID | `404`, unchanged | **Planned** |
| Password hash never returned by staff-account endpoints | not present | **Planned** |
| Audit endpoint: none or invalid token / patient / staff / admin | `401` / `403` / `403` / `200` | **Planned** |

## Token QR lookup

The QR lookup uses the existing `GET /api/queue-tokens/:tokenId`. Server-side behaviour is already covered; only client-side QR parsing and the deactivation case are new.

| Case | Expected | Status |
| --- | --- | --- |
| Malformed token ID | `400` | Existing: `queueTokens → missing, malformed, and unauthenticated lookups are rejected` |
| Unknown token ID | `404` | Existing: same test |
| Lookup without a session | `401` | Existing: same test |
| Staff of another department or unassigned staff | `404` | Existing: `queueTokens → assigned-department staff and admins can read; other staff cannot` |
| Same-department staff and admin | `200` | Existing: same test |
| Lookup by a deactivated staff account | `401` | **Planned** |
| QR text without the `sehatdarshak-token:` prefix, or with a malformed ID, is rejected without a request | client error message | **Planned (frontend)** |
| QR payload contains only the prefix and token ID | exact format | **Planned (frontend)** |
| Camera permission denied or no camera | fallback to the queue list | **Planned (frontend, manual QA)** |

## Audit history

| Case | Expected | Status |
| --- | --- | --- |
| Successful call-next records `waiting → called`, `action: call_next`, actor ID and role, department, timestamp | one entry | **Planned** |
| Each successful `PATCH` transition records the correct from/to statuses and actor | one entry per change | **Planned** |
| Invalid transition (`409`) | no entry | **Planned** |
| Losing a concurrent compare-and-set (`409`) | no entry; exactly one entry overall | **Planned** |
| call-next with nobody waiting, or with a token already called | no entry | **Planned** |
| Forbidden or out-of-scope status change (`403`/`404`) | no entry | **Planned** |
| Audit entries never appear in patient or staff token responses | not present | **Planned** |
| Audit filters (`tokenId`, `departmentId`, `actorId`, `from`/`to`) and pagination; invalid values | correct subset; `400` | **Planned** |

## Queue rules and concurrency (regression)

| Case | Expected | Status |
| --- | --- | --- |
| One active token per patient and department, including 10 concurrent requests | one `201`, rest `409` | Existing: `queueTokens → concurrent requests from one patient create exactly one active token`; `→ the database index rejects duplicate active tokens even without the API pre-check` |
| Every documented transition succeeds | `200` | Existing: `queueOperations → applies every documented transition` |
| Every other transition is rejected and the token is unchanged | `409` | Existing: `queueOperations → rejects every other transition with 409 and leaves the token unchanged` |
| `waiting → called` only through call-next | `409` | Existing: `queueOperations → waiting tokens can only be called through call-next` |
| Concurrent call-next calls exactly one token | one `200` | Existing: `queueOperations → concurrent call-next requests call exactly one token`; `→ repeated call-next rounds never call the same token twice` |
| Only one called token per department at the database level | rejected | Existing: `queueOperations → the database index rejects a second called token even without the API pre-check` |
| Conflicting concurrent status updates | exactly one applies | Existing: `queueOperations → concurrent conflicting updates apply exactly one transition` |
| Single acknowledgement under concurrency | one `200` | Existing: `assistanceRequests → concurrent acknowledgements succeed exactly once` |
| All existing tests keep passing after audit, staff-management, and deactivation are added | 154+ passing | **Planned** (regression gate) |

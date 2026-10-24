# Integration Audit — Frontend ↔ Backend

**Date:** 2026-10-24 · **Branch:** `integration` (from `main` at merge commit `0c31d7a`) · **Type:** inspection only, no code changed.

## Summary

The frontend (merged from `raunak`) already calls the correct backend endpoints with matching methods, request bodies, and response shapes. Integration is blocked mainly by **configuration and missing demo data**, not by incompatible code. A few response fields and one admin screen need small changes.

## What was verified

| Check | Result |
|---|---|
| Backend test suite (`npm test`) | **154 tests, 154 passed, 0 failed, 0 skipped** |
| Server start on port 5001, `GET /api/health` | `200` |
| `GET /api/departments` without a token | `401` |
| CORS preflight from `http://localhost:5173` (with `Authorization` header) | `204`, origin allowed |
| CORS preflight from `http://127.0.0.1:5173` | No `Access-Control-Allow-Origin` → blocked by browsers |
| Port 5000 on macOS | Taken by AirPlay Receiver (returns `403`) |
| Local database (read-only counts) | 1 department, 1 floor, 1 room, **0 users** |

**Not verified:** browser end-to-end flows against the real API, frontend production build (`vite build` writes `dist/`), frontend tests/lint (none exist).

Status labels used below: **Verified** (automated tests or live check), **Implemented, not verified**, **Partial**, **Mock only**, **Missing**.

## 1. Architecture overview

- **Frontend** (`client/`): React 19, Vite 6, React Router 7, Tailwind 4.
  - Each feature has a `mock*Service` and an `api*Service`; `VITE_AUTH_MODE` (`api` by default, or `mock`) selects one at startup ([serviceMode.js](../client/src/services/serviceMode.js)).
  - All HTTP goes through [apiClient.js](../client/src/services/apiClient.js): reads `{data, message, meta}`, maps errors to `ApiError` with contract codes, and logs the user out on `401`.
  - Session (`accessToken` + `user`) is stored in `localStorage` under `sehatdarsak.session`.
- **Backend** (`server/`): Express 5, Mongoose 8, JWT (HS256), scrypt password hashing.
  - `authenticate` loads the user from the database on every request; `authorizeRoles` and `canManageDepartment` enforce role and department scope.
  - Modules: auth, departments, rooms, map, tokens, queues, assistance, dashboard.

## 2. Existing features

| Area | Status |
|---|---|
| Patient: register, login, departments, floor map, book token, token status (15 s polling), turn alerts, assistance create and history | Backend **Verified**; frontend **Implemented, not verified** against the API |
| Staff: department queue, call-next, status update, assistance acknowledge | Backend **Verified**; cannot be tried in the browser because **no staff user exists** |
| Admin: dashboard statistics | Backend **Verified**; frontend **Partial** (fetches but does not render the data) |
| Admin: staff-account management, deactivation, audit history | **Missing** (Proposed in the API contract) |
| Token QR (patient view) and staff token scan | **Missing**. Existing QR support covers hospital, department, location, and queue URLs only |
| Queue demo controls, mock assistance acknowledgement, mock admin summary, staff/admin demo registration | **Mock only**; hidden automatically in API mode |
| English/Hindi UI, "Listen" (speech) button, loading/error/empty states, accessible map text list | **Implemented**; keep as is |

## 3. Authentication and role-based access

1. **Sign-in:** `POST /api/auth/login` with `{identifier, password}` returns `{accessToken, user: {id, name, role}}`. Frontend and backend shapes match.
2. **Identity:** the server reads the user ID from the JWT `sub` claim and loads the user from MongoDB. The stored role is used, never the role inside the token (**Verified**).
3. **Frontend route guards** (`ProtectedRoute`) are UI-only: patient → `/queue/*`, `/assistance`; staff and admin → `/staff/*`; admin → `/admin`.
4. **Direct API calls to another role's endpoints:** `403`; out-of-scope token or request lookups return `404` (**Verified** by tests, not manually).
5. **Staff department scope:** enforced on the server (**Verified**). The frontend is never told the staff member's `departmentId` (`toPublicUser` omits it), so it guesses the department.
6. **Gaps:** no `/api/auth/me` check when the app loads (the UI can show a stale role until a `401`); logout only clears the browser session, and the JWT stays valid until it expires (default 1 h).

## 4. Frontend–backend integration matrix

| Frontend action | API called | Backend route | Compatibility |
|---|---|---|---|
| Login / register | `POST /auth/login`, `POST /auth/register` | Exists | ✅ Match |
| Departments | `GET /departments`, `/departments/:id` | Exists | ✅ Match; only 1 department seeded |
| Floor map | `GET /map/floors`, `/map/floors/:id` | Exists | ✅ Match; only 1 floor and 1 room seeded |
| Active tokens | `GET /patients/me/queue-tokens/active` | Exists | ✅ Match |
| Book token | `POST /queue-tokens {departmentId}` | Exists | ✅ Match; `409` handled |
| Token status / polling | `GET /queue-tokens/:id`, `/queue-tokens/:id/status` | Exists | ✅ Match (`patientsAhead`, `estimatedWaitMinutes`) |
| Staff queue list | `GET /queues/:departmentId?page&limit` | Exists | ✅ Match |
| Call next | `POST /queues/:departmentId/call-next` | Exists | ✅ Match |
| Update status | `PATCH /queue-tokens/:id/status {status}` | Exists | ✅ Match |
| Create assistance request | `POST /assistance-requests` | Exists | ✅ Match (confirmation merges submitted fields) |
| Patient assistance history | `GET /assistance-requests/me` | Exists | ⚠️ Response lacks `message`, `location`, `departmentId`; cards show "not returned" |
| Staff assistance list / acknowledge | `GET /assistance-requests`, `PATCH /assistance-requests/:id/acknowledge` | Exists | ✅ Match |
| Admin dashboard | `GET /dashboard/statistics` | Exists | ⚠️ Fetched but not rendered |
| Staff's own department | — | Not returned | ⚠️ Frontend guesses the first department |
| Token QR and staff scan | — | Lookup endpoint exists | ❌ Not built in the frontend |

## 5. Integration blockers

### Critical

1. **No `client/.env`.** `VITE_API_BASE_URL` is empty, so every API call fails with `CONFIG_ERROR` ("The service address is not configured"). [client/.env.example](../client/.env.example) also points to port `5000`, which is AirPlay on macOS; the local server runs on `5001`.
2. **No users in the database and no way to create staff or admin accounts.** Public registration creates patients only, `/api/admin/staff` is still Proposed, and the seed has no users. Staff and admin flows cannot be tested.

### High

3. **Seed data is minimal.** [server/src/seed/demoData.js](../server/src/seed/demoData.js) has only `dept_demo_opd`, `floor_ground`, and `room_registration`. Frontend mocks have 4 departments, 3 floors, and about 18 locations; the frontend `staff_med` account type refers to `dept_demo_med`, which does not exist on the server.
4. **Staff `departmentId` is not returned.** `toPublicUser` in [user.model.js](../server/src/modules/users/user.model.js) omits it, so [useDepartmentSelection.js](../client/src/features/staff/useDepartmentSelection.js) guesses and staff get `403` on the wrong department.
5. **Admin dashboard does not display server data.** [AdminDashboardPage.jsx](../client/src/pages/AdminDashboardPage.jsx) shows "format not defined". The server shape (`queueTokens`, `assistanceRequests`, `departments[].queue`) needs mapping to the existing `OperationalSummary` component.

### Medium

6. **Token QR missing.** [TokenStatusPage.jsx](../client/src/pages/TokenStatusPage.jsx) shows no QR, and [qrPayload.js](../client/src/features/qr/qrPayload.js) has no `token` type. The docs propose `sehatdarshak-token:<tokenId>`, while the frontend uses `/scan?type=…` URLs; the team must pick one format.
7. **Patient assistance history lacks details.** `toPublicRequest` in [assistanceRequest.service.js](../server/src/modules/assistance/assistanceRequest.service.js) could return the patient's own `departmentId`, `location`, and `message`.

### Low

8. **CORS allows only `http://localhost:5173`.** `127.0.0.1` and LAN/phone origins are blocked; phone QR testing needs `CORS_ORIGIN` updated.
9. **Name typo "sehatdarsak"** in `client/package.json`, `localStorage` keys, and UI strings (English and Hindi).
10. **No session check on load, and logout is client-side only.**
11. **No frontend tests or lint scripts.**

## 6. Working functionality to preserve

- `apiClient`, its error codes, and automatic logout on `401`.
- All `api*Service` modules (they already follow the contract).
- Route guards (`ProtectedRoute`, `GuestRoute`) and post-login redirects.
- Token polling and turn alerts.
- i18n (English/Hindi), speech button, loading/error/empty/unauthorized states.
- SVG floor map with its text alternative.
- QR URL parser (origin-checked; never redirects to external URLs).
- All backend modules and the 154 backend tests.

## 7. Minimal integration plan

1. **Configuration:** create `client/.env` with `VITE_API_BASE_URL=http://localhost:5001/api` and `VITE_AUTH_MODE=api`; fix the port in `.env.example`. Run server and client; check patient register, login, and departments.
2. **Demo data:** add `dept_demo_med` and the map locations to the server seed, plus a development-only script to create demo staff and admin users (passwords from environment variables, never hardcoded).
3. **Patient flow end to end:** book token, status, polling, assistance. Little or no code change expected.
4. **Staff department:** return `departmentId` for staff in login and `/api/auth/me`; preselect it in the frontend.
5. **Staff flow:** queue, call-next, status update, acknowledge — test with a patient and a staff member in two browsers.
6. **Admin dashboard:** render the server statistics.
7. **Assistance history:** return the patient's own request details.
8. **Then new features:** token QR and staff scan, admin staff management, deactivation, audit history.

## 8. Verification checklist

- [ ] With the server running, the client calls `localhost:5001` (Network tab) and shows no `CONFIG_ERROR`.
- [ ] Patient registration returns `201`; a duplicate username shows a `409` error on the form.
- [ ] The session survives a page refresh; a tampered token in `localStorage` causes `401` and logout.
- [ ] Booking a token works; booking again in the same department shows `409`; the status page updates within 15 s.
- [ ] Staff "Call next" makes the patient's page show "called" and fires the turn alert.
- [ ] Staff opening another department's queue gets `403`; a patient opening `/staff/queue` goes to `/unauthorized`.
- [ ] `curl` to `/api/dashboard/statistics` with a patient token returns `403`.
- [ ] Assistance request: patient submits, staff acknowledges, patient sees "acknowledged".
- [ ] All pages work in Hindi and with keyboard-only navigation.

## 9. Files likely to change later

| File | Reason |
|---|---|
| `client/.env` (new), [client/.env.example](../client/.env.example) | API base URL and port 5001 |
| [server/src/seed/demoData.js](../server/src/seed/demoData.js), new dev user seed | Departments, map locations, staff/admin users |
| [server/src/modules/users/user.model.js](../server/src/modules/users/user.model.js) | Staff `departmentId` in `toPublicUser` |
| [useDepartmentSelection.js](../client/src/features/staff/useDepartmentSelection.js), [authStorage.js](../client/src/services/authStorage.js) | Use the staff department from the session |
| [AdminDashboardPage.jsx](../client/src/pages/AdminDashboardPage.jsx), [OperationalSummary.jsx](../client/src/features/admin/OperationalSummary.jsx) | Render server statistics |
| [assistanceRequest.service.js](../server/src/modules/assistance/assistanceRequest.service.js) | Patient history details |
| [TokenStatusPage.jsx](../client/src/pages/TokenStatusPage.jsx), [qrPayload.js](../client/src/features/qr/qrPayload.js), [ScanPage.jsx](../client/src/pages/ScanPage.jsx) | Token QR and staff scan |
| `server/.env` (`CORS_ORIGIN`) | Phone/LAN testing |
| [API_CONTRACT.md](API_CONTRACT.md), [SHARED_INTEGRATION_CONTRACT.md](SHARED_INTEGRATION_CONTRACT.md) | QR format decision, port 5001, `roomType` vocabulary |

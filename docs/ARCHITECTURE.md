# Architecture

## Overview

SehatDarshak uses a single React/Vite client, a single Express REST API, and MongoDB (Atlas in production) through Mongoose. This deliberately small architecture is suitable for a 2–3 person hackathon team and can be expanded only after the MVP is validated.

## Frontend

`client/src/features/` groups product areas such as registration, queue, navigation, assistance, staff, and admin. Shared presentational components live in `components/`; routes, API calls, i18n, hooks, and utilities have dedicated folders. The client polls the REST API for queue updates. Navigation is a basic SVG-based 2D floor map with room coordinates; route calculation, turn-by-turn directions, live indoor positioning, 3D maps, and external navigation APIs are out of scope. UI route visibility is only a usability measure; the server must authorize every protected request.

Token QR codes are generated and scanned in the browser. The patient view renders the QR from the token ID, and the staff view scans with the device camera. No QR data is stored on the server.

## Backend

`server/src/app.js` owns Express middleware and application wiring, and `routes/index.js` registers each module's router under `/api`. Domain-oriented routes, validation, services, and models live in their respective `modules/` folder. `middleware/` holds authentication, role authorization, and centralized error handling. `config/` holds configuration helpers (auth, CORS, database), while `utils/` contains small shared helpers such as request validation, password hashing, JWT handling, and department access checks. See [server/README.md](../server/README.md) for running, testing, and deployment.

## Database

MongoDB is the persistence layer, accessed through Mongoose models in each module. Queue invariants (one active token per patient and department, one called token per department) are enforced with partial unique indexes and atomic single-document updates, so no multi-document transactions are needed. See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## Request flow

1. A client feature calls a service in `client/src/services/`.
2. The service sends JSON to an Express route under `/api`.
3. Middleware verifies the JWT and loads the current user from the database, so role, staff department, and account status (`isActive`, Proposed) come from the server on every request. Role middleware rejects other roles with `403`.
4. A domain module validates the request, applies ownership and department rules, applies business rules, and reads or writes MongoDB through Mongoose.
5. The API returns a stable JSON envelope; errors pass through one central error handler that never exposes stack traces. The client updates accessible UI state.

## Access control

- **Patients** reach only their own profile, tokens, and assistance requests (records are filtered by the server-side user ID).
- **Staff (doctors)** reach only their assigned department's queue, tokens, and assistance requests.
- **Admins** reach every department, dashboard statistics, staff-account management (Proposed), and the audit history (Proposed).
- Out-of-scope lookups of a specific token or request return `404`, so the record's existence is not revealed.

## Audit history (Proposed)

Every successful queue-token status change (`call-next` or a status update) appends an audit entry to the token's `statusHistory` in the same atomic update that changes the status. The entry records previous and new status, actor ID and role, action, and timestamp. Rejected changes write nothing. Only admins can read the history, through a dedicated read-only endpoint.

Queue wait times and demo information must be visibly labelled as simulated estimates. Assistance requests notify staff workflows and must never promise emergency medical response.

# SehatDarshak API (server)

Express 5 + Mongoose 8 REST API for the SehatDarshak hospital queue MVP. Endpoint behaviour,
request/response shapes, and error codes are defined in
[docs/API_CONTRACT.md](../docs/API_CONTRACT.md); this file covers running, testing, and deploying
the server. All data is fictional demo data.

## Requirements

- Node.js 20 or later (`engines.node` in `package.json`).
- MongoDB 6.0 or later, local or MongoDB Atlas. 6.0 is required for the partial unique
  indexes that enforce queue rules.

## Environment variables

Copy `.env.example` to `.env` for local development. `.env` is git-ignored; never commit it.
In production, set these as platform environment variables instead of using a file.

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string, including the database name, e.g. `mongodb://127.0.0.1:27017/sehatdarshak` or `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/sehatdarshak?retryWrites=true&w=majority`. URL-encode special characters in the password. |
| `AUTH_SECRET` | Yes | JWT signing secret, at least 32 characters. The server refuses to start with the `.env.example` placeholder. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. |
| `PORT` | No | HTTP port. Defaults to `5000`. Hosting platforms such as Render set it automatically. |
| `CORS_ORIGIN` | Production: yes | Comma-separated browser origins allowed to call the API, e.g. `https://sehat.vercel.app`. Trailing slashes are ignored; `*` is **not** supported. When unset, development allows `http://localhost:5173` and production allows no cross-origin browser requests. |
| `NODE_ENV` | Production: yes | Set to `production` so the development CORS default is not applied. |
| `AUTH_TOKEN_EXPIRES_IN` | No | Access-token lifetime: a whole number followed by `s`, `m`, `h`, or `d` (e.g. `15m`, `1h`). Defaults to `1h`. |
| `MONGODB_TEST_URI` | No | MongoDB **server** used by the test suite (default `mongodb://127.0.0.1:27017`). Never point it at production data; tests create and drop `sehatdarshak_*_test` databases. |

The server validates `AUTH_SECRET`, `AUTH_TOKEN_EXPIRES_IN`, and the MongoDB connection before it
starts listening. On failure it prints one safe diagnostic line (no URI or credentials) and exits
with code 1.

## Local setup

```bash
cd server
npm install
cp .env.example .env          # then set AUTH_SECRET (and PORT if 5000 is busy)
npm run seed                  # loads the fictional demo floors, departments, and rooms; safe to repeat
npm run seed:dev-users        # optional, development only: demo patient, staff, and admin accounts
npm run dev                   # restarts on file changes
```

### Development test accounts

Public registration only creates patients, so `npm run seed:dev-users` creates one demo patient,
one staff member (assigned to `dept_demo_opd` by default), and one admin for local testing. Add
these to `server/.env` with your own passwords (placeholders are in `.env.example`):

```bash
NODE_ENV=development
ALLOW_DEV_USER_SEED=true
DEV_PATIENT_PASSWORD=<choose one>
DEV_STAFF_PASSWORD=<choose one>
DEV_ADMIN_PASSWORD=<choose one>
```

- The script refuses to run unless `NODE_ENV` is exactly `development`, `ALLOW_DEV_USER_SEED` is
  `true`, and `MONGODB_URI` is a `mongodb://` URI pointing only to `localhost`, `127.0.0.1`, or
  `[::1]`. It never runs against Atlas.
- Usernames default to `demo.patient`, `demo.staff`, and `demo.admin` (override with
  `DEV_*_USERNAME`); the staff department can be changed with `DEV_STAFF_DEPARTMENT_ID`.
- Passwords follow the registration rules (8–128 characters), are hashed like any other account,
  and are never printed.
- Re-running is safe: existing accounts are left unchanged, including their passwords. If a
  username already belongs to an account with a different role or department, the script reports
  it, changes nothing, and exits with code 1.
- Run `npm run seed` first; the staff department must exist.

On macOS, port 5000 is often taken by AirPlay Receiver; set `PORT=5001` (and the client's
`VITE_API_BASE_URL` to match) or turn AirPlay Receiver off.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Production start: `node src/server.js`. |
| `npm run dev` | Development start with `node --watch`. |
| `npm run seed` | Idempotently upserts the fictional demo data into `MONGODB_URI`: the canonical fixtures in `src/seed/demoData.js` plus the development floors, departments, and rooms in `src/seed/devDemoData.js` (which match the frontend mocks). It validates the data first, resets those records to the fixture values, and never deletes other records. |
| `npm run seed:dev-users` | Development only: creates the demo patient, staff, and admin accounts described above. Never modifies existing users. |
| `npm test` | Runs all tests with `node --test`. |

## Tests

`npm test` runs unit tests and HTTP-level tests. These files need a reachable MongoDB at
`MONGODB_TEST_URI`: `auth.routes`, `hospital.routes`, `seed`, `devSeed`, `queueTokens`,
`queueOperations`, `assistanceRequests`, and `dashboard`. Without MongoDB those suites are **skipped**, not failed,
so check that the summary reports `skipped 0`. [docs/TESTING.md](../docs/TESTING.md) lists which
cases are covered by existing tests and which are planned.

## Health check

`GET /api/health` is public and returns:

```json
{ "data": { "service": "sehatdarshak-api", "status": "ok" }, "message": "Service is healthy" }
```

It is a liveness check: it confirms the process is serving HTTP. It does not query MongoDB and
exposes no configuration, version, or database details. The server connects to MongoDB before it
starts listening, so a running instance has completed its initial database connection.

## API endpoints

All paths are under `/api`. Protected endpoints need `Authorization: Bearer <accessToken>` from
register/login. Responses use `{ "data": ..., "message"?, "meta"? }`; errors use
`{ "error": { "code", "message", "details"? } }` with `VALIDATION_ERROR` (400),
`UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), and
`INTERNAL_ERROR` (500). Stack traces and internal error details are never returned.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/health` | Public |
| POST | `/auth/register` | Public (always creates a `patient`) |
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Any authenticated user |
| GET | `/patients/me` | Patient |
| GET | `/patients/me/queue-tokens/active` | Patient |
| GET | `/departments`, `/departments/:departmentId` | Authenticated |
| GET | `/rooms?floor=&departmentId=&page=&limit=`, `/rooms/:roomId` | Authenticated |
| GET | `/map/floors`, `/map/floors/:floorId` | Authenticated |
| POST | `/queue-tokens` | Patient |
| GET | `/queue-tokens/:tokenId`, `/queue-tokens/:tokenId/status` | Token owner, assigned-department staff, admin |
| PATCH | `/queue-tokens/:tokenId/status` | Assigned-department staff, admin |
| GET | `/queues/:departmentId?page=&limit=` | Assigned-department staff, admin |
| POST | `/queues/:departmentId/call-next` | Assigned-department staff, admin |
| POST | `/assistance-requests` | Patient |
| GET | `/assistance-requests/me?page=&limit=` | Patient |
| GET | `/assistance-requests?status=&page=&limit=` | Assigned-department staff, admin |
| PATCH | `/assistance-requests/:requestId/acknowledge` | Assigned-department staff, admin |
| GET | `/dashboard/statistics` | Admin (response shape is a proposal pending team review) |

The table lists the endpoints that are **implemented**. Public registration only creates patients.
Staff and admin accounts currently have to be created directly in the database by a maintainer,
or locally with `npm run seed:dev-users`.

**Proposed, not implemented yet** (see the
[implementation status](../docs/API_CONTRACT.md#implementation-status)):

- Admin staff-account endpoints under `/admin/staff`.
- Staff deactivation, enforced at login and on every request.
- A read-only admin audit history of queue-token status changes at
  `/admin/audit/queue-token-status-changes`.

Token QR lookup needs no new endpoint; it uses `GET /queue-tokens/:tokenId`.

## Deploying to Render with MongoDB Atlas

### MongoDB Atlas

1. Create a cluster running MongoDB 6.0 or later. The free M0 tier is fine for the demo.
2. **Database Access:** create a dedicated database user with a strong generated password and the
   `readWrite` role on the `sehatdarshak` database only.
3. **Network Access:** allow the IP addresses your Render service connects from. Render's free
   instances have no fixed outbound IPs, which in practice means allowing `0.0.0.0/0`. That makes
   the strong database password your main protection; restrict the list if you move to a plan
   with static outbound IPs.
4. Copy the `mongodb+srv://` connection string, insert the user's URL-encoded password, and add the
   database name before the `?`, e.g. `.../sehatdarshak?retryWrites=true&w=majority`.

### Render web service

| Setting | Value |
| --- | --- |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Environment variables | `NODE_ENV=production`, `MONGODB_URI=<Atlas URI>`, `AUTH_SECRET=<new random secret>`, `CORS_ORIGIN=<deployed frontend origin>`; optional `AUTH_TOKEN_EXPIRES_IN`. Do **not** set `PORT`; Render provides it. |

Notes:

- Generate a new `AUTH_SECRET` for production; do not reuse your local one.
- Render sends `SIGTERM` on redeploys and stops; the server then stops accepting connections and
  closes its MongoDB connection before exiting.
- Free Render instances sleep when idle, and the first request after that can take a while.
- Indexes, including the queue-rule unique indexes, are created automatically when the server
  starts.
- Seed the Atlas database once from a trusted machine:
  `MONGODB_URI='<Atlas URI>' npm run seed`.
- After deploying, check `https://<service>.onrender.com/api/health`, then set the client's
  `VITE_API_BASE_URL` to `https://<service>.onrender.com/api`.

### Startup failure messages

| Message | Likely cause |
| --- | --- |
| `MONGODB_URI is required…` | Variable not set. |
| `MONGODB_URI is not a valid MongoDB connection string…` | Typo in the URI, or unencoded special characters in the password. |
| `MongoDB authentication failed…` | Wrong Atlas database username or password. |
| `MongoDB host could not be resolved…` | Wrong cluster host name. |
| `Unable to connect to MongoDB…` / `…timed out…` | Atlas Network Access list doesn't include the server, or the cluster is paused. |
| `AUTH_SECRET …` / `AUTH_TOKEN_EXPIRES_IN …` | Missing, weak, placeholder, or invalid auth configuration. |
| `Port … is already in use…` | Another process is using `PORT` (local development). |

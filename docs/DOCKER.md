# Running SehatDarshak with Docker

One command runs the whole application: the web app, the API, and MongoDB, with the database
kept in a persistent Docker volume.

```
Browser ──► web (Nginx, port 8080 on your computer)
              ├─ /            the built React app (any app route, e.g. /dashboard, loads it)
              └─ /api/…  ──►  backend (Express API, port 5000, private)  ──►  mongo (MongoDB 8.2, private)
```

- The browser only ever talks to the **web** service. It calls the API at `/api` on the same
  address, and Nginx forwards those requests to the backend over the private Docker network. The
  browser never sees Docker-only names such as `backend` or `mongo`, and there is no CORS setup to
  get wrong.
- **backend** and **mongo** publish no ports. MongoDB sits on an internal network that only the
  backend can reach.
- The images never contain `.env` files, secrets, tests, or Git history.

## Files

| File | Purpose |
| --- | --- |
| `compose.yaml` | The stack with a **local MongoDB container** (default database mode). |
| `compose.external-db.yaml` | The stack with an **external MongoDB** such as Atlas (no local database). |
| `docker/compose.app.yaml` | Web and backend definitions shared by both modes (not run on its own). |
| `docker/mongo/init/01-create-app-user.js` | Runs once on an empty database volume: creates the API's read/write database user. |
| `client/Dockerfile`, `client/nginx/` | Builds the React app with Vite and serves it with unprivileged Nginx. |
| `server/Dockerfile` | The API on Node.js 24, production dependencies only, running as the non-root `node` user. |
| `.env.example` | Every setting Compose needs, with placeholders. Copy it to `.env`. |

## First-time setup

Requirements: Docker Desktop (or Docker Engine) with Compose v2.

1. **Create the settings file** (never commit it; it is git-ignored):

   ```sh
   cp .env.example .env
   ```

   Replace every `replace-with-…` value. Generate each secret with:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   `AUTH_SECRET`, `MONGO_ROOT_PASSWORD`, and `MONGO_APP_PASSWORD` must be different. Keep the
   MongoDB passwords to letters, digits, `-` and `_`, because the app password goes inside a
   connection URI.

2. **Build and start:**

   ```sh
   docker compose up --build -d
   ```

   The first start creates the database and its users. `docker compose ps` shows all three
   services as `healthy` when ready (about 30 seconds).

3. **Load the demo hospital data** (floors, departments, rooms, walking routes). This is an
   explicit step, never automatic:

   ```sh
   docker compose run --rm backend npm run seed
   ```

   It is safe to run again: records are matched by their fixed IDs, so nothing is duplicated and
   nothing else is deleted. It does **reset the demo departments, rooms, floors, and walking graph
   to the shipped values**, undoing any admin edits to those records (for example re-activating a
   department an admin deactivated). Patients, staff, tokens, and visits are not touched. Run it on
   a fresh database, or deliberately to restore the demo map.

4. **Create the first administrator** (once). Type the password at the prompt so it does not end up
   in your shell history:

   ```sh
   read -rs -p "Admin password: " BOOTSTRAP_ADMIN_PASSWORD && export BOOTSTRAP_ADMIN_PASSWORD && echo
   docker compose run --rm -e BOOTSTRAP_ADMIN_USERNAME=hospital.admin -e BOOTSTRAP_ADMIN_PASSWORD backend npm run bootstrap:admin
   unset BOOTSTRAP_ADMIN_PASSWORD
   ```

   Optional: `-e BOOTSTRAP_ADMIN_NAME="Hospital Administrator"`. The username and password follow
   the normal registration rules (password at least 8 characters).

   The command creates an administrator **only if the database has no administrator at all**.
   Running it again, or with other values, changes nothing; it never resets a password, never turns
   an existing account into an admin, and never runs at application start. Create further staff,
   doctor, and admin accounts in the admin panel. (The older `npm run seed:dev-users` script is for
   local development without Docker and deliberately refuses non-localhost databases.)

5. **Open the app:** <http://localhost:8080> (or the `APP_ORIGIN` you set). Patients can register
   themselves; sign in as the administrator to manage staff.

## Everyday commands

| Task | Command |
| --- | --- |
| Start / rebuild after code or `.env` changes | `docker compose up --build -d` |
| Start in the foreground (logs in the terminal) | `docker compose up --build` |
| Status and health | `docker compose ps` |
| Follow all logs | `docker compose logs -f` |
| Logs of one service | `docker compose logs -f backend` (or `web`, `mongo`) |
| Stop, **keeping the database** | `docker compose down` |
| Restart without rebuilding | `docker compose restart` |
| Run a database migration | `docker compose run --rm backend npm run migrate:up` |

> **Never use `docker compose down -v` for normal cleanup.** `-v` deletes the `mongo-data` volume:
> every patient, token, and account in this stack is gone permanently.

## Ports and addresses

| Service | Reachable from | Address |
| --- | --- | --- |
| web | your computer (by default only `127.0.0.1`) | `http://localhost:${WEB_PORT}` (8080) |
| backend | the web service only | `http://backend:5000` inside Docker |
| mongo | the backend only (internal network) | `mongo:27017` inside Docker |

Health check from your computer: `curl http://localhost:8080/api/health`.

To look at the database, use the container's own shell (no port is published):

```sh
docker compose exec mongo mongosh -u "$MONGO_ROOT_USERNAME" -p --authenticationDatabase admin
```

(Load your `.env` values into the shell first, or type the username.)

## Configuration: where each setting is used

| Variable | Used by | When |
| --- | --- | --- |
| `WEB_PORT`, `WEB_BIND_ADDRESS` | Compose (host port binding of `web`) | each `up` |
| `APP_ORIGIN` | backend (`CORS_ORIGIN`) at runtime **and** web build (`VITE_PUBLIC_APP_URL`, QR codes) | runtime / **build** |
| `AUTH_SECRET`, `AUTH_TOKEN_EXPIRES_IN`, `HOSPITAL_TIMEZONE`, `TRUST_PROXY` | backend | runtime |
| `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD` | mongo | **first start only** |
| `MONGO_APP_USERNAME`, `MONGO_APP_PASSWORD`, `MONGO_DB_NAME` | mongo (first start: creates the user) and backend (connection URI) | first start / runtime |
| `EXTERNAL_MONGODB_URI` | backend, external-DB mode only | runtime |
| `BOOTSTRAP_ADMIN_USERNAME`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME` | the one-off bootstrap command only (`-e`), never stored | when run |

Important details:

- **Vite settings are fixed at build time.** The web image is built with `VITE_API_BASE_URL=/api`,
  `VITE_AUTH_MODE=api` (the image can never run in mock mode), and `VITE_PUBLIC_APP_URL=$APP_ORIGIN`.
  Changing `APP_ORIGIN` needs `docker compose up --build -d`. `client/.env` is not used by the
  image.
- **MongoDB users are created only when the data volume is empty.** Changing `MONGO_*` passwords in
  `.env` afterwards does **not** change them in the database; the backend would then fail to sign in
  to MongoDB. Change them inside MongoDB first (`db.changeUserPassword`), then in `.env`.
- `TRUST_PROXY=1` tells the API that one proxy (this Nginx) is in front of it, so the login rate
  limiter sees each user's own address instead of the proxy's. Use `2` if another proxy or load
  balancer is in front of the web service.

## Database modes

The database mode is chosen by the Compose file you use, so it is always explicit:

- **Local MongoDB container** (default): `docker compose …` uses `compose.yaml`. Data lives in the
  Docker volume `sehatdarshak_mongo-data` on this machine.
- **External MongoDB (e.g. Atlas):** set `EXTERNAL_MONGODB_URI` in `.env` and add
  `-f compose.external-db.yaml` to **every** command, for example
  `docker compose -f compose.external-db.yaml up --build -d`. No local database container or volume
  is created. If the external database cannot be reached, the backend stays unhealthy and the web
  service does not start; it never falls back to another database. For Atlas, allow the server's
  IP address in Atlas Network Access.

The two modes never share data. A database you used before with `npm run dev` (for example the
local `mongodb://127.0.0.1:27017/sehatdarshak`) is **not** the database inside Docker, and nothing
is copied automatically. To move data, use `mongodump`/`mongorestore` deliberately.

## Checking that data persists

```sh
docker compose down          # stops and removes containers; the volume stays
docker compose up -d
docker volume ls | grep sehatdarshak_mongo-data
```

Sign in again: accounts and tokens are still there.

## Back-ups

```sh
docker compose exec mongo sh -c 'mongodump --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' > sehatdarshak-$(date +%F).archive.gz
```

Store back-ups outside the server and test restoring them (`mongorestore --archive --gzip`).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `required variable … is missing a value` | `.env` is missing that setting; see `.env.example`. |
| backend `unhealthy`, log says `MongoDB authentication failed` | `MONGO_APP_*` in `.env` differ from the user created on first start (see above). |
| backend log: `AUTH_SECRET …` | Use a random secret of at least 32 characters (not the example text). |
| mongo restarts with "Linux kernel versions 6.19 and newer…" | That is MongoDB 8.0; this stack uses 8.2, which runs on these kernels. Do not pin `mongo:8.0`. |
| Browser shows the app but API calls fail | Check `docker compose logs backend`; make sure `APP_ORIGIN` is the exact address in the browser. |
| Port 8080 already in use | Set another `WEB_PORT` and the matching `APP_ORIGIN`, then `docker compose up --build -d`. |

## Deploying later on AWS EC2 (not done yet)

The same Compose files work on an EC2 instance with Docker installed. Nothing in this repository
deploys to AWS.

1. **Instance and firewall:** in the security group, allow only **443** (and 80 for the HTTPS
   redirect / certificate challenge) from the internet, and **22** (SSH) from your own address.
   Never open 27017 or 5000.
2. **HTTPS is required.** Camera QR scanning in browsers only works on `https://` pages, and
   sign-in tokens must not travel over plain HTTP. Put a TLS-terminating proxy in front of the web
   service, for example an AWS Application Load Balancer with an ACM certificate, or Caddy/Nginx
   with Let's Encrypt on the instance. Then set:
   - `APP_ORIGIN=https://your-domain`
   - `WEB_BIND_ADDRESS=127.0.0.1` if the TLS proxy runs on the same instance, or `0.0.0.0` with the
     security group allowing only the load balancer to reach `WEB_PORT`.
   - `TRUST_PROXY=2` (TLS proxy + Nginx).
3. **Get the code and configure:**

   ```sh
   git clone <repository-url> sehatdarshak && cd sehatdarshak
   cp .env.example .env && chmod 600 .env   # fill in NEW production secrets
   docker compose up --build -d
   docker compose run --rm backend npm run seed           # fresh database only
   docker compose run --rm -e BOOTSTRAP_ADMIN_USERNAME=… -e BOOTSTRAP_ADMIN_PASSWORD backend npm run bootstrap:admin
   ```

   Use different secrets from any local or test environment. Keep `.env` only on the server (or in
   AWS Secrets Manager / SSM Parameter Store), never in Git or in the images.
4. **Data:** the local volume lives on the instance's EBS disk. Enable EBS snapshots and schedule
   the `mongodump` back-up above to S3, or use MongoDB Atlas (`compose.external-db.yaml`) for
   managed back-ups. Data on your laptop does not appear on the server; there is no automatic
   migration.
5. **Updates:** `git pull && docker compose up --build -d`. Database data is kept.

# Local Setup

## Prerequisites

- Node.js 20 LTS or later and npm.
- A running MongoDB instance and a `MONGODB_URI` value. The provided example uses local MongoDB; MongoDB Atlas may be used with its own connection URI.

## Install dependencies

From the workspace root, after reviewing package versions:

```bash
npm install --prefix client
npm install --prefix server
```

## Configure local environment files

Copy each `.env.example` to a local `.env` file and replace placeholders locally. Do not commit `.env` files, API keys, database credentials, or patient information.

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

`client/.env` needs `VITE_API_BASE_URL`. `server/.env` needs `PORT`, `CORS_ORIGIN`, `MONGODB_URI`, and `AUTH_SECRET`, and `AUTH_SECRET` must be replaced with a long random value. The server connects to MongoDB before it starts listening; the example URI expects a local MongoDB instance to be running. See [server/README.md](../server/README.md) for every server variable, demo-data seeding, tests, and deployment.

## Start the applications

In separate terminals:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

Before the first server start, load the demo data with `npm run seed --prefix server`.

Vite will display its local browser URL. The server health endpoint is `http://localhost:5000/api/health` by default. On macOS, port 5000 is often used by AirPlay Receiver; if so, set `PORT=5001` in `server/.env` and update `VITE_API_BASE_URL` to match.

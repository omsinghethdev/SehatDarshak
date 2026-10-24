# Local Setup

## Prerequisites

- Node.js 20 LTS or later and npm.
- A MongoDB Atlas connection string when database work begins (not required for the current health-check foundation).

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

`client/.env` needs `VITE_API_BASE_URL`. `server/.env` needs `PORT`, `MONGODB_URI`, and `AUTH_SECRET`. The current scaffold does not connect to MongoDB or authenticate users yet.

## Start the applications

In separate terminals:

```bash
npm run dev --prefix server
npm run dev --prefix client
```

Vite will display its local browser URL. The server health endpoint is `http://localhost:5000/api/health` by default.

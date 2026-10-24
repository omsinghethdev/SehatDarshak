# Architecture

## Overview

SehatDarsak uses a single React/Vite client, a single Express REST API, and MongoDB Atlas through Mongoose. This deliberately small architecture is suitable for a 2–3 person hackathon team and can be expanded only after the MVP is validated.

## Frontend

`client/src/features/` groups product areas such as registration, queue, navigation, assistance, staff, and admin. Shared presentational components live in `components/`; routes, API calls, i18n, hooks, and utilities have dedicated folders. The client will poll the REST API for queue updates. Navigation is a basic SVG-based 2D floor map with room coordinates; route-finding, 3D maps, and external navigation APIs are out of scope. UI route visibility is only a usability measure; the server must authorize every protected request.

## Backend

`server/src/app.js` owns Express middleware and application wiring. Future HTTP route registration belongs in `routes/`; domain-oriented handlers, validation, services, and models belong in their respective `modules/` folder. `middleware/` is for authentication, authorization, validation, and error handling. `config/` holds configuration helpers, while `utils/` contains small shared helpers.

## Database

MongoDB Atlas is the planned persistence layer. Mongoose models should be introduced only after the data model and API contract are reviewed. See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md).

## Intended request flow

1. A client feature calls a service in `client/src/services/`.
2. The service sends JSON to an Express route under `/api`.
3. Middleware validates identity, role, and request shape when applicable.
4. A domain module applies business rules and reads or writes MongoDB through Mongoose.
5. The API returns a stable JSON response; the client updates accessible UI state.

Queue wait times and demo information must be visibly labelled as simulated estimates. Assistance requests notify staff workflows and must never promise emergency medical response.

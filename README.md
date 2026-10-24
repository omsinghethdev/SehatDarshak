# SehatDarshak

SehatDarshak is a hackathon MVP for smart queue management and accessible hospital navigation in government hospitals. It is designed to make common OPD tasks easier for patients while giving staff (doctors) and administrators a small operational view.

## Problem statement

Patients can face long, uncertain queues and difficulty finding departments or facilities in unfamiliar hospitals. SehatDarshak provides simple language-aware registration, queue updates, a basic 2D floor map, and a staff assistance-request channel. It is not a clinical system or emergency-response service.

## MVP scope

**Patient**
- Register and sign in as a patient.
- Browse departments and read-only room and floor-map information.
- Book a queue token, view its status, and view the token's QR code.
- See clearly labelled simulated waiting-time estimates.
- Submit and track assistance requests to hospital staff.

**Staff (doctors)**
- Sign in to an authorized staff account.
- View and operate only on their assigned department's queue.
- Call the next token and update token status using the valid transitions.
- View and acknowledge their department's assistance requests.
- Scan a patient's token QR code to open the token.

**Admin**
- View dashboard statistics and monitor queues across departments.
- Create staff accounts, assign or change their department, and activate or deactivate them.
- View the protected audit history of queue-token status changes.

**Security:** the roles are `patient`, `staff`, and `admin`, and public registration creates patients only. The server enforces every permission from its own records and never trusts a role sent by the client. Frontend route guards are a usability aid, not security.

**Out of scope:** route calculation or turn-by-turn indoor navigation (future scope; the basic 2D map stays), live indoor positioning or tracking, create/edit/delete of departments, rooms or floors, public staff or admin registration, payments, prescriptions, medical records, and emergency dispatch.

## Technology

- Frontend: React, Vite, JavaScript, Tailwind CSS, Lucide React.
- Backend: Node.js, Express, REST/JSON.
- Data: MongoDB (Atlas in production) with Mongoose.
- Deployment targets: Vercel (client) and Render (server).

## Directory overview

`client/` contains the Vite application, reusable UI, feature folders, and API services. `server/` contains the Express application and domain modules. `docs/` contains the shared design and delivery references.

## Documentation

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md): endpoints, roles, errors, and the implementation status of each endpoint.
- [docs/SHARED_INTEGRATION_CONTRACT.md](docs/SHARED_INTEGRATION_CONTRACT.md): frontend/backend data models, ownership, and demo data.
- [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).
- [docs/SETUP.md](docs/SETUP.md) and [server/README.md](server/README.md): local setup, environment variables, and deployment.
- [docs/TESTING.md](docs/TESTING.md): how to run tests and the existing vs. planned test cases.

## Development status

- **Backend:** implements and tests the patient, hospital-data, queue, staff queue-operation, assistance, and admin-statistics endpoints. QR lookup uses an existing endpoint.
- **Proposed, not implemented yet:** admin staff-account management, staff deactivation, and the queue-token audit history. See the [implementation status table](docs/API_CONTRACT.md#implementation-status).
- **Frontend:** the `raunak` branch is merged into `main`. It has patient, staff, and admin pages, English and Hindi translations, QR pages, and service layers that switch between mock data and the API. In API mode the patient, staff, and admin pages use the real backend (verified end to end in a browser on the `integration` branch); QR codes are still frontend-only.

## Next step

Resolve the open decisions in [API_CONTRACT.md](docs/API_CONTRACT.md#decisions-for-team-review), including the dashboard response shape, then implement the Proposed backend features and integrate the frontend with the API.

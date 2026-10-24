# SehatDarsak

SehatDarsak is a hackathon MVP for smart queue management and accessible hospital navigation in government hospitals. It is designed to make common OPD tasks easier for patients while giving staff and administrators a small operational view.

## Problem statement

Patients can face long, uncertain queues and difficulty finding departments or facilities in unfamiliar hospitals. SehatDarsak will provide simple language-aware registration, queue updates, 2D wayfinding, and a staff assistance-request channel. It is not a clinical system or emergency-response service.

## Planned features

- Patient registration, preferred-language selection, department selection, and queue tokens.
- Queue status with clearly labelled simulated wait estimates and patients-ahead counts.
- Accessible 2D hospital maps for floors, rooms, departments, and facilities.
- Assistance requests routed to hospital staff.
- Staff queue controls and assistance acknowledgements.
- Admin queue monitoring and basic operational statistics; management CRUD is out of scope for this MVP.

## Technology

- Frontend: React, Vite, JavaScript, Tailwind CSS, Lucide React.
- Backend: Node.js, Express, REST/JSON.
- Data: MongoDB (Atlas in production) with Mongoose.
- Deployment targets: Vercel (client) and Render (server).

## Directory overview

`client/` contains the Vite application, reusable UI, feature folders, and API services. `server/` contains the Express application and domain modules. `docs/` contains the shared design and delivery references.

## Development status

The backend API in `server/` implements the endpoints in the draft API contract: authentication, hospital data and maps, queue tokens and staff queue operations, assistance requests, and admin statistics. It is covered by automated tests; see [server/README.md](server/README.md). The frontend product pages are not yet integrated with the API.

## Next step

Resolve the open contract decisions (including the admin dashboard response shape), then integrate the frontend with the API.

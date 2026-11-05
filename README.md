# CoDrive

CoDrive is a mobile-first road-trip app for planning a route with your crew, rotating drivers, and splitting costs. It runs in Expo Go and in the browser.

## Run

```bash
npm install
npm start
```

- Press `w` to open the web app at [http://localhost:8081](http://localhost:8081).
- Scan the QR code with Expo Go on a phone on the same network.

`npm run ios` and `npm run android` open the native simulators when they are installed.

## What you can do

- **Home.** Start a trip with a name, start, end, dates, a budget, and an optional picture. The budget is what Split uses for that trip. Open an expedition, tap the pencil to edit it, or tap the X to delete it. Trips still in planning show **Start journey**, which checks the route, crew, dates, and budget before the drive goes live. The people icon opens a crew popup when you created the trip. The profile picture starts as an anonymous icon; tap it to choose a photo or switch back.
- **Invite.** After you create a trip, share a link or QR code, then continue to Plan.
- **Plan.** Review proposed stops, like one, or suggest a new waypoint. **Start journey** runs the same pre-launch check. Once the trip is live, **Open the drive** jumps to the route. The people icon manages who is on a trip you created.
- **Drive.** Follow the route and today’s itinerary after the journey is launched. Opening Drive before that shows the same start check. The first visit on a live trip opens a driver-rotation reminder. The bluetooth control opens the connection-lost notice.
- **Split.** See the shared budget and log an expense, including notes for who paid and whether it was split.

Sample trips load from `src/data.ts`. Starting a new trip saves it through the API and keeps the returned id and share code for later stops and expenses.

## API

The API is a Node.js service in `server/`. PostgreSQL stores trips, and PostGIS keeps each stop as a geography point.

Start the database, then the API:

```bash
docker compose up -d
cd server
cp .env.example .env
npm install
npm start
```

The API listens on [http://localhost:3000](http://localhost:3000). Postgres is published on port 5433 so it does not collide with a Postgres already running on 5432.

Tables:

- `trips` — `id`, `title`, `share_code`, `budget`, `created_at`
- `waypoints` — `id`, `trip_id`, `name`, `latitude`, `longitude`, `sequence_order`, plus a PostGIS `location` point filled from the coordinates
- `expenses` — `id`, `trip_id`, `paid_by_user`, `amount`, `category`, `description`

Endpoints:

- `POST /api/trips` — body `{ "title": "North Shore Getaway", "budget": 500 }`. `share_code` is optional. `budget` must be greater than 0.
- `POST /api/trips/:id/waypoints` — body `{ "name": "Pipeline Beach", "latitude": 21.665, "longitude": -158.053 }`. `sequence_order` is optional and defaults to the next stop.
- `GET /api/trips/:id` — the trip, its stops in order, and its expenses.
- `POST /api/trips/:id/expenses` — body `{ "paid_by_user": "Ava", "amount": 42, "category": "gas", "description": "Split 4 ways" }`.

## Where things live

`App.tsx` holds navigation and screen state. Screens are in `src/screens/`, shared pieces in `src/components/`, and colors in `src/theme.ts`. The schema is `server/sql/001_schema.sql`.

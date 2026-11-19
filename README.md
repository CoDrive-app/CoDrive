# CoDrive

CoDrive is a mobile-first road-trip app for planning a route with your crew, rotating drivers, and splitting costs. It runs in Expo Go and in the browser.

`main` is the version we showcase and host, and the only branch that uses the production database. Every other branch uses the local database and does not contact Expo. Branch, push, and merge using [CONTRIBUTING.md](CONTRIBUTING.md).

## Run

start.sh is created to run all needed commands automatically
Just run ./start.sh in terminal to run them all. Ensure docker is open.

```bash
npm install
npm start
```

- Press `w` to open the web app at [http://localhost:8081](http://localhost:8081).
- Scan the QR code with Expo Go on a phone on the same network.

`npm run ios` and `npm run android` open the native simulators when they are installed.

## What you can do

- **Accounts.** Sign in, or create an account with a name, email and password. You only ever see trips you started or joined. Sign out from the profile picture on Home.
- **Home.** Start a trip with just a name, or join someone's trip with its share code. Open an expedition, tap the pencil to open its Trip tab, or tap the X to delete it (the owner deletes it for everyone; anyone else just leaves it). The profile picture starts as an anonymous icon; tap it to choose a photo or switch back.
- **Invite.** After you create a trip, share its code. Friends sign in, tap Join with a Code, and enter it.
- **Trip.** Set the start and end, dates, budget and picture, and choose which crew members can drive and for how long (1 to 12 hours each). Everything except the name is optional. No route is drawn until both Start and End are filled in. The budget is what Split uses for that trip.
- **Plan.** Review proposed stops, like one, or suggest a new waypoint.
- **Drive.** Follow the route and today’s itinerary. With two or more drivers set on the Trip tab, the route is split into one colour per driver, each stretch as long as that driver can drive; a change of colour is a change of driver. If one driver can cover the whole route, or only one driver is set, the line is in that driver's colour. A change within 5 miles of a stop moves to that stop. The steering-wheel control opens the driver-rotation reminder, using the first driver set on the Trip tab. The map shows real streets from Geoapify map tiles. It pans with one finger and zooms with a pinch or the + and - buttons, and the target button jumps to your location (or back to the whole route if there is none). Tap a pin to see that stop's time, notes, who suggested it, and its votes. The route line turns translucent once you zoom in far enough for street names to show. The bluetooth control opens the connection-lost notice.
- **Split.** See the shared budget and log an expense, including notes for who paid and whether it was split.

Everything about a trip is saved in the API's database: its settings (name, start and end, dates, budget, picture, people added by name, drivers), suggested stops with their notes, and each person's vote. Reloading the app or opening it on another phone shows the same trip. The phone itself keeps only the sign-in token. On the Plan tab a stop's status still follows your own vote, while the counts include the whole crew.

## Drive screen

The route only includes stops that are selected (thumbs up) and have a location, ordered to be as short as it can be. The first stop stays first, and a Destination or Arrival stop stays last. The progress bar follows the phone's real location along that route, so install the location package once with `npx expo install expo-location` and allow location when asked. On the Android emulator, set a location in the emulator's extended controls (`...` > Location), or progress shows "Not on the route yet".

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

For address search, put your Geoapify key in `server/.env` as `GEOAPIFY_API_KEY=...` and restart the API. The key stays on the server and the app never sees it. Without it the map has no streets behind the route, the address fields are plain text, and everything else works.

The API listens on [http://localhost:3000](http://localhost:3000). Postgres is published on port 5433 so it does not collide with a Postgres already running on 5432.

The git branch chooses the database. On `main`, the app calls the hosted API and does not start the local database. On every other branch, the app calls this local API and Expo starts offline. A root `.env` cannot point a feature branch at production.

## Hosted API

`render.yaml` describes the production API and database. In the Render dashboard, create a Blueprint from this repo. Render asks for `GEOAPIFY_API_KEY` and does not read `server/.env`. The Blueprint sets `TRUST_PROXY=1` so rate limits see each caller's address instead of Render's proxy. The build compiles `server/` and runs `node dist/index.js`. `./start.sh` is unchanged for local work. Open `https://<the service>.onrender.com/health` and expect `{"ok": true}`.

## Accounts and access

Every `/api/trips` endpoint and the paid `/api/geo` lookups (autocomplete, places, route) need `Authorization: Bearer <token>`. Map tiles stay open because the map loads them as plain images; they are cached and limited per caller.

- Passwords are hashed with scrypt. The API stores only a SHA-256 of each sign-in token, and tokens last 60 days or until sign-out.
- A user sees a trip only while they are on its crew (`trip_members`). A trip you are not on answers 404, the same as one that does not exist.
- Joining needs the trip's 8-character share code and is limited to 10 tries a minute. Sign-in is limited per caller and per email.
- Other crew members see your name, never your email.
- Trips made before accounts existed have no owner, so nobody can see them.

Tables:

- `users` — `id`, `email` (unique, any case), `name`, `password_hash`, `created_at`
- `sessions` — `token_hash`, `user_id`, `created_at`, `expires_at`
- `trip_members` — `trip_id`, `user_id`, `role` (`owner` or `member`), `joined_at`
- `trips` — `id`, `title`, `share_code`, `budget`, `owner_id`, `created_at`, `start_date`, `end_date`, `image` (an https URL or image data URL), `drivers` (JSON list of crew ids and limits), `guests` (JSON list of people added by name)
- `waypoints` — `id`, `trip_id`, `name`, `latitude` and `longitude` (empty until a place is picked), `sequence_order`, `role` (`start`, `end`, or empty for a suggestion), `note`, `proposed_by`, `created_at`, plus a PostGIS `location` point filled from the coordinates
- `waypoint_votes` — `waypoint_id`, `user_id`, `vote` (`up` or `down`), one per person per stop
- `expenses` — `id`, `trip_id`, `paid_by_user`, `amount`, `category`, `title`, `description`, `photos`, `created_by`

Endpoints:

- `POST /api/auth/signup` — body `{ "name": "Ava", "email": "ava@example.com", "password": "at least 8 characters" }`. Returns `{ token, user }`.
- `POST /api/auth/login` — body `{ "email", "password" }`. Returns `{ token, user }`.
- `POST /api/auth/logout` — ends the session for the token sent.
- `GET /api/auth/me` — the signed-in user.
- `GET /api/trips` — the trips you are on, each with your `role` and its `members`.
- `POST /api/trips` — body `{ "title": "North Shore Getaway", "budget": 500 }`. `budget` is optional and must be greater than 0. You become the owner and the API picks the share code.
- `POST /api/trips/join` — body `{ "share_code": "N7XUAUT2" }`. Adds you to that trip's crew.
- `DELETE /api/trips/:id` — the owner deletes the trip; a member leaves it.
- `PATCH /api/trips/:id` — saves the Trip tab. Any of `title`, `budget` (null clears it), `start_date` and `end_date` (`YYYY-MM-DD` or null), `image` (https URL or image data URL under 3 MB, or null), `drivers` (`[{ "crewId", "limitMinutes" }]`, 60 to 720), `guests` (`[{ "id", "name" }]`), and `start` and `end` (`{ "name", "latitude"?, "longitude"? }`, or null to remove). Only the fields sent change. Returns the trip like `GET /api/trips/:id`.
- `POST /api/trips/:id/waypoints` — body `{ "name": "Pipeline Beach", "latitude": 21.665, "longitude": -158.053, "note": "Surf check" }`. The location and note are optional. `sequence_order` is optional and defaults to the next stop.
- `PUT /api/trips/:id/waypoints/:waypointId/vote` — body `{ "vote": "up" | "down" | null }`. null takes your vote back. Returns the stop with its counts.
- `GET /api/trips/:id` — the trip, its members, its stops in order (with `likes`, `dislikes` and your `my_vote`), and its expenses.
- `GET /api/geo/autocomplete?text=Ala Moana` — up to 5 address suggestions with coordinates, looked up through Geoapify. Needs `GEOAPIFY_API_KEY`. `text` must be 3 to 200 characters, and each caller is limited to 60 searches a minute.
- `GET /api/geo/places?category=food|gas|beach|sights|lodging&lat=...&lon=...` — named places of that kind within about 9 miles of a point.
- `GET /api/geo/tile/osm-bright/:z/:x/:y` — one high-resolution map tile as a PNG. The API keeps recently used tiles in memory, up to 64 MB, and only tiles it has to fetch count toward Geoapify credits and the limit of 600 a minute per caller.
- `POST /api/geo/route` — body `{ "points": [{ "latitude": 21.66, "longitude": -158.05 }, ...] }` with 2 to 12 points. Returns the driving distance, time, each leg, and the road line.

All `/api/geo` endpoints use the Geoapify key in `server/.env`, and each has its own per-caller rate limit.
- `POST /api/trips/:id/expenses` — body `{ "paid_by_user": "Ava", "amount": 42, "category": "gas", "description": "Split 4 ways" }`.

## Where things live

`App.tsx` holds navigation and screen state. Screens are in `src/screens/`, shared pieces in `src/components/`, map maths in `src/mapView.ts`, and colors in `src/theme.ts`. The schema is in `server/sql/`; the API runs every file there in order on start. Sign-in and sessions are in `server/src/auth.ts`, and the app keeps its token in `src/session.ts`.

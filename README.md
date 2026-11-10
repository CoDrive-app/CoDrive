# CoDrive

CoDrive is a mobile-first road-trip app for planning a route with your crew, rotating drivers, and splitting costs. It runs in Expo Go and in the browser.

`main` is the version we showcase and host. Branch, push, and merge using [CONTRIBUTING.md](CONTRIBUTING.md).

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

- **Home.** Start a trip with just a name. Open an expedition, tap the pencil to open its Trip tab, or tap the X to delete it. The profile picture starts as an anonymous icon; tap it to choose a photo or switch back.
- **Invite.** After you create a trip, share a link or QR code, then continue to the Trip tab.
- **Trip.** Set the start and end, dates, budget and picture, and choose which crew members can drive and for how long (1 to 12 hours each). Everything except the name is optional. No route is drawn until both Start and End are filled in. The budget is what Split uses for that trip.
- **Plan.** Review proposed stops, like one, or suggest a new waypoint.
- **Drive.** Follow the route and today’s itinerary. With two or more drivers set on the Trip tab, the route is split into one colour per driver, each stretch as long as that driver can drive; a change of colour is a change of driver. If one driver can cover the whole route, or only one driver is set, the line is in that driver's colour. A change within 5 miles of a stop moves to that stop. The steering-wheel control opens the driver-rotation reminder, using the first driver set on the Trip tab. The map shows real streets from Geoapify map tiles. It pans with one finger and zooms with a pinch or the + and - buttons, and the target button jumps to your location (or back to the whole route if there is none). Tap a pin to see that stop's time, notes, who suggested it, and its votes. The route line turns translucent once you zoom in far enough for street names to show. The bluetooth control opens the connection-lost notice.
- **Split.** See the shared budget and log an expense, including notes for who paid and whether it was split.

Sample trips load from `src/data.ts`. Starting a new trip saves it through the API and keeps the returned id and share code for later stops and expenses.

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

Tables:

- `trips` — `id`, `title`, `share_code`, `budget`, `created_at`
- `waypoints` — `id`, `trip_id`, `name`, `latitude`, `longitude`, `sequence_order`, plus a PostGIS `location` point filled from the coordinates
- `expenses` — `id`, `trip_id`, `paid_by_user`, `amount`, `category`, `description`

Endpoints:

- `POST /api/trips` — body `{ "title": "North Shore Getaway", "budget": 500 }`. `share_code` and `budget` are optional. If given, `budget` must be greater than 0.
- `POST /api/trips/:id/waypoints` — body `{ "name": "Pipeline Beach", "latitude": 21.665, "longitude": -158.053 }`. `sequence_order` is optional and defaults to the next stop.
- `GET /api/trips/:id` — the trip, its stops in order, and its expenses.
- `GET /api/geo/autocomplete?text=Ala Moana` — up to 5 address suggestions with coordinates, looked up through Geoapify. Needs `GEOAPIFY_API_KEY`. `text` must be 3 to 200 characters, and each caller is limited to 60 searches a minute.
- `GET /api/geo/places?category=food|gas|beach|sights|lodging&lat=...&lon=...` — named places of that kind within about 9 miles of a point.
- `GET /api/geo/tile/osm-bright/:z/:x/:y` — one high-resolution map tile as a PNG. The API keeps recently used tiles in memory, up to 64 MB, and only tiles it has to fetch count toward Geoapify credits and the limit of 600 a minute per caller.
- `POST /api/geo/route` — body `{ "points": [{ "latitude": 21.66, "longitude": -158.05 }, ...] }` with 2 to 12 points. Returns the driving distance, time, each leg, and the road line.

All `/api/geo` endpoints use the Geoapify key in `server/.env`, and each has its own per-caller rate limit.
- `POST /api/trips/:id/expenses` — body `{ "paid_by_user": "Ava", "amount": 42, "category": "gas", "description": "Split 4 ways" }`.

## Where things live

`App.tsx` holds navigation and screen state. Screens are in `src/screens/`, shared pieces in `src/components/`, map maths in `src/mapView.ts`, and colors in `src/theme.ts`. The schema is `server/sql/001_schema.sql`.

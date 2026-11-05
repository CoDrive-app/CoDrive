import { randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { migrate, pool } from './db.js';
import {
  autocompleteAddress,
  createRateLimiter,
  createTileCache,
  fetchTile,
  findPlaces,
  GeoError,
  isPlaceCategory,
  parseTileAddress,
  planRoute,
  type RoutePoint,
} from './geo.js';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/health', wrap(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
}));

app.post('/api/trips', wrap(async (req, res) => {
  const title = text(req.body?.title);
  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  // The budget is optional. If it is given, it must be above 0.
  const budget = req.body?.budget === undefined || req.body?.budget === null ? null : number(req.body.budget);
  if (req.body?.budget !== undefined && req.body?.budget !== null && (budget === null || budget <= 0)) {
    res.status(400).json({ error: 'budget must be greater than 0' });
    return;
  }

  const requested = text(req.body?.share_code);
  if (requested && !/^[A-Za-z0-9_-]{4,16}$/.test(requested)) {
    res.status(400).json({ error: 'share_code must be 4–16 letters, numbers, _ or -' });
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const shareCode = requested || makeShareCode();
    try {
      const result = await pool.query(
        `INSERT INTO trips (title, share_code, budget)
         VALUES ($1, $2, $3)
         RETURNING id, title, share_code, budget, created_at`,
        [title, shareCode, budget],
      );
      res.status(201).json(tripRow(result.rows[0]));
      return;
    } catch (error) {
      if (isUniqueViolation(error) && !requested) continue;
      if (isUniqueViolation(error)) {
        res.status(409).json({ error: 'share_code is already in use' });
        return;
      }
      throw error;
    }
  }

  res.status(500).json({ error: 'Could not create a share code' });
}));

app.post('/api/trips/:id/waypoints', wrap(async (req, res) => {
  const tripId = req.params.id;
  if (!isUuid(tripId)) {
    res.status(400).json({ error: 'trip id must be a uuid' });
    return;
  }

  const name = text(req.body?.name);
  const latitude = number(req.body?.latitude);
  const longitude = number(req.body?.longitude);
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  if (latitude === null || latitude < -90 || latitude > 90) {
    res.status(400).json({ error: 'latitude must be between -90 and 90' });
    return;
  }
  if (longitude === null || longitude < -180 || longitude > 180) {
    res.status(400).json({ error: 'longitude must be between -180 and 180' });
    return;
  }

  const explicitOrder = req.body?.sequence_order;
  let sequenceOrder: number | null = null;
  if (explicitOrder !== undefined && explicitOrder !== null) {
    sequenceOrder = number(explicitOrder);
    if (sequenceOrder === null || !Number.isInteger(sequenceOrder) || sequenceOrder < 0) {
      res.status(400).json({ error: 'sequence_order must be a whole number starting at 0' });
      return;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trip = await client.query('SELECT id FROM trips WHERE id = $1', [tripId]);
    if (trip.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Trip not found' });
      return;
    }

    if (sequenceOrder === null) {
      const next = await client.query(
        'SELECT COALESCE(MAX(sequence_order), -1) + 1 AS next FROM waypoints WHERE trip_id = $1',
        [tripId],
      );
      sequenceOrder = Number(next.rows[0].next);
    }

    const inserted = await client.query(
      `INSERT INTO waypoints (trip_id, name, latitude, longitude, sequence_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, trip_id, name, latitude, longitude, sequence_order`,
      [tripId, name, latitude, longitude, sequenceOrder],
    );
    await client.query('COMMIT');
    res.status(201).json(waypointRow(inserted.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: 'sequence_order is already used on this trip' });
      return;
    }
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/trips', wrap(async (_req, res) => {
  const result = await pool.query(
    'SELECT id, title, share_code, budget, created_at FROM trips ORDER BY created_at DESC',
  );
  res.json(result.rows.map(tripRow));
}));

app.get('/api/trips/:id', wrap(async (req, res) => {
  const tripId = req.params.id;
  if (!isUuid(tripId)) {
    res.status(400).json({ error: 'trip id must be a uuid' });
    return;
  }

  const trip = await pool.query(
    'SELECT id, title, share_code, budget, created_at FROM trips WHERE id = $1',
    [tripId],
  );
  if (trip.rowCount === 0) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }

  const waypoints = await pool.query(
    `SELECT id, trip_id, name, latitude, longitude, sequence_order
     FROM waypoints
     WHERE trip_id = $1
     ORDER BY sequence_order`,
    [tripId],
  );
  const expenses = await pool.query(
    `SELECT id, trip_id, paid_by_user, amount, category, description
     FROM expenses
     WHERE trip_id = $1
     ORDER BY id`,
    [tripId],
  );

  res.json({
    ...tripRow(trip.rows[0]),
    waypoints: waypoints.rows.map(waypointRow),
    expenses: expenses.rows.map(expenseRow),
  });
}));

app.post('/api/trips/:id/expenses', wrap(async (req, res) => {
  const tripId = req.params.id;
  if (!isUuid(tripId)) {
    res.status(400).json({ error: 'trip id must be a uuid' });
    return;
  }

  const paidByUser = text(req.body?.paid_by_user);
  const amount = number(req.body?.amount);
  const category = text(req.body?.category);
  const description = descriptionText(req.body?.description);
  if (!paidByUser) {
    res.status(400).json({ error: 'paid_by_user is required' });
    return;
  }
  if (amount === null || amount <= 0) {
    res.status(400).json({ error: 'amount must be greater than 0' });
    return;
  }
  if (!category) {
    res.status(400).json({ error: 'category is required' });
    return;
  }
  if (description === null) {
    res.status(400).json({ error: 'description must be text' });
    return;
  }

  const trip = await pool.query('SELECT id FROM trips WHERE id = $1', [tripId]);
  if (trip.rowCount === 0) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }

  const inserted = await pool.query(
    `INSERT INTO expenses (trip_id, paid_by_user, amount, category, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, trip_id, paid_by_user, amount, category, description`,
    [tripId, paidByUser, amount, category, description],
  );
  res.status(201).json(expenseRow(inserted.rows[0]));
}));

const addressSearchLimited = createRateLimiter(60, 60_000);
const placesLimited = createRateLimiter(30, 60_000);
const routeLimited = createRateLimiter(20, 60_000);
// One screen of map is about 15 tiles, and tiles this server has saved do not count.
const tilesLimited = createRateLimiter(600, 60_000);
const TILE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const tileCache = createTileCache(64 * 1024 * 1024, TILE_MAX_AGE_SECONDS * 1000);

const GEO_NOT_SET_UP = 'Maps are not set up. Add GEOAPIFY_API_KEY to server/.env and restart the server.';

function coordinate(latitude: unknown, longitude: unknown): RoutePoint | null {
  const lat = number(latitude);
  const lon = number(longitude);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { latitude: lat, longitude: lon };
}

app.get('/api/geo/autocomplete', wrap(async (req, res) => {
  const query = text(req.query.text);
  if (!query || query.length < 3) {
    res.status(400).json({ error: 'text must be at least 3 characters' });
    return;
  }
  if (query.length > 200) {
    res.status(400).json({ error: 'text is too long' });
    return;
  }

  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: 'Address search is not set up. Add GEOAPIFY_API_KEY to server/.env and restart the server.' });
    return;
  }
  if (addressSearchLimited(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many address searches. Try again in a minute.' });
    return;
  }

  // Optional: rank results closer to a known point first.
  const near = req.query.lat !== undefined ? coordinate(req.query.lat, req.query.lon) : null;

  try {
    res.json({ results: await autocompleteAddress(query, apiKey, near ? { near } : {}) });
  } catch (error) {
    // Log the reason only. Never log the request URL, because it contains the key.
    console.error('Address search failed:', error instanceof GeoError ? error.message : 'unexpected error');
    res.status(502).json({ error: 'Address search is unavailable right now.' });
  }
}));

app.get('/api/geo/places', wrap(async (req, res) => {
  const category = text(req.query.category) ?? '';
  const near = coordinate(req.query.lat, req.query.lon);
  if (!isPlaceCategory(category) || !near) {
    res.status(400).json({ error: 'category and a valid lat and lon are required' });
    return;
  }

  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: GEO_NOT_SET_UP });
    return;
  }
  if (placesLimited(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many searches. Try again in a minute.' });
    return;
  }

  try {
    res.json({ results: await findPlaces(category, near, apiKey) });
  } catch (error) {
    console.error('Nearby search failed:', error instanceof GeoError ? error.message : 'unexpected error');
    res.status(502).json({ error: 'Nearby search is unavailable right now.' });
  }
}));

app.post('/api/geo/route', wrap(async (req, res) => {
  const raw: unknown = req.body?.points;
  if (!Array.isArray(raw) || raw.length < 2 || raw.length > 12) {
    res.status(400).json({ error: 'points must list between 2 and 12 places' });
    return;
  }
  const points = raw.map((item: { latitude?: unknown; longitude?: unknown } | null) =>
    coordinate(item?.latitude, item?.longitude),
  );
  if (points.some((point) => point === null)) {
    res.status(400).json({ error: 'every point needs a valid latitude and longitude' });
    return;
  }

  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: GEO_NOT_SET_UP });
    return;
  }
  if (routeLimited(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many route requests. Try again in a minute.' });
    return;
  }

  try {
    res.json(await planRoute(points as RoutePoint[], apiKey));
  } catch (error) {
    console.error('Route failed:', error instanceof GeoError ? error.message : 'unexpected error');
    res.status(502).json({ error: 'Routing is unavailable right now.' });
  }
}));

app.get('/api/geo/tile/:style/:z/:x/:y', wrap(async (req, res) => {
  const tile = parseTileAddress(req.params.style, req.params.z, req.params.x, req.params.y);
  if (!tile) {
    res.status(400).json({ error: 'That is not a valid map tile' });
    return;
  }

  const sendTile = (bytes: Buffer) => {
    res.set('Cache-Control', `public, max-age=${TILE_MAX_AGE_SECONDS}`).type('png').send(bytes);
  };
  const key = `${tile.style}/${tile.z}/${tile.x}/${tile.y}`;

  // Saved tiles cost no credits, so they need neither the key nor the limit.
  const saved = tileCache.get(key);
  if (saved) {
    sendTile(saved);
    return;
  }

  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({ error: GEO_NOT_SET_UP });
    return;
  }
  if (!tileCache.isPending(key) && tilesLimited(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many map tiles. Try again in a minute.' });
    return;
  }

  try {
    sendTile(await tileCache.load(key, () => fetchTile(tile, apiKey)));
  } catch (error) {
    console.error('Map tile failed:', error instanceof GeoError ? error.message : 'unexpected error');
    res.status(502).json({ error: 'The map is unavailable right now.' });
  }
}));

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = Number(process.env.PORT ?? 3000);

migrate()
  .then(() => {
    app.listen(port, () => {
      console.log(`CoDrive API listening on http://localhost:${port}`);
    });
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });

function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

function descriptionText(value: unknown): string | null {
  if (value === undefined) return '';
  if (typeof value !== 'string') return null;
  return value.trim();
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

function makeShareCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

function tripRow(row: {
  id: string;
  title: string;
  share_code: string;
  budget: number | string | null;
  created_at: Date | string;
}) {
  return {
    id: row.id,
    title: row.title,
    share_code: row.share_code,
    budget: Number(row.budget),
    created_at: new Date(row.created_at).toISOString(),
  };
}

function waypointRow(row: {
  id: string;
  trip_id: string;
  name: string;
  latitude: number | string;
  longitude: number | string;
  sequence_order: number | string;
}) {
  return {
    id: row.id,
    trip_id: row.trip_id,
    name: row.name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    sequence_order: Number(row.sequence_order),
  };
}

function expenseRow(row: {
  id: string;
  trip_id: string;
  paid_by_user: string;
  amount: number | string;
  category: string;
  description: string;
}) {
  return {
    id: row.id,
    trip_id: row.trip_id,
    paid_by_user: row.paid_by_user,
    amount: Number(row.amount),
    category: row.category,
    description: row.description,
  };
}

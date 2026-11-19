import { randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  bearerToken,
  createSession,
  currentUser,
  endSession,
  hashPassword,
  requireUser,
  verifyPassword,
  type User,
} from './auth.js';
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
app.disable('x-powered-by');
// Behind a host's proxy (Render), req.ip is the proxy unless the forwarded address is trusted.
// Rate limits are per caller, so set TRUST_PROXY=1 there. Leave it unset locally.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.use(express.json({ limit: '25mb' }));
app.use((req, res, next) => {
  // Sign-in uses a bearer token, not cookies, so allowing any origin does not expose other users' data.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
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

const signInLimited = createRateLimiter(20, 60_000);
const emailLimited = createRateLimiter(10, 15 * 60_000);
const joinLimited = createRateLimiter(10, 60_000);

app.post('/api/auth/signup', wrap(async (req, res) => {
  if (signInLimited(req.ip ?? 'unknown')) {
    res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    return;
  }
  const name = text(req.body?.name);
  const email = emailText(req.body?.email);
  const password = req.body?.password;
  if (!name || name.length > 60) {
    res.status(400).json({ error: 'Enter a name up to 60 characters' });
    return;
  }
  if (!email) {
    res.status(400).json({ error: 'Enter a valid email address' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    res.status(400).json({ error: 'Use a password of at least 8 characters' });
    return;
  }

  try {
    const result = await pool.query<User>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email, name, await hashPassword(password)],
    );
    const user = result.rows[0];
    res.status(201).json({ token: await createSession(user.id), user });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: 'An account with that email already exists. Sign in instead.' });
      return;
    }
    throw error;
  }
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = emailText(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (signInLimited(req.ip ?? 'unknown') || (email && emailLimited(email))) {
    res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
    return;
  }

  const result = email
    ? await pool.query<User & { password_hash: string }>(
        'SELECT id, email, name, password_hash FROM users WHERE lower(email) = $1',
        [email],
      )
    : null;
  const found = result?.rows[0];
  const ok = await verifyPassword(password, found?.password_hash ?? null);
  if (!found || !ok) {
    res.status(401).json({ error: 'That email and password do not match' });
    return;
  }
  res.json({ token: await createSession(found.id), user: { id: found.id, email: found.email, name: found.name } });
}));

app.post('/api/auth/logout', wrap(async (req, res) => {
  const token = bearerToken(req);
  if (token) await endSession(token);
  res.sendStatus(204);
}));

app.get('/api/auth/me', requireUser, (_req, res) => {
  res.json({ user: currentUser(res) });
});

app.use('/api/trips', requireUser);

app.post('/api/trips', wrap(async (req, res) => {
  const user = currentUser(res);
  const title = text(req.body?.title);
  if (!title || title.length > 120) {
    res.status(400).json({ error: 'title is required, up to 120 characters' });
    return;
  }

  // The budget is optional. If it is given, it must be above 0.
  const budget = req.body?.budget === undefined || req.body?.budget === null ? null : number(req.body.budget);
  if (req.body?.budget !== undefined && req.body?.budget !== null && (budget === null || budget <= 0)) {
    res.status(400).json({ error: 'budget must be greater than 0' });
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `INSERT INTO trips (title, share_code, budget, owner_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [title, makeShareCode(), budget, user.id],
      );
      const tripId: string = result.rows[0].id;
      await client.query(
        `INSERT INTO trip_members (trip_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [tripId, user.id],
      );
      await client.query('COMMIT');
      res.status(201).json(await findTrip(tripId, user.id));
      return;
    } catch (error) {
      await client.query('ROLLBACK');
      if (isUniqueViolation(error)) continue;
      throw error;
    } finally {
      client.release();
    }
  }

  res.status(500).json({ error: 'Could not create a share code' });
}));

app.post('/api/trips/join', wrap(async (req, res) => {
  const user = currentUser(res);
  // Share codes are the only way in, so guessing them is limited per account and per caller.
  if (joinLimited(`user:${user.id}`) || joinLimited(`ip:${req.ip ?? 'unknown'}`)) {
    res.status(429).json({ error: 'Too many tries. Try again in a minute.' });
    return;
  }
  const code = text(req.body?.share_code)?.toUpperCase();
  if (!code || !/^[A-Z0-9_-]{4,16}$/.test(code)) {
    res.status(400).json({ error: 'Enter the share code from your invite' });
    return;
  }

  const trip = await pool.query('SELECT id FROM trips WHERE upper(share_code) = $1 AND owner_id IS NOT NULL', [code]);
  if (trip.rowCount === 0) {
    res.status(404).json({ error: 'No trip has that share code' });
    return;
  }
  const tripId: string = trip.rows[0].id;
  await pool.query(
    `INSERT INTO trip_members (trip_id, user_id) VALUES ($1, $2)
     ON CONFLICT (trip_id, user_id) DO NOTHING`,
    [tripId, user.id],
  );
  res.json(await findTrip(tripId, user.id));
}));

/** The owner deletes the trip for everyone. Anyone else just leaves it. */
app.delete('/api/trips/:id', wrap(async (req, res) => {
  const user = currentUser(res);
  const tripId = req.params.id;
  if (!isUuid(tripId)) {
    res.status(400).json({ error: 'trip id must be a uuid' });
    return;
  }
  const role = await memberRole(tripId, user.id);
  if (!role) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  if (role === 'owner') {
    await pool.query('DELETE FROM trips WHERE id = $1 AND owner_id = $2', [tripId, user.id]);
  } else {
    await pool.query('DELETE FROM trip_members WHERE trip_id = $1 AND user_id = $2', [tripId, user.id]);
  }
  res.sendStatus(204);
}));

app.post('/api/trips/:id/waypoints', wrap(async (req, res) => {
  const user = currentUser(res);
  const tripId = req.params.id;
  if (!isUuid(tripId)) {
    res.status(400).json({ error: 'trip id must be a uuid' });
    return;
  }

  // The location is optional: a stop typed without picking a suggestion has none yet.
  const stop = place(req.body);
  if (!stop) {
    res.status(400).json({ error: 'name is required, with a valid latitude and longitude if given' });
    return;
  }
  const note = descriptionText(req.body?.note);
  if (note === null || note.length > 500) {
    res.status(400).json({ error: 'note must be text up to 500 characters' });
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
    const trip = await client.query(
      'SELECT trip_id FROM trip_members WHERE trip_id = $1 AND user_id = $2 FOR SHARE',
      [tripId, user.id],
    );
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
      `INSERT INTO waypoints (trip_id, name, latitude, longitude, sequence_order, note, proposed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [tripId, stop.name, stop.latitude, stop.longitude, sequenceOrder, note, user.id],
    );
    await client.query('COMMIT');
    const [saved] = await findWaypoints(pool, tripId, user.id, inserted.rows[0].id);
    res.status(201).json(saved);
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
  const result = await pool.query(`${TRIP_SELECT} ORDER BY t.created_at DESC`, [currentUser(res).id]);
  res.json(result.rows.map(tripRow));
}));

app.get('/api/trips/:id', wrap(async (req, res) => {
  const tripId = req.params.id;
  if (!isUuid(tripId)) {
    res.status(400).json({ error: 'trip id must be a uuid' });
    return;
  }

  // Trips you are not on answer 404, the same as trips that do not exist.
  const trip = await tripDetail(tripId, currentUser(res).id);
  if (!trip) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }
  res.json(trip);
}));

/**
 * Saves the Trip tab. Every field is optional and only the ones sent change.
 * `start` and `end` are `{ name, latitude?, longitude? }`, or null to remove that stop.
 */
app.patch('/api/trips/:id', wrap(async (req, res) => {
  const user = currentUser(res);
  const tripId = req.params.id;
  if (!isUuid(tripId)) {
    res.status(400).json({ error: 'trip id must be a uuid' });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length + 1}`);
  };
  const fail = (error: string) => {
    res.status(400).json({ error });
  };

  if (body.title !== undefined) {
    const title = text(body.title);
    if (!title || title.length > 120) return fail('title is required, up to 120 characters');
    set('title', title);
  }
  if (body.budget !== undefined) {
    const budget = body.budget === null ? null : number(body.budget);
    if (body.budget !== null && (budget === null || budget <= 0)) return fail('budget must be greater than 0');
    set('budget', budget);
  }
  const startDate = body.start_date === undefined ? undefined : isoDate(body.start_date);
  const endDate = body.end_date === undefined ? undefined : isoDate(body.end_date);
  if (body.start_date !== undefined && startDate === undefined) return fail('start_date must be YYYY-MM-DD');
  if (body.end_date !== undefined && endDate === undefined) return fail('end_date must be YYYY-MM-DD');
  if (startDate && endDate && endDate < startDate) return fail('end_date cannot be before start_date');
  if (startDate !== undefined) set('start_date', startDate);
  if (endDate !== undefined) set('end_date', endDate);
  if (body.image !== undefined) {
    const image = tripImage(body.image);
    if (image === undefined) return fail('image must be an https URL or an image under 3 MB');
    set('image', image);
  }
  if (body.drivers !== undefined) {
    const drivers = driverList(body.drivers);
    if (!drivers) return fail('drivers must list crew ids with limits from 60 to 720 minutes');
    set('drivers', JSON.stringify(drivers));
  }
  if (body.guests !== undefined) {
    const guests = guestList(body.guests);
    if (!guests) return fail(`guests must list up to ${MAX_CREW} names`);
    set('guests', JSON.stringify(guests));
  }
  const endpoints: { role: 'start' | 'end'; stop: Place | null }[] = [];
  for (const role of ['start', 'end'] as const) {
    if (body[role] === undefined) continue;
    const stop = body[role] === null ? null : place(body[role]);
    if (stop === undefined) return fail(`${role} needs a name, with a valid latitude and longitude if given`);
    endpoints.push({ role, stop });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const member = await client.query(
      'SELECT trip_id FROM trip_members WHERE trip_id = $1 AND user_id = $2',
      [tripId, user.id],
    );
    if (member.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Trip not found' });
      return;
    }
    // Locks the trip so two saves cannot both add a Start or pick the same stop order.
    await client.query('SELECT id FROM trips WHERE id = $1 FOR UPDATE', [tripId]);
    if (sets.length > 0) {
      await client.query(`UPDATE trips SET ${sets.join(', ')} WHERE id = $1`, [tripId, ...values]);
    }
    for (const { role, stop } of endpoints) {
      if (!stop) {
        await client.query('DELETE FROM waypoints WHERE trip_id = $1 AND role = $2', [tripId, role]);
        continue;
      }
      const updated = await client.query(
        'UPDATE waypoints SET name = $3, latitude = $4, longitude = $5 WHERE trip_id = $1 AND role = $2',
        [tripId, role, stop.name, stop.latitude, stop.longitude],
      );
      if (updated.rowCount === 0) {
        await client.query(
          `INSERT INTO waypoints (trip_id, name, latitude, longitude, sequence_order, role, proposed_by)
           VALUES ($1, $2, $3, $4,
             (SELECT COALESCE(MAX(sequence_order), -1) + 1 FROM waypoints WHERE trip_id = $1), $5, $6)`,
          [tripId, stop.name, stop.latitude, stop.longitude, role, user.id],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json(await tripDetail(tripId, user.id));
}));

/** Sets your vote on a stop. `{ "vote": "up" | "down" | null }`; null takes it back. */
app.put('/api/trips/:id/waypoints/:waypointId/vote', wrap(async (req, res) => {
  const user = currentUser(res);
  const { id: tripId, waypointId } = req.params;
  if (!isUuid(tripId) || !isUuid(waypointId)) {
    res.status(400).json({ error: 'trip and stop ids must be uuids' });
    return;
  }
  const vote = req.body?.vote;
  if (vote !== null && vote !== 'up' && vote !== 'down') {
    res.status(400).json({ error: 'vote must be "up", "down", or null' });
    return;
  }
  const found = await pool.query(
    `SELECT w.id FROM waypoints w
     JOIN trip_members m ON m.trip_id = w.trip_id AND m.user_id = $3
     WHERE w.id = $2 AND w.trip_id = $1`,
    [tripId, waypointId, user.id],
  );
  if (found.rowCount === 0) {
    res.status(404).json({ error: 'Stop not found' });
    return;
  }
  if (vote === null) {
    await pool.query('DELETE FROM waypoint_votes WHERE waypoint_id = $1 AND user_id = $2', [waypointId, user.id]);
  } else {
    await pool.query(
      `INSERT INTO waypoint_votes (waypoint_id, user_id, vote) VALUES ($1, $2, $3)
       ON CONFLICT (waypoint_id, user_id) DO UPDATE SET vote = EXCLUDED.vote`,
      [waypointId, user.id, vote],
    );
  }
  const [saved] = await findWaypoints(pool, tripId, user.id, waypointId);
  res.json(saved);
}));

/**
 * Removes a stop, and its votes, for everyone on the trip. You can remove your own suggestions; the trip's owner
 * can remove anyone's, and is the only one who can remove the Start or End.
 */
app.delete('/api/trips/:id/waypoints/:waypointId', wrap(async (req, res) => {
  const user = currentUser(res);
  const { id: tripId, waypointId } = req.params;
  if (!isUuid(tripId) || !isUuid(waypointId)) {
    res.status(400).json({ error: 'trip and stop ids must be uuids' });
    return;
  }
  const found = await pool.query(
    `SELECT w.role, w.proposed_by, m.role AS member_role FROM waypoints w
     JOIN trip_members m ON m.trip_id = w.trip_id AND m.user_id = $3
     WHERE w.id = $2 AND w.trip_id = $1`,
    [tripId, waypointId, user.id],
  );
  if (found.rowCount === 0) {
    res.status(404).json({ error: 'Stop not found' });
    return;
  }
  const stop = found.rows[0] as { role: 'start' | 'end' | null; proposed_by: string | null; member_role: string };
  const owner = stop.member_role === 'owner';
  if (stop.role && !owner) {
    res.status(403).json({ error: 'Only the trip owner can remove the start or end' });
    return;
  }
  if (!stop.role && !owner && stop.proposed_by !== user.id) {
    res.status(403).json({ error: 'You can only remove your own suggestions' });
    return;
  }
  await pool.query('DELETE FROM waypoints WHERE id = $1 AND trip_id = $2', [waypointId, tripId]);
  res.sendStatus(204);
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
  const title = descriptionText(req.body?.title);
  const description = descriptionText(req.body?.description);
  const photos = photoList(req.body?.photos);
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
  if (title === null) {
    res.status(400).json({ error: 'title must be text' });
    return;
  }
  if (photos === null) {
    res.status(400).json({ error: `photos must be up to ${MAX_PHOTOS} image data URLs` });
    return;
  }

  const user = currentUser(res);
  if (!(await memberRole(tripId, user.id))) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }

  const inserted = await pool.query(
    `INSERT INTO expenses (trip_id, paid_by_user, amount, category, title, description, photos, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, trip_id, paid_by_user, amount, category, title, description, photos`,
    [tripId, paidByUser, amount, category, title, description, photos, user.id],
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

app.get('/api/geo/autocomplete', requireUser, wrap(async (req, res) => {
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
  if (addressSearchLimited(currentUser(res).id)) {
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

app.get('/api/geo/places', requireUser, wrap(async (req, res) => {
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
  if (placesLimited(currentUser(res).id)) {
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

app.post('/api/geo/route', requireUser, wrap(async (req, res) => {
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
  if (routeLimited(currentUser(res).id)) {
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

const MAX_PHOTOS = 4;
const MAX_PHOTO_LENGTH = 6_000_000;

function photoList(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PHOTOS) return null;
  const valid = value.every(
    (item) => typeof item === 'string' && item.startsWith('data:image/') && item.length <= MAX_PHOTO_LENGTH,
  );
  return valid ? (value as string[]) : null;
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
  const bytes = randomBytes(8);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

function emailText(value: unknown): string | null {
  const email = text(value)?.toLowerCase();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Trips the user in $1 is on. Members show only their id and name, never their email. */
const TRIP_SELECT = `
  SELECT t.id, t.title, t.share_code, t.budget, t.created_at, me.role,
    to_char(t.start_date, 'YYYY-MM-DD') AS start_date, to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
    t.image, t.drivers, t.guests,
    (SELECT json_agg(json_build_object('id', u.id, 'name', u.name, 'role', m.role) ORDER BY m.joined_at)
     FROM trip_members m JOIN users u ON u.id = m.user_id
     WHERE m.trip_id = t.id) AS members
  FROM trips t
  JOIN trip_members me ON me.trip_id = t.id AND me.user_id = $1`;

async function findTrip(tripId: string, userId: string) {
  const result = await pool.query(`${TRIP_SELECT} WHERE t.id = $2`, [userId, tripId]);
  return result.rowCount === 0 ? null : tripRow(result.rows[0]);
}

async function memberRole(tripId: string, userId: string): Promise<'owner' | 'member' | null> {
  const result = await pool.query('SELECT role FROM trip_members WHERE trip_id = $1 AND user_id = $2', [tripId, userId]);
  return result.rows[0]?.role ?? null;
}

type Member = { id: string; name: string; role: 'owner' | 'member' };

function tripRow(row: {
  id: string;
  title: string;
  share_code: string;
  budget: number | string | null;
  created_at: Date | string;
  role: 'owner' | 'member';
  members: Member[] | null;
  start_date: string | null;
  end_date: string | null;
  image: string | null;
  drivers: Driver[] | null;
  guests: Guest[] | null;
}) {
  return {
    id: row.id,
    title: row.title,
    share_code: row.share_code,
    budget: Number(row.budget),
    created_at: new Date(row.created_at).toISOString(),
    role: row.role,
    members: row.members ?? [],
    start_date: row.start_date,
    end_date: row.end_date,
    image: row.image,
    drivers: row.drivers ?? [],
    guests: row.guests ?? [],
  };
}

/** A trip with its stops and expenses, as the user in `userId` sees it. */
async function tripDetail(tripId: string, userId: string) {
  const trip = await findTrip(tripId, userId);
  if (!trip) return null;
  const expenses = await pool.query(
    `SELECT id, trip_id, paid_by_user, amount, category, title, description, photos
     FROM expenses
     WHERE trip_id = $1
     ORDER BY created_at DESC`,
    [tripId],
  );
  return {
    ...trip,
    waypoints: await findWaypoints(pool, tripId, userId),
    expenses: expenses.rows.map(expenseRow),
  };
}

type Queryable = Pick<typeof pool, 'query'>;

/** A trip's stops in order, with vote counts and the vote of the user in `userId`. */
async function findWaypoints(db: Queryable, tripId: string, userId: string, waypointId?: string) {
  const result = await db.query(
    `SELECT w.id, w.trip_id, w.name, w.latitude, w.longitude, w.sequence_order, w.role, w.note,
       u.name AS proposed_by, w.proposed_by AS proposed_by_id,
       (SELECT count(*) FROM waypoint_votes v WHERE v.waypoint_id = w.id AND v.vote = 'up') AS likes,
       (SELECT count(*) FROM waypoint_votes v WHERE v.waypoint_id = w.id AND v.vote = 'down') AS dislikes,
       (SELECT v.vote FROM waypoint_votes v WHERE v.waypoint_id = w.id AND v.user_id = $2) AS my_vote
     FROM waypoints w
     LEFT JOIN users u ON u.id = w.proposed_by
     WHERE w.trip_id = $1 AND ($3::uuid IS NULL OR w.id = $3::uuid)
     ORDER BY w.sequence_order`,
    [tripId, userId, waypointId ?? null],
  );
  return result.rows.map(waypointRow);
}

function waypointRow(row: {
  id: string;
  trip_id: string;
  name: string;
  latitude: number | string | null;
  longitude: number | string | null;
  sequence_order: number | string;
  role: 'start' | 'end' | null;
  note: string;
  proposed_by: string | null;
  proposed_by_id: string | null;
  likes: number | string;
  dislikes: number | string;
  my_vote: 'up' | 'down' | null;
}) {
  return {
    id: row.id,
    trip_id: row.trip_id,
    name: row.name,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    sequence_order: Number(row.sequence_order),
    role: row.role,
    note: row.note,
    proposed_by: row.proposed_by,
    proposed_by_id: row.proposed_by_id,
    likes: Number(row.likes),
    dislikes: Number(row.dislikes),
    my_vote: row.my_vote,
  };
}

type Driver = { crewId: string; limitMinutes: number };
type Guest = { id: string; name: string };

const MAX_CREW = 30;

function driverList(value: unknown): Driver[] | null {
  if (!Array.isArray(value) || value.length > MAX_CREW) return null;
  const drivers: Driver[] = [];
  for (const item of value) {
    const crewId = text(item?.crewId);
    const limitMinutes = number(item?.limitMinutes);
    if (!crewId || crewId.length > 80 || limitMinutes === null || !Number.isInteger(limitMinutes)) return null;
    if (limitMinutes < 60 || limitMinutes > 720) return null;
    drivers.push({ crewId, limitMinutes });
  }
  return drivers;
}

function guestList(value: unknown): Guest[] | null {
  if (!Array.isArray(value) || value.length > MAX_CREW) return null;
  const guests: Guest[] = [];
  for (const item of value) {
    const id = text(item?.id);
    const name = text(item?.name);
    if (!id || id.length > 80 || !name || name.length > 60) return null;
    guests.push({ id, name });
  }
  return guests;
}

const MAX_IMAGE_LENGTH = 3_000_000;

/** The trip picture: an https URL or an image data URL. null goes back to the default. */
function tripImage(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  if (value.startsWith('https://') && value.length <= 2000) return value;
  if (value.startsWith('data:image/') && value.length <= MAX_IMAGE_LENGTH) return value;
  return undefined;
}

function isoDate(value: unknown): string | null | undefined {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

type Place = { name: string; latitude: number | null; longitude: number | null };

/** A stop's name and optional location. Gives undefined if it is not valid. */
function place(value: unknown): Place | undefined {
  const body = value as { name?: unknown; latitude?: unknown; longitude?: unknown } | null;
  const name = text(body?.name);
  if (!name || name.length > 200) return undefined;
  const hasLocation = body?.latitude !== undefined && body?.latitude !== null;
  if (!hasLocation) return { name, latitude: null, longitude: null };
  const point = coordinate(body?.latitude, body?.longitude);
  return point ? { name, ...point } : undefined;
}

function expenseRow(row: {
  id: string;
  trip_id: string;
  paid_by_user: string;
  amount: number | string;
  category: string;
  title: string;
  description: string;
  photos: string[] | null;
}) {
  return {
    id: row.id,
    trip_id: row.trip_id,
    paid_by_user: row.paid_by_user,
    amount: Number(row.amount),
    category: row.category,
    title: row.title,
    description: row.description,
    photos: row.photos ?? [],
  };
}

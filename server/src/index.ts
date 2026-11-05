import { randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { migrate, pool } from './db.js';

const app = express();
app.use(express.json({ limit: '25mb' }));
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

  const budget = number(req.body?.budget);
  if (budget === null || budget <= 0) {
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
    `SELECT id, trip_id, paid_by_user, amount, category, title, description, photos
     FROM expenses
     WHERE trip_id = $1
     ORDER BY created_at DESC`,
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

  const trip = await pool.query('SELECT id FROM trips WHERE id = $1', [tripId]);
  if (trip.rowCount === 0) {
    res.status(404).json({ error: 'Trip not found' });
    return;
  }

  const inserted = await pool.query(
    `INSERT INTO expenses (trip_id, paid_by_user, amount, category, title, description, photos)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, trip_id, paid_by_user, amount, category, title, description, photos`,
    [tripId, paidByUser, amount, category, title, description, photos],
  );
  res.status(201).json(expenseRow(inserted.rows[0]));
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
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('');
}

function tripRow(row: {
  id: string;
  title: string;
  share_code: string;
  budget: number | string;
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

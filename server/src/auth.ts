import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { pool } from './db.js';

export type User = { id: string; email: string; name: string };

const SESSION_DAYS = 60;
const KEY_LENGTH = 64;
// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = `scrypt$${randomBytes(16).toString('hex')}$${randomBytes(KEY_LENGTH).toString('hex')}`;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null) {
  const [scheme, saltHex, keyHex] = (stored ?? DUMMY_HASH).split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'));
  return stored !== null && actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  await pool.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()', [userId]);
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), userId, SESSION_DAYS],
  );
  return token;
}

export async function endSession(token: string) {
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
}

export function bearerToken(req: Request) {
  const header = req.get('authorization') ?? '';
  const match = /^Bearer ([A-Za-z0-9_-]{20,200})$/.exec(header.trim());
  return match ? match[1] : null;
}

/** Rejects the request unless it carries a live session. The signed-in user is then `currentUser(res)`. */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sign in to continue' });
    return;
  }
  pool
    .query<User>(
      `SELECT users.id, users.email, users.name
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = $1 AND sessions.expires_at > now()`,
      [hashToken(token)],
    )
    .then((result) => {
      if (result.rowCount === 0) {
        res.status(401).json({ error: 'Your session has ended. Sign in again.' });
        return;
      }
      res.locals.user = result.rows[0];
      next();
    })
    .catch(next);
}

export function currentUser(res: Response): User {
  return res.locals.user as User;
}

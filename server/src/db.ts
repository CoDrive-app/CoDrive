import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(join(serverRoot, '.env'));

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/** Runs every file in sql/ in name order. Each file must be safe to run again on every start. */
export async function migrate() {
  const dir = join(serverRoot, 'sql');
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    await pool.query(readFileSync(join(dir, file), 'utf8'));
  }
}

function loadEnv(envPath: string) {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

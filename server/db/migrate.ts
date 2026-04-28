import { getPool } from './client.js';
import { migrations } from './migrations.js';

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  if (!pool) {
    console.log('[migrate] DATABASE_URL not set, skipping');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  for (const m of migrations) {
    const { rows } = await pool.query('SELECT 1 FROM _migrations WHERE name = $1', [m.name]);
    if (rows.length > 0) continue;

    console.log(`[migrate] applying ${m.name}`);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(m.sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [m.name]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  console.log('[migrate] done');
}

// Allow running directly: `node dist/server/db/migrate.js`
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}

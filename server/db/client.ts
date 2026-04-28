import pg from 'pg';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (!process.env.DATABASE_URL) return null;
  if (poolInstance) return poolInstance;

  poolInstance = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false'
      ? false
      : process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    max: 5,
  });

  poolInstance.on('error', (err) => {
    console.error('[db] pool error:', err);
  });

  return poolInstance;
}

export function isDbEnabled(): boolean {
  return getPool() !== null;
}

import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
  ssl: config.databaseSsl,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});


export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 2_000,
  ssl: config.databaseSsl,
  // Supabase pooler requires this
  keepAlive: true,
});
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: requireEnv('DATABASE_URL'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  const migrationPath = path.resolve(process.cwd(), 'src/db/migrations/001_init.sql');
  const sql = await readFile(migrationPath, 'utf8');

  try {
    await pool.query(sql);
    console.log('Migration applied: 001_init.sql');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

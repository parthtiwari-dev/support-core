import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { config } from '../config';

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl,
  });

  const migrationsDir = path.resolve(process.cwd(), 'src/db/migrations');
  const migrationFiles = (await readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  try {
    for (const file of migrationFiles) {
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      console.log(`Migration applied: ${file}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

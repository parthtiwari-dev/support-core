import { app } from './app';
import { config } from './config';
import { pool } from './db';

async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('✓ PostgreSQL connected');
  } catch (err) {
    console.error('✗ PostgreSQL connection failed:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`✓ Server running on port ${config.port}`);
  });
}

start();

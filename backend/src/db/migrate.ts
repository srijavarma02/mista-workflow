import fs from 'fs';
import path from 'path';
import { pool } from '../config/database';
import dotenv from 'dotenv';

dotenv.config();

async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const applied = await client.query(
        'SELECT id FROM _migrations WHERE filename = $1',
        [file]
      );
      if (applied.rows.length > 0) {
        console.log(`⏭  Skipping already applied: ${file}`);
        continue;
      }

      console.log(`▶  Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`✅  Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌  Failed: ${file}`, err);
        throw err;
      }
    }

    console.log('\n✅  All migrations applied.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });

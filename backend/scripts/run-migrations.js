/**
 * Migration runner.
 * Reads all .sql files from database/migrations/ in filename-alphabetical order,
 * tracks applied migrations in schema_migrations, skips already-applied ones.
 * Exits with code 1 on any failure — stops the deploy.
 */
import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  process.stderr.write('[migrate] DATABASE_URL is not set. Cannot run migrations.\n');
  process.exit(1);
}

const MIGRATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../database/migrations');

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  onnotice: () => {},
});

async function run() {
  process.stdout.write('[migrate] Starting migration runner…\n');

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT        PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INTEGER
    )
  `;

  let files;
  try {
    files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch {
    process.stderr.write(`[migrate] Cannot read migrations directory: ${MIGRATIONS_DIR}\n`);
    process.exit(1);
  }

  const appliedRows = await sql`SELECT filename FROM schema_migrations`;
  const applied = new Set(appliedRows.map((r) => r.filename));

  let ran = 0;
  let skipped = 0;

  for (const file of files) {
    if (applied.has(file)) {
      process.stdout.write(`[migrate] SKIP   ${file}\n`);
      skipped++;
      continue;
    }

    let content;
    try {
      content = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    } catch {
      process.stderr.write(`[migrate] FAIL   ${file}: cannot read file\n`);
      process.exit(1);
    }

    const start = Date.now();
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO schema_migrations (filename, applied_at, duration_ms)
          VALUES (${file}, NOW(), ${Date.now() - start})
        `;
      });
      const ms = Date.now() - start;
      process.stdout.write(`[migrate] OK     ${file}  (${ms}ms)\n`);
      ran++;
    } catch (error) {
      process.stderr.write(`[migrate] FAIL   ${file}: ${error.message}\n`);
      process.exit(1);
    }
  }

  process.stdout.write(`[migrate] Done — ${ran} applied, ${skipped} skipped.\n`);
  await sql.end();
}

run().catch((error) => {
  process.stderr.write(`[migrate] Fatal: ${error.message}\n`);
  process.exit(1);
});

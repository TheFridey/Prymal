import { bootstrapRuntimeEnv } from '../env.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { logger } from '../lib/logger.js';

bootstrapRuntimeEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  logger.error('db.migrate.missing_url');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

try {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  });
  logger.info('db.migrate.applied');
} finally {
  await client.end({ timeout: 5 });
}

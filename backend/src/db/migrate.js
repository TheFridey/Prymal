import { bootstrapRuntimeEnv } from '../env.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

bootstrapRuntimeEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required to run migrations.');
  process.exit(1);
}

const client = postgres(connectionString, { max: 1 });

try {
  await migrate(client, {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });
  console.log('Drizzle migrations applied.');
} finally {
  await client.end({ timeout: 5 });
}

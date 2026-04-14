// ─────────────────────────────────────────────────────────────────
// axiom/backend/src/db/index.js
// Drizzle ORM + postgres connection
// ─────────────────────────────────────────────────────────────────

import { bootstrapRuntimeEnv } from '../env.js';
import { drizzle }  from 'drizzle-orm/postgres-js';
import postgres     from 'postgres';
import * as schema  from './schema.js';

bootstrapRuntimeEnv();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and set DATABASE_URL before starting the API.',
  );
}

// postgres-js client — pooled for API, single for migrations
const client = postgres(connectionString, {
  max:         20,       // Connection pool size
  idle_timeout: 30,     // Seconds before idle connection is closed
  connect_timeout: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  onnotice: () => {},   // Suppress postgres notices in logs
});

export const db = drizzle(client, { schema, logger: process.env.NODE_ENV === 'development' });

// Health check
export async function checkDbConnection() {
  try {
    await client`SELECT 1`;
    return true;
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    return false;
  }
}

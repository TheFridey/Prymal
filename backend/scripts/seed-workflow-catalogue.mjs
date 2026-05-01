#!/usr/bin/env node

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OFFICIAL_WORKFLOW_CATALOGUE_ITEMS,
  createOfficialCatalogueItem,
} from '../src/services/workflow-catalogue.js';
import { db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: false });

const seedUserId = process.env.WORKFLOW_CATALOGUE_SEED_USER_ID?.trim() || 'prymal-system';

await db.insert(users).values({
  id: seedUserId,
  email: `${seedUserId}@system.prymal.local`,
  role: 'owner',
  firstName: 'Prymal',
  lastName: 'System',
}).onConflictDoNothing();

for (const item of OFFICIAL_WORKFLOW_CATALOGUE_ITEMS) {
  const result = await createOfficialCatalogueItem(seedUserId, item);
  console.log(`Seeded workflow catalogue item: ${result.slug}`);
}

console.log(`Workflow catalogue seed complete (${OFFICIAL_WORKFLOW_CATALOGUE_ITEMS.length} official items).`);

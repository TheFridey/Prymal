import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function read(relativePath) {
  return fs.readFile(path.resolve(__dirname, relativePath), 'utf8');
}

test('index mounts auth rate limits per route instead of with a blanket wildcard', async () => {
  const source = await read('./index.js');

  assert.doesNotMatch(source, /app\.use\('\/api\/auth\/\*'/);
  assert.match(source, /app\.use\('\/api\/auth\/me', authReadLimiter\)/);
  assert.match(source, /app\.use\('\/api\/auth\/onboard', authMutationLimiter\)/);
  assert.match(source, /app\.use\('\/api\/auth\/team\/\*', authMutationLimiter\)/);
});

test('sensitive routes use the expected hardened rate limiters', async () => {
  const billingSource = await read('./routes/billing.js');
  const integrationsSource = await read('./routes/integrations.js');
  const workflowsSource = await read('./routes/workflows.js');
  const adminBillingSource = await read('./routes/admin/billing.js');
  const adminUsersSource = await read('./routes/admin/users.js');

  assert.match(billingSource, /router\.post\('\/checkout', requireOrg, requireRole\('owner', 'admin'\), billingMutationRateLimit,/);
  assert.match(billingSource, /router\.post\('\/portal', requireOrg, requireRole\('owner', 'admin'\), billingMutationRateLimit,/);
  assert.match(integrationsSource, /router\.get\('\/:service\/connect', requireOrg, requireRole\('owner', 'admin'\), integrationAuthRateLimit,/);
  assert.match(integrationsSource, /router\.get\('\/:service\/callback', integrationAuthRateLimit,/);
  assert.match(workflowsSource, /router\.post\('\/webhook\/:id\/:secret', workflowWebhookRateLimit,/);
  assert.match(adminBillingSource, /requireStaff,\s+requireStaffPermission\('admin\.credits\.adjust'\),\s+adminSensitiveWriteRateLimit/s);
  assert.match(adminUsersSource, /requireStaff,\s+requireStaffPermission\('admin\.user\.update'\),\s+adminSensitiveWriteRateLimit/s);
});

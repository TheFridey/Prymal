import path from 'node:path';
import { test, expect } from '@playwright/test';
import {
  authStatePath,
  getCredentials,
  signInWith,
  skipIfMissingCredentials,
  uniqueSuffix,
} from './helpers/auth';

test.describe('Authenticated release regressions', () => {
  test('Clerk sign-in lands in the workspace dashboard', async ({ page }) => {
    skipIfMissingCredentials(test, ['user']);

    const credentials = getCredentials('user');
    await signInWith(page, credentials);

    await expect(page).toHaveURL(/\/app\/dashboard/);
    await expect(page.getByText(/dashboard|workspace|recent|credits/i).first()).toBeVisible();
  });
});

test.describe('Owner workflow and LORE flows', () => {
  test.use({ storageState: authStatePath('user') });
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user']);
  });

  test('workflow create, run, and replay stay healthy', async ({ page }) => {
    await page.goto('/app/workflows');
    await expect(page.getByText(/workflow execution and operational oversight/i)).toBeVisible();

    const createResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && /\/api\/workflows$/.test(response.url()),
    );

    await page.getByTestId('workflow-template-content-signal-to-campaign').click();

    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const createResult = await createResponse.json();
    const workflowId = createResult.workflow?.id;

    expect(workflowId).toBeTruthy();
    await expect(page.getByTestId(`workflow-card-${workflowId}`)).toBeVisible();

    const runResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes(`/api/workflows/${workflowId}/run`),
    );

    await page.getByTestId(`workflow-run-${workflowId}`).click();

    const runResponse = await runResponsePromise;
    expect(runResponse.status()).toBe(202);
    const runResult = await runResponse.json();
    const runId = runResult.runId;

    expect(runId).toBeTruthy();
    await expect(page.getByTestId(`workflow-run-row-${runId}`)).toBeVisible({ timeout: 20_000 });

    await page.getByTestId(`workflow-run-row-${runId}`).click();

    const replayResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && response.url().includes(`/api/workflows/runs/${runId}/replay`),
    );

    await page.getByTestId('workflow-replay-run').click();

    const replayResponse = await replayResponsePromise;
    expect(replayResponse.status()).toBe(202);
    const replayResult = await replayResponse.json();
    expect(replayResult.replayOfRunId).toBe(runId);
    await expect(page.getByTestId(`workflow-run-row-${replayResult.runId}`)).toBeVisible({ timeout: 20_000 });
  });

  test('LORE file upload and contradiction warnings render clearly', async ({ page }) => {
    const suffix = uniqueSuffix('lore');
    const baselineTitle = `Refund policy baseline ${suffix}`;
    const conflictingTitle = `Refund policy conflict ${suffix}`;
    const fixturePath = path.resolve(process.cwd(), 'tests', 'fixtures', 'lore-upload.md');

    await page.goto('/app/lore');
    await expect(page.getByText(/organisation knowledge base|document inventory|add knowledge/i).first()).toBeVisible();

    await page.getByTestId('lore-file-input').setInputFiles(fixturePath);
    await expect(page.getByText(/lore-upload\.md/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/queued for indexing|upload complete/i).first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('lore-mode-text').click();
    await page.getByTestId('lore-title').fill(baselineTitle);
    await page.getByTestId('lore-content').fill(
      `Prymal policy baseline ${suffix}. Refunds are not available after 14 days from purchase. Agencies receive weekday support coverage.`,
    );
    await page.getByTestId('lore-ingest-submit').click();

    const baselineRow = page.locator('.workspace-knowledge-panel__document-row').filter({
      has: page.getByText(baselineTitle),
    });
    await expect(baselineRow).toContainText(/indexed|indexing|pending/i, { timeout: 20_000 });

    await page.getByTestId('lore-title').fill(conflictingTitle);
    await page.getByTestId('lore-content').fill(
      `Prymal policy baseline ${suffix}. Refunds are available after 14 days from purchase. Agencies receive weekday support coverage.`,
    );
    await page.getByTestId('lore-ingest-submit').click();

    await expect(page.getByTestId('lore-contradiction-notice')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/potential conflicts detected/i)).toBeVisible();
  });
});

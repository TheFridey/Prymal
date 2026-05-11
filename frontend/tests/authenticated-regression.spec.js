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

    const templateCard = page.locator('.workflow-template-card').filter({
      has: page.getByRole('heading', { name: /Content Signal to Campaign/i }),
    }).first();
    await expect(templateCard).toBeVisible({ timeout: 15_000 });
    await templateCard.getByRole('button', { name: /Create instantly/i }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const createResult = await createResponse.json();
    const workflowId = createResult.workflow?.id;

    expect(workflowId).toBeTruthy();
    const workflowCard = page.getByTestId(`workflow-card-${workflowId}`);
    await expect(workflowCard).toBeVisible();

    const runRows = page.locator('[data-testid^="workflow-run-row-"]');
    const initialRunCount = await runRows.count();

    await page.getByTestId(`workflow-run-${workflowId}`).click();
    await expect(runRows).toHaveCount(initialRunCount + 1, { timeout: 20_000 });

    const latestRunRow = runRows.first();
    const runTestId = await latestRunRow.getAttribute('data-testid');
    const runId = runTestId?.replace('workflow-run-row-', '') ?? null;
    expect(runId).toBeTruthy();

    await latestRunRow.click();
    await expect(page.getByText(/Execution summary/i).first()).toBeVisible({ timeout: 10_000 });

    const runCountBeforeReplay = await runRows.count();
    await page.getByTestId('workflow-replay-run').click();
    await expect(runRows).toHaveCount(runCountBeforeReplay + 1, { timeout: 20_000 });
  });

  test('LORE upload, text ingest, search, and source rendering stay healthy', async ({ page }) => {
    test.slow();
    const suffix = uniqueSuffix('lore');
    const baselineTitle = `Refund policy baseline ${suffix}`;
    const searchQuestion = `What is the refund policy baseline ${suffix}?`;
    const fixturePath = path.resolve(process.cwd(), 'tests', 'fixtures', 'lore-upload.md');

    await page.goto('/app/lore');
    await expect(page.getByText(/organisation knowledge base|document inventory|add knowledge/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^add$/i }).click();
    const uploadResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST'
      && /\/api\/lore\/upload$/.test(response.url()),
    );
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.ok()).toBeTruthy();

    await page.getByRole('button', { name: /^documents$/i }).click();
    await expect(page.getByText(/lore-upload\.md/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /^add$/i }).click();
    await page.getByPlaceholder(/document title/i).fill(baselineTitle);
    await page.getByPlaceholder(/paste brand, product, policy, or support context/i).fill(
      `Prymal policy baseline ${suffix}. Refunds are not available after 14 days from purchase. Agencies receive weekday support coverage.`,
    );
    await page.getByRole('button', { name: /add to lore/i }).click();

    await page.getByRole('button', { name: /^documents$/i }).click();
    await expect(page.getByText(baselineTitle).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/indexed|indexing|pending/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /^search$/i }).click();
    const searchInput = page.getByPlaceholder(/ask a question about your org knowledge/i);
    const searchResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'GET'
      && /\/api\/lore\/search(?:\?|$)/.test(response.url()),
    );
    await searchInput.fill(searchQuestion);
    await page.getByRole('button', { name: /^search$/i }).nth(1).click();

    const searchResponse = await searchResponsePromise;
    expect(searchResponse.ok()).toBeTruthy();

    const resultTitle = page.getByText(baselineTitle, { exact: true }).last();
    const resultExcerpt = page.getByText(
      `Prymal policy baseline ${suffix}. Refunds are not available after 14 days from purchase. Agencies receive weekday support coverage.`,
      { exact: true },
    );

    await expect(resultTitle).toBeVisible({ timeout: 20_000 });
    await expect(resultExcerpt).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/\d+% match/i).first()).toBeVisible({ timeout: 20_000 });
  });
});

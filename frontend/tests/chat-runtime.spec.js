import { test, expect } from '@playwright/test';
import { authStatePath, skipIfMissingCredentials } from './helpers/auth';

test.describe('Chat runtime regressions', () => {
  test.use({ storageState: authStatePath('user') });
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(() => {
    skipIfMissingCredentials(test, ['user']);
  });

  test('route mode switches to the invoked agent without sending on the wrong lane', async ({ page }) => {
    let chatCalls = 0;
    await page.route('**/api/agents/chat', async (route) => {
      chatCalls += 1;
      await route.abort();
    });

    await page.goto('/app/agents/cipher?new=1');
    await expect(page.locator('.workspace-studio').first()).toBeVisible({ timeout: 15_000 });

    const composer = page.locator('textarea.field--textarea').first();
    await composer.fill('@herald write a concise follow-up email for this lead');
    await page.getByRole('button', { name: /^Send$/i }).click();

    await expect(page).toHaveURL(/\/app\/agents\/herald(?:\?|$)/, { timeout: 10_000 });
    expect(chatCalls).toBe(0);
  });

  test('streaming chat renders partial output before completion', async ({ page }) => {
    await installChatMock(page);
    await page.goto('/app/agents/cipher?new=1');
    await expect(page.locator('.workspace-studio').first()).toBeVisible({ timeout: 15_000 });

    const composer = page.locator('textarea.field--textarea').first();
    await composer.fill('stream the answer in parts');
    const sendButton = page.getByRole('button', { name: /^Send$/i });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(page.getByText('Partial answer').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Partial answer with evidence').first()).toBeVisible({ timeout: 10_000 });
  });

  test('chat failures surface retry UI and reuse the original prompt safely', async ({ page }) => {
    await installChatMock(page);
    await page.goto('/app/agents/cipher?new=1');
    await expect(page.locator('.workspace-studio').first()).toBeVisible({ timeout: 15_000 });

    const composer = page.locator('textarea.field--textarea').first();
    await composer.fill('force error for retry');
    const sendButton = page.getByRole('button', { name: /^Send$/i });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(page.getByText(/Response could not be completed/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Provider temporarily unavailable/i).first()).toBeVisible();

    await page.getByRole('button', { name: /Retry prompt/i }).click();
    await expect(composer).toHaveValue('force error for retry');
  });

  test('SENTINEL hold UI appears without leaking unsafe streamed content', async ({ page }) => {
    await installChatMock(page);
    await page.goto('/app/agents/cipher?new=1');
    await expect(page.locator('.workspace-studio').first()).toBeVisible({ timeout: 15_000 });

    const composer = page.locator('textarea.field--textarea').first();
    await composer.fill('trigger hold response');
    const sendButton = page.getByRole('button', { name: /^Send$/i });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(page.getByText(/SENTINEL paused this output/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/needs a safer framing/i)).toBeVisible();
    await expect(page.getByText(/unsafe leaked draft text/i)).toHaveCount(0);
  });
});

async function installChatMock(page) {
  await page.addInitScript(() => {
    if (window.__prymalChatMockInstalled) {
      return;
    }

    window.__prymalChatMockInstalled = true;
    const originalFetch = window.fetch.bind(window);
    const encoder = new TextEncoder();
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    window.fetch = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input?.url ?? '';
      if (!/\/api\/agents\/chat$/.test(url)) {
        return originalFetch(input, init);
      }

      const payload = typeof init.body === 'string' ? JSON.parse(init.body) : {};
      const message = String(payload.message ?? '');

      if (message.includes('force error')) {
        return new Response(
          JSON.stringify({
            error: 'Provider temporarily unavailable',
            code: 'MODEL_PROVIDER_DOWN',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      const stream = new ReadableStream({
        async start(controller) {
          const push = (event) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          };

          push({ type: 'started' });

          if (message.includes('trigger hold')) {
            await delay(60);
            push({
              type: 'hold',
              message: 'SENTINEL needs a safer framing before it can answer.',
              sentinelConcerns: ['Potential unsupported claim'],
              sentinelRepairActions: ['Ask for evidence or narrow the request.'],
              enforcementSummary: { status: 'held' },
              agentId: payload.agentId ?? 'cipher',
            });
            controller.close();
            return;
          }

          await delay(50);
          push({ type: 'chunk', text: 'Partial answer' });
          await delay(50);
          push({ type: 'chunk', text: ' with evidence' });
          await delay(20);
          push({
            type: 'done',
            messageId: '11111111-1111-4111-8111-111111111111',
            creditsUsed: 1,
            sources: [],
          });
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    };
  });
}

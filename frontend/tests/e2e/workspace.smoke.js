import { test, expect } from '@playwright/test'

test.describe('Workspace smoke - authenticated', () => {
  test('dashboard loads with agent roster', async ({ page }) => {
    await page.goto('/app/dashboard')
    await expect(page.getByText(/CIPHER|HERALD|FORGE/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('can open agent chat and send a message', async ({ page }) => {
    await page.goto('/app/agents/herald?new=1')
    await expect(page.locator('.workspace-studio').first()).toBeVisible({ timeout: 15_000 })

    const composer = page.locator('textarea.field--textarea').first()
    await composer.fill('Hello HERALD, introduce yourself in one sentence.')
    await page.getByRole('button', { name: /^send$/i }).click()

    await expect(page.locator('[data-testid="agent-response"]').first()).toBeVisible({
      timeout: 30_000,
    })
  })

  test('LORE page loads and shows document inventory', async ({ page }) => {
    await page.goto('/app/lore')
    await expect(page.getByText(/knowledge base|documents|ingest|document inventory/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('settings page loads with plan info', async ({ page }) => {
    await page.goto('/app/settings')
    await expect(page.getByText(/plan|billing|subscription/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})

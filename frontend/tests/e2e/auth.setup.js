import fs from 'node:fs/promises'
import path from 'node:path'

import { test as setup, expect } from '@playwright/test'

import { getCredentials, signInWith } from '../helpers/auth.js'

const authFile = path.join(process.cwd(), '.auth/user.json')

setup('authenticate user', async ({ page }) => {
  const credentials = getCredentials('user')
  if (!credentials) {
    throw new Error('Missing Playwright test credentials')
  }

  await fs.mkdir(path.dirname(authFile), { recursive: true })
  await signInWith(page, {
    ...credentials,
    destination: '/app/dashboard',
  })

  await expect(page).toHaveURL(/\/app\/dashboard/)
  await page.context().storageState({ path: authFile })
})

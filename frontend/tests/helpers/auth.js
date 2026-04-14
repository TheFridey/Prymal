export async function signIn(page) {
  const email = process.env.PLAYWRIGHT_TEST_USER_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_USER_PASSWORD;

  if (!email || !password) {
    return false;
  }

  await page.goto('/login');
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole('button', { name: /sign in|continue/i }).first().click();
  await page.waitForURL('**/app/**', { timeout: 15_000 });
  return true;
}

export function skipIfNoCredentials(testApi) {
  testApi.skip(
    !process.env.PLAYWRIGHT_TEST_USER_EMAIL || !process.env.PLAYWRIGHT_TEST_USER_PASSWORD,
    'No Playwright test credentials set - skipping auth-dependent test.',
  );
}

export async function signInWith(page, { email, password }) {
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

export async function signIn(page) {
  return signInWith(page, {
    email: process.env.PLAYWRIGHT_TEST_USER_EMAIL,
    password: process.env.PLAYWRIGHT_TEST_USER_PASSWORD,
  });
}

export async function signInAsStaff(page) {
  return signInWith(page, {
    email: process.env.PLAYWRIGHT_TEST_STAFF_EMAIL,
    password: process.env.PLAYWRIGHT_TEST_STAFF_PASSWORD,
  });
}

export function skipIfNoCredentials(testApi) {
  testApi.skip(
    !process.env.PLAYWRIGHT_TEST_USER_EMAIL || !process.env.PLAYWRIGHT_TEST_USER_PASSWORD,
    'No Playwright test credentials set - skipping auth-dependent test.',
  );
}

export function skipIfNoStaffCredentials(testApi) {
  testApi.skip(
    !process.env.PLAYWRIGHT_TEST_STAFF_EMAIL || !process.env.PLAYWRIGHT_TEST_STAFF_PASSWORD,
    'No staff Playwright credentials set - skipping staff-only auth test.',
  );
}

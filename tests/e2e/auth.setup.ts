import { test as setup } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/user.json');

setup('authenticate and dismiss license alert', async ({ page }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Inject localStorage snooze key on every page load so it's present before
  // any Vue component mounts and checks it. This prevents the LicensingAlert
  // modal (dismissible: false) from blocking UI interactions in all tests.
  await page.addInitScript(() => {
    localStorage.setItem(
      'statamic.snooze_license_banner',
      String(Date.now() + 365 * 24 * 60 * 60 * 1000), // snooze for 1 year
    );
  });

  await page.goto('/cp/auth/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="email"]').fill('mario.hamann@virtual-identity.com');
  await page.locator('input[name="password"]').fill('password');
  // The Inertia login uses window.location.href on success, which triggers a
  // full browser navigation. waitForNavigation captures that redirect.
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes('/auth')),
    page.getByRole('button', { name: 'Continue' }).click(),
  ]);
  await page.waitForLoadState('domcontentloaded');

  await page.context().storageState({ path: authFile });
});

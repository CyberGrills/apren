import { expect, test } from '@playwright/test';

for (const path of ['/demo/hotels', '/demo/marketplace', '/demo/checkout']) {
  test(`production route ${path} redirects to real Explore content`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\\/explore\\?kind=STAY$/);
    await expect(page.locator('#main-content').first()).toBeVisible();
  });
}

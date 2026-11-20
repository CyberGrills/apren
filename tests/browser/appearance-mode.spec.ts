import { expect, test } from '@playwright/test';
import { installApiMocks } from './mocks.ts';

test('dark appearance applies across the page and persists after refresh', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/appearance');
  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

  await page.getByRole('button', { name: /Dark/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect.poll(() => page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgb(17, 26, 21)');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(page.getByRole('button', { name: /Dark/ })).toHaveAttribute('aria-pressed', 'true');
});

test('system appearance follows operating-system colour-scheme changes', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('7even-color-mode', 'system'));
  await installApiMocks(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/appearance');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await expect(page.getByRole('button', { name: /System/ })).toHaveAttribute('aria-pressed', 'true');
});

test('summer and autumn remain visibly different in dark mode', async ({ page }) => {
  await installApiMocks(page);
  await page.addInitScript(() => localStorage.setItem('7even-color-mode', 'dark'));
  await page.goto('/appearance');

  await page.getByRole('button', { name: /Summer/ }).click();
  const summer = await page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--season-accent').trim());
  await page.getByRole('button', { name: /Autumn/ }).click();
  const autumn = await page.locator('html').evaluate((element) => getComputedStyle(element).getPropertyValue('--season-accent').trim());

  expect(summer).toBe('#F5C85C');
  expect(autumn).toBe('#E98B55');
  expect(autumn).not.toBe(summer);
});

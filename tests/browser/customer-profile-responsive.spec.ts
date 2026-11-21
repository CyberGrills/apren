import { expect, test } from '@playwright/test';
import { installApiMocks } from './mocks.ts';

const widths = [320, 375, 390, 520, 768, 820, 1024, 1440];

for (const width of widths) {
  test(`customer profile fits a ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installApiMocks(page, 'CUSTOMER');
    await page.goto('/app/profile');

    await expect(page.getByRole('heading', { name: 'Make yourself at home.', level: 2 })).toBeVisible();
    await expect(page.getByLabel('Your name')).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keep it yours.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      profile: (() => { const rect = document.querySelector<HTMLElement>('.customer-profile')?.getBoundingClientRect(); return rect ? { left: rect.left, right: rect.right } : null; })(),
      editor: (() => { const rect = document.querySelector<HTMLElement>('.customer-profile-editor')?.getBoundingClientRect(); return rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null; })(),
      account: (() => { const rect = document.querySelector<HTMLElement>('.customer-profile-account')?.getBoundingClientRect(); return rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right } : null; })(),
    }));

    expect(dimensions.document, `document overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `body overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.profile).not.toBeNull();
    expect(dimensions.editor).not.toBeNull();
    expect(dimensions.account).not.toBeNull();
    if (width <= 860) {
      expect(dimensions.account!.top).toBeGreaterThanOrEqual(dimensions.editor!.bottom - 1);
    } else {
      expect(dimensions.account!.left).toBeGreaterThan(dimensions.editor!.left);
    }
  });
}

test('customer profile exposes all personal and stay preference fields', async ({ page }) => {
  await installApiMocks(page, 'CUSTOMER');
  await page.goto('/app/profile');

  for (const label of [
    'Your name',
    'Email address',
    'Phone number',
    'Home city',
    'State or FCT',
    'Date of birth',
    'Website language',
    'Usual trip purpose',
    'Preferred room type',
    'Bed setup',
  ]) {
    await expect(page.getByLabel(label)).toBeVisible();
  }

  await expect(page.getByRole('link', { name: 'Change your password' })).toHaveAttribute('href', '/app/security');
});

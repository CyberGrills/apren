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
      cityInput: (() => { const rect = document.querySelector<HTMLElement>('.customer-profile-section:nth-of-type(2) input[autocomplete="address-level2"]')?.getBoundingClientRect(); return rect ? { width: rect.width, height: rect.height } : null; })(),
      dateInput: (() => { const rect = document.querySelector<HTMLElement>('.customer-profile-section:nth-of-type(2) input[type="date"]')?.getBoundingClientRect(); return rect ? { left: rect.left, right: rect.right, width: rect.width, height: rect.height } : null; })(),
      dateField: (() => { const rect = document.querySelector<HTMLElement>('.customer-profile-section:nth-of-type(2) input[type="date"]')?.closest('.field')?.getBoundingClientRect(); return rect ? { left: rect.left, right: rect.right, width: rect.width } : null; })(),
      fieldControlBounds: Array.from(document.querySelectorAll<HTMLElement>('.customer-profile-fields .field')).map((field) => {
        const fieldRect = field.getBoundingClientRect();
        const control = field.querySelector<HTMLElement>('.field-input');
        const controlRect = control?.getBoundingClientRect();
        return controlRect ? { fieldLeft: fieldRect.left, fieldRight: fieldRect.right, controlLeft: controlRect.left, controlRight: controlRect.right } : null;
      }).filter(Boolean),
    }));

    expect(dimensions.document, `document overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `body overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.profile).not.toBeNull();
    expect(dimensions.editor).not.toBeNull();
    expect(dimensions.account).not.toBeNull();
    expect(dimensions.cityInput).not.toBeNull();
    expect(dimensions.dateInput).not.toBeNull();
    expect(dimensions.dateField).not.toBeNull();
    expect(dimensions.dateInput!.left).toBeGreaterThanOrEqual(dimensions.dateField!.left - 1);
    expect(dimensions.dateInput!.right).toBeLessThanOrEqual(dimensions.dateField!.right + 1);
    for (const bounds of dimensions.fieldControlBounds) {
      expect(bounds!.controlLeft).toBeGreaterThanOrEqual(bounds!.fieldLeft - 1);
      expect(bounds!.controlRight).toBeLessThanOrEqual(bounds!.fieldRight + 1);
    }
    expect(dimensions.dateInput!.width).toBeCloseTo(dimensions.cityInput!.width, 0);
    expect(Math.abs(dimensions.dateInput!.height - dimensions.cityInput!.height)).toBeLessThanOrEqual(1);
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


for (const role of ['CUSTOMER', 'BUSINESS_OWNER', 'RECEPTION', 'ADMIN'] as const) {
  test(`${role.toLowerCase()} can upload and replace a persistent profile picture`, async ({ page }) => {
    await installApiMocks(page, role);
    await page.route('https://storage.test/avatar', route => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'PUT, OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-upsert' }, body: 'stored' }));
    await page.goto('/app/profile');

    const upload = page.getByRole('button', { name: 'Upload photo' });
    await expect(upload).toBeVisible();
    await page.getByLabel('Choose profile picture').setInputFiles({
      name: 'profile.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test-image-content'),
    });

    await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible();
    await expect(page.locator('.customer-profile-avatar-image')).toHaveAttribute('src', 'https://storage.test/avatar-view');
  });
}

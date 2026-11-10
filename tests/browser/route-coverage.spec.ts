import { expect, test } from '@playwright/test';
import { installApiMocks, session } from './mocks.ts';

const publicRoutes = [
  ['/', '7EVEN'], ['/explore', 'Explore'], ['/directory', 'Directory'],
  ['/campus-connect/art-culture', 'Discover the stories'], ['/creators/test-creator', 'Test Creator'],
  ['/install', 'Take 7even with you.'], ['/offline', 'offline'], ['/help', 'Help'],
  ['/booking-rules', 'Booking'], ['/register', 'Create'],
] as const;

for (const [path, heading] of publicRoutes) {
  test(`public route ${path} renders without an application crash`, async ({ page }) => {
    await installApiMocks(page);
    await page.goto(path);
    await expect(page.locator('#main-content').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(new RegExp(heading, 'i'));
  });
}


test('login route renders the email and alternative sign-in controls', async ({ page }) => {
  await installApiMocks(page, null);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to 7even.' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
});

test('guest creator route redirects to sign-in and preserves the requested destination', async ({ page }) => {
  await installApiMocks(page, null);
  await page.goto('/creator');
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fcreator/);
});

test('authenticated creator route loads the profile and draft workspace', async ({ page }) => {
  await installApiMocks(page, 'CUSTOMER');
  await page.goto('/creator');
  await expect(page.getByRole('heading', { name: 'Creator profile' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your artwork drafts' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Uyo Stories/ })).toBeVisible();
  await page.getByRole('button', { name: /Uyo Stories/ }).click();
  await expect(page.getByRole('heading', { name: 'Artwork images' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rights and attribution evidence' })).toBeVisible();
});

test('workspace route families enforce their role boundaries', async ({ page }) => {
  const cases = [
    { path: '/app/bookings', role: 'CUSTOMER' as const },
    { path: '/app/profile', role: 'CUSTOMER' as const },
    { path: '/app/activity', role: 'CUSTOMER' as const },
    { path: '/business', role: 'BUSINESS_OWNER' as const },
    { path: '/reception', role: 'RECEPTION' as const },
    { path: '/admin', role: 'ADMIN' as const },
  ];
  for (const item of cases) {
    await installApiMocks(page, item.role);
    await page.goto(item.path);
    await expect(page.locator('#main-content').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Something interrupted this page');
    if (item.role !== 'CUSTOMER') await expect(page.getByRole('alertdialog')).toContainText('Workspace data is unavailable in this isolated browser test.');
  }
});

test('a customer cannot enter the admin workspace', async ({ page }) => {
  await installApiMocks(page, 'CUSTOMER');
  await page.goto('/admin');
  await expect(page.getByText('Sign in with an account assigned to this workspace.')).toBeVisible();
});

test('unknown routes render the not-found recovery screen', async ({ page }) => {
  await installApiMocks(page, null);
  await page.goto('/not-a-real-7even-route');
  await expect(page.getByText('This page could not be found. Continue from the home page.')).toBeVisible();
});

test('creator API failure is announced and can be retried', async ({ page }) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session')) return route.fulfill({ json: session('CUSTOMER') });
    if (path.endsWith('/auth/methods')) return route.fulfill({ json: { data: { google: { enabled: false }, apple: { enabled: false }, passkeys: { enabled: false } } } });
    if (path.endsWith('/creator/profile')) return route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Creator service is temporarily unavailable.' } } });
    if (path.includes('/creator/artworks')) return route.fulfill({ json: { data: { items: [], nextCursor: null } } });
    return route.fulfill({ json: { data: {} } });
  });
  await page.goto('/creator');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Creator service is temporarily unavailable.');
  await expect(dialog.getByRole('button', { name: 'Got it' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(':focus')).toBeVisible();
});


test('unverified or unknown creator slugs do not resolve to a public profile', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/creators/not-verified');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('This creator profile is not public.');
  await expect(page.getByRole('heading', { name: 'Test Creator' })).toHaveCount(0);
});

test('customers are denied business and reception workspaces', async ({ page }) => {
  await installApiMocks(page, 'CUSTOMER');
  for (const path of ['/business', '/reception']) {
    await page.goto(path);
    await expect(page.getByText('Sign in with an account assigned to this workspace.')).toBeVisible();
  }
});


test('mobile workspace navigation traps focus and restores it after Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMocks(page, 'ADMIN');
  await page.goto('/admin');
  const loadError = page.getByRole('alertdialog');
  await expect(loadError).toBeVisible();
  await loadError.getByRole('button', { name: 'Got it' }).click();
  await expect(loadError).toBeHidden();
  const opener = page.getByRole('button', { name: 'Open navigation' });
  await opener.click();
  const navigation = page.getByRole('dialog', { name: 'Workspace navigation' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('button', { name: 'Close navigation' })).toBeFocused();
  const controls = navigation.locator('a[href], button:not([disabled])');
  await controls.last().focus();
  await page.keyboard.press('Tab');
  await expect(controls.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(navigation).toBeHidden();
  await expect(opener).toBeFocused();
});

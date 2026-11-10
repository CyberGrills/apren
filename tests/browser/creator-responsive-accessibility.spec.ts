import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { installApiMocks } from './mocks.ts';

const viewports = [320, 375, 390, 768, 1024];

for (const width of viewports) {
  test(`creator studio fits ${width}px viewport without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installApiMocks(page, 'CUSTOMER');
    await page.goto('/creator');
    await expect(page.getByRole('heading', { name: 'Creator profile' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(dimensions.document, `document overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `body overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
  });
}

test('creator profile form is keyboard reachable and reports native validation', async ({ page }) => {
  await installApiMocks(page, 'CUSTOMER');
  await page.goto('/creator');
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeVisible();
  await page.getByLabel('Display name').fill('');
  await page.getByRole('button', { name: 'Save profile' }).click();
  const invalid = await page.getByLabel('Display name').evaluate((element: HTMLInputElement) => !element.checkValidity());
  expect(invalid).toBe(true);
});

test('creator workspace accessibility scan meets axe WCAG 2.2 AA checks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMocks(page, 'CUSTOMER');
  await page.goto('/creator');
  await expect(page.getByRole('heading', { name: 'Creator profile' })).toBeVisible();
  const results = await new AxeBuilder({ page }).exclude('.apren-watermark').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((item) => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map((node) => node.target) }))).toEqual([]);
});

test('public creator page accessibility scan meets axe WCAG 2.2 AA checks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApiMocks(page);
  await page.goto('/creators/test-creator');
  await expect(page.getByRole('heading', { name: 'Test Creator' })).toBeVisible();
  const results = await new AxeBuilder({ page }).exclude('.apren-watermark').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.map((item) => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.map((node) => node.target) }))).toEqual([]);
});


test('mobile public navigation traps keyboard focus and closes on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await installApiMocks(page);
  await page.goto('/campus-connect/art-culture');
  const opener = page.getByRole('button', { name: 'Open navigation' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(nav).toBeVisible();
  const links = nav.getByRole('link');
  await expect(links.first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(links.last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused();
});


for (const width of viewports) {
  test(`public creator profile fits ${width}px viewport without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installApiMocks(page);
    await page.goto('/creators/test-creator');
    await expect(page.getByRole('heading', { name: 'Test Creator' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.document, `public creator document overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `public creator body overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
  });
}

test('creator workspace honors reduced-motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installApiMocks(page, 'CUSTOMER');
  await page.goto('/creator');
  const motion = await page.locator('.creator-studio-page').evaluate((element) => {
    const style = getComputedStyle(element.querySelector('h1') ?? element);
    return { animationName: style.animationName, transitionProperty: style.transitionProperty, scrollBehavior: style.scrollBehavior };
  });
  expect(motion.animationName).toBe('none');
  expect(motion.transitionProperty).toBe('none');
  expect(motion.scrollBehavior).toBe('auto');
});

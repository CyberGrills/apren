import { expect, test } from '@playwright/test';
import { installApiMocks } from './mocks.ts';

const widths = [320, 360, 375, 390, 412, 600, 768, 820, 1024, 1280, 1440];
const routes = [
  { path: '/', role: null },
  { path: '/explore', role: null },
  { path: '/directory', role: null },
  { path: '/experiences/christmas-unplugged', role: null },
  { path: '/campus-connect/art-culture', role: null },
  { path: '/creator', role: 'CUSTOMER' as const },
];

for (const route of routes) {
  test(`${route.path} stays within every supported viewport width`, async ({ page }) => {
    await installApiMocks(page, route.role);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route.path);
      await expect(page.locator('#main-content').first()).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        main: document.querySelector<HTMLElement>('#main-content')?.getBoundingClientRect().right ?? 0,
      }));
      expect(dimensions.document, `${route.path} document overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.body, `${route.path} body overflow at ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport);
      expect(dimensions.main, `${route.path} main content exceeds ${width}px: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  });
}

import { expect, test } from '@playwright/test';

test.describe('Android-sized Things to do experience', () => {
  test('event cards stack cleanly at common Android phone widths', async ({ page }) => {
    await page.goto('/explore?kind=EXPERIENCE');
    await expect(page.getByRole('heading', { name: 'Ibom Christmas Unplugged 4.0' })).toBeVisible();

    for (const width of [360, 393, 412]) {
      await page.setViewportSize({ width, height: 850 });
      const card = page.locator('.ibom-event-card').first();
      const poster = page.locator('.ibom-event-image-link').first();
      const content = page.locator('.ibom-event-card-content').first();
      await expect(card).toBeVisible();
      const layout = await page.evaluate(() => {
        const cardElement = document.querySelector<HTMLElement>('.ibom-event-card');
        const posterElement = document.querySelector<HTMLElement>('.ibom-event-image-link');
        const contentElement = document.querySelector<HTMLElement>('.ibom-event-card-content');
        if (!cardElement || !posterElement || !contentElement) throw new Error('Event card elements are missing');
        return {
          direction: getComputedStyle(cardElement).flexDirection,
          posterBottom: posterElement.getBoundingClientRect().bottom,
          contentTop: contentElement.getBoundingClientRect().top,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      expect(layout.direction).toBe('column');
      expect(layout.posterBottom).toBeLessThanOrEqual(layout.contentTop + 1);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      await expect(poster).toBeVisible();
      await expect(content).toBeVisible();
    }
  });

  test('event search, detail expansion and page scrolling work on touch-sized screens', async ({ page }) => {
    await page.goto('/explore?kind=EXPERIENCE');
    const search = page.getByRole('searchbox', { name: 'Search festival events' });
    await search.fill('Ibom Air Day');
    await expect(page.getByText('Showing 1 of 20 official events')).toBeVisible();
    const eventCard = page.locator('.ibom-event-card').filter({ has: page.getByRole('heading', { name: 'Ibom Air Day' }) });
    await expect(eventCard).toBeVisible();
    await eventCard.getByRole('button', { name: 'View event on 7EVEN' }).click();
    await expect(eventCard.getByText('Date:')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/Visitor entry is free/)).toBeVisible();
  });

  test('failed official posters show an accessible fallback without hiding event details', async ({ page }) => {
    await page.route('https://ibomfest.akwaibomstate.gov.ng/**', (route) => route.abort());
    await page.goto('/explore?kind=EXPERIENCE');
    const poster = page.locator('.ibom-event-image-link').first();
    await poster.scrollIntoViewIfNeeded();
    await expect(poster.getByRole('img', { name: 'Official Opening Ceremony poster for Ibom Christmas Unplugged 4.0' })).toBeVisible();
    await expect(poster.getByText('Official event poster unavailable')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Opening Ceremony' })).toBeVisible();
  });
});

test.describe('Android appearance persistence', () => {
  test('season and dark mode apply before navigation and remain after reload', async ({ page }) => {
    await page.goto('/appearance');
    await page.getByRole('button', { name: /Autumn/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-season', 'autumn');
    await page.getByRole('button', { name: /Dark/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect.poll(() => page.locator('html').evaluate((element) => getComputedStyle(element).colorScheme)).toBe('dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-season', 'autumn');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.goto('/explore?kind=EXPERIENCE');
    await expect(page.locator('html')).toHaveAttribute('data-season', 'autumn');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    const theme = await page.locator('html').evaluate((element) => ({
      accent: getComputedStyle(element).getPropertyValue('--season-accent').trim(),
      panel: getComputedStyle(document.querySelector('.ibom-events-section')!).backgroundColor,
    }));
    expect(theme.accent).toBe('#994626');
    expect(theme.panel).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('System appearance follows Android Chromium device colour preference', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/appearance');
    await page.getByRole('button', { name: /System/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  });
});

import { expect, test } from '@playwright/test';
import { installApiMocks } from './mocks.ts';

test.describe('Android-sized Things to do experience', () => {
  test('event cards adapt to Android viewport widths without clipping or horizontal overflow', async ({ page }) => {
    await installApiMocks(page);
    await page.goto('/explore?kind=EXPERIENCE');
    await expect(page.getByRole('heading', { name: 'Ibom Christmas Unplugged 4.0' })).toBeVisible();

    for (const width of [320, 360, 393, 412, 480, 600]) {
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
        const cardRect = cardElement.getBoundingClientRect();
        const posterRect = posterElement.getBoundingClientRect();
        const contentRect = contentElement.getBoundingClientRect();
        return {
          direction: getComputedStyle(cardElement).flexDirection,
          cardWidth: cardRect.width,
          posterBottom: posterRect.bottom,
          posterHeight: posterRect.height,
          contentTop: contentRect.top,
          contentWidth: contentRect.width,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
        };
      });
      expect(layout.direction).toBe('column');
      expect(layout.posterBottom).toBeLessThanOrEqual(layout.contentTop + 1);
      expect(layout.cardWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.contentWidth).toBeLessThanOrEqual(layout.cardWidth);
      expect(layout.posterHeight).toBeLessThanOrEqual(302);
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      await expect(poster).toBeVisible();
      await expect(content).toBeVisible();
    }

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.ibom-event-card').first()).toBeVisible();
    const landscape = await page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>('.ibom-events-grid');
      if (!grid) throw new Error('Festival event grid is missing');
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        gridColumns: getComputedStyle(grid).gridTemplateColumns,
      };
    });
    expect(landscape.documentWidth).toBeLessThanOrEqual(landscape.viewportWidth);
    expect(landscape.gridColumns.split(' ').length).toBeGreaterThanOrEqual(1);
  });

  test('event search, detail expansion and page scrolling work on touch-sized screens', async ({ page }) => {
    await page.goto('/explore?kind=EXPERIENCE');
    const search = page.locator('.ibom-events-search input');
    await expect(search).toBeVisible();
    await search.click();
    await search.pressSequentially('Ibom Air Day');
    await expect(search).toHaveValue('Ibom Air Day');
    await expect(page.locator('.ibom-events-count')).toContainText('1 of 20 official events');
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
    await installApiMocks(page);
    await page.goto('/appearance');
    await page.getByRole('button', { name: /Autumn/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-season', 'autumn');
    await page.getByRole('button', { name: /Dark/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');

    await expect.poll(() => page.evaluate(() => localStorage.getItem('7even-season-theme'))).toBe('autumn');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('7even-color-mode'))).toBe('dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-season', 'autumn');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.goto('/explore');
    await page.getByRole('button', { name: 'Things to do' }).click();
    await expect(page.getByRole('heading', { name: 'Ibom Christmas Unplugged 4.0' })).toBeVisible();
    const theme = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>('.ibom-events-section');
      if (!section) throw new Error('Festival event section is missing');
      return {
        accent: getComputedStyle(document.documentElement).getPropertyValue('--season-accent').trim(),
        panel: getComputedStyle(section).backgroundColor,
      };
    });
    expect(theme.accent).toBe('#E98B55');
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

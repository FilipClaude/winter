import { expect, test } from './fixtures';
import { shot } from './helpers';

test.describe('Desktop', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
  });

  test('läuft zentriert in einer schmalen Spalte @screens', async ({ page }) => {
    await page.goto('./#/heute');
    const box = await page.locator('main.app').boundingBox();
    expect(box?.width).toBeLessThanOrEqual(480);
    expect(Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2)).toBe(640);
    await shot(page, '08-desktop');
  });
});

test('Kein horizontales Scrollen auf schmalen Geräten (320 px)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const route of ['heute', 'training', 'schule', 'koerper', 'rueckblick', 'einstellungen']) {
    await page.goto(`./#/${route}`);
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, route).toBeLessThanOrEqual(0);
  }
  await page.goto('./#/heute');
  await shot(page, '08-schmal-320');
});

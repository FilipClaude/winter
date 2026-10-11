import type { Page } from '@playwright/test';

/** Screenshot im iPhone-Viewport nach screens/<name>.png (für die visuelle Kontrolle). */
export async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `screens/${name}.png`, fullPage, animations: 'disabled' });
}

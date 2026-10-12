import { expect, test } from '@playwright/test';
import { shot } from './helpers';

/**
 * Läuft im Projekt „offline“ mit aktivem Service Worker gegen den Produktions-Build (vite preview).
 */
test('PWA ist installierbar und läuft ohne Netz weiter', async ({ page, context }) => {
  test.setTimeout(60_000);
  await page.goto('./');
  await expect(page.getByTestId('ring-card')).toBeVisible();

  // Service Worker aktiv und kontrolliert die Seite
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), { timeout: 15_000 })
    .toBe(true);

  // Installierbarkeit laut Chromium (Manifest, Icons, Service Worker, HTTPS/localhost)
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
    installabilityErrors: { errorId: string }[];
  };
  expect(installabilityErrors.map((e) => e.errorId)).toEqual([]);
  const manifest = (await cdp.send('Page.getAppManifest')) as { errors: { message: string }[] };
  expect(manifest.errors).toEqual([]);

  // Netz aus
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('ring-card')).toBeVisible();

  // Alle Bereiche (lazy geladene Chunks kommen aus dem Precache)
  for (const [tab, title] of [
    ['Training', 'Training'],
    ['Schule', 'Schule'],
    ['Körper', 'Körper'],
    ['Rückblick', 'Rückblick'],
  ] as const) {
    await page.getByRole('navigation').getByRole('button', { name: tab }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }
  await page.goto('./#/einstellungen');
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();

  // Erfassen funktioniert offline und überlebt einen Neustart ohne Netz
  await page.goto('./#/heute');
  await page.getByRole('button', { name: 'Ein Glas Wasser' }).click();
  await expect(page.getByTestId('water-value')).toContainText('1');
  await page.reload();
  await expect(page.getByTestId('water-value')).toContainText('1');

  // Schriften kommen ebenfalls aus dem Cache
  const fontsOk = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px "Geist Variable"');
  });
  expect(fontsOk).toBe(true);
  await shot(page, '09-offline');
  await context.setOffline(false);
});

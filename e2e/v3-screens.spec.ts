import { test, type Page } from './fixtures';
import { enableDemo } from './helpers';

/**
 * Screenshots für die visuelle Kontrolle der v3-Änderungen (iPhone 390 × 844, Nacht und Tag, mit Demo-Daten
 * und leer) nach screens/v3/. Keine Referenzbilder – die Bilder werden nach jeder Phase angesehen.
 */
test.skip(({ browserName }) => browserName !== 'chromium', 'Screenshots nur einmal (Chromium)');

const PHASES = [
  ['nacht', '2026-10-14T22:30:00+02:00'],
  ['tag', '2026-10-14T12:30:00+02:00'],
] as const;

async function settle(page: Page) {
  await page.addStyleTag({ content: '.sky--snow,.toast-host{visibility:hidden!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function snap(page: Page, name: string, fullPage = false) {
  await settle(page);
  await page.screenshot({ path: `screens/v3/${name}.png`, fullPage, animations: 'disabled' });
}

for (const [phase, time] of PHASES) {
  test(`v3 mit Daten – ${phase} @screens`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.clock.install({ time: new Date(time) });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/data/bfv.json', (route) => route.fulfill({ path: 'e2e/data/bfv-visual.json' }));
    await enableDemo(page);
    await page.goto('./#/heute');
    await page.getByTestId('next-exam').waitFor();
    await snap(page, `heute-${phase}`);
    await snap(page, `heute-voll-${phase}`, true);
    await page.goto('./#/schule');
    await page.getByTestId('next-exam-hero').waitFor();
    await snap(page, `schule-${phase}`);
    await page.getByRole('group', { name: 'Bereich' }).getByRole('button', { name: 'Klausuren' }).click();
    await snap(page, `schule-klausuren-${phase}`, true);
    await page.goto('./#/koerper');
    await snap(page, `koerper-${phase}`);
    await page.goto('./#/rueckblick');
    await snap(page, `rueckblick-voll-${phase}`, true);
    await page.goto('./#/training');
    await snap(page, `training-voll-${phase}`, true);
    await page.goto('./#/einstellungen');
    await snap(page, `einstellungen-voll-${phase}`, true);
  });

  test(`v3 leer – ${phase} @screens`, async ({ page }) => {
    await page.clock.install({ time: new Date(time) });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./#/heute');
    await page.getByTestId('next-exam').waitFor();
    await snap(page, `heute-leer-voll-${phase}`, true);
    await page.goto('./#/schule');
    await snap(page, `schule-leer-${phase}`);
  });
}

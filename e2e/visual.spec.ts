import { expect, test, type Page } from './fixtures';
import { enableDemo } from './helpers';

/**
 * Visuelle Regression: alle Hauptscreens bei 390 × 844 in Nacht und Tag, festes Datum, Demo-Daten.
 * Schnee ist ausgeblendet (zufällige Flocken), Bewegung reduziert (keine Zähl-/Einblend-Animationen).
 *
 * Nur lokal: Die Referenzbilder entstehen unter Windows; Linux (CI) rendert Schrift anders, dort gäbe es
 * nur Fehlalarme – oder Referenzen, die nie jemand angesehen hat (DECISIONS #68). Aktualisieren nach
 * gewollten Änderungen: `npx playwright test visual --update-snapshots`, dann die Bilder ansehen.
 */
test.skip(!!process.env.CI, 'Referenzbilder sind plattformabhängig (Windows) – siehe DECISIONS #68');

const SCREENS = [
  ['heute', './#/heute'],
  ['training', './#/training'],
  ['schule', './#/schule'],
  ['alltag', './#/alltag'],
  ['alltag-schlaf', './#/alltag/schlaf'],
  ['alltag-verdienst', './#/alltag/verdienst'],
  ['rueckblick', './#/rueckblick'],
  ['einstellungen', './#/einstellungen'],
] as const;

const PHASES = [
  ['nacht', '2026-10-14T22:30:00+02:00'],
  ['tag', '2026-10-14T12:30:00+02:00'],
] as const;

async function settle(page: Page) {
  // Zufällige Schneeflocken und kurzlebige Toasts gehören nicht ins Referenzbild
  await page.addStyleTag({ content: '.sky--snow,.toast-host{visibility:hidden!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

for (const [phase, time] of PHASES) {
  test(`Hauptscreens – ${phase}`, async ({ page }) => {
    test.setTimeout(120_000);
    // Startzeit setzen, Uhr läuft danach normal weiter (eingefrorene Zeit ließe Warteschleifen hängen)
    await page.clock.install({ time: new Date(time) });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    // Eingefrorener BFV-Stand – die echte Datei ändert der Abgleich täglich
    await page.route('**/data/bfv.json', (route) => route.fulfill({ path: 'e2e/data/bfv-visual.json' }));
    await enableDemo(page);
    for (const [name, url] of SCREENS) {
      await page.goto(url);
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      await settle(page);
      await expect(page, `${name} (${phase})`).toHaveScreenshot(`${name}-${phase}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.01,
      });
    }
  });
}

test.describe('Einführung', () => {
  test.use({ onboarding: true });
  for (const [phase, time] of PHASES) {
    test(`erster Schritt – ${phase}`, async ({ page }) => {
      await page.clock.install({ time: new Date(time) });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('./#/heute');
      await page.getByTestId('onboarding').waitFor();
      await settle(page);
      await expect(page).toHaveScreenshot(`einfuehrung-${phase}.png`, {
        animations: 'disabled',
        caret: 'hide',
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});

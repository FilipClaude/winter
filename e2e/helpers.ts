import { test, type Page } from './fixtures';

/**
 * WebKit unter Windows schreibt IndexedDB deutlich langsamer (Demo-Daten: ~11 s statt < 1 s in Chromium).
 * Für Schritte, die viele Datensätze schreiben, gilt deshalb dieses Zeitlimit.
 */
export const SLOW_WRITE = { timeout: 30_000 };

/** Screenshot im iPhone-Viewport nach screens/<name>.png (für die visuelle Kontrolle). Nur Chromium. */
export async function shot(page: Page, name: string, fullPage = false): Promise<void> {
  if (test.info().project.name === 'webkit') return;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `screens/${name}.png`, fullPage, animations: 'disabled' });
}

/**
 * Berliner Kalenderdatum in n Tagen als JJJJ-MM-TT. Gerechnet wird in Kalendertagen, nicht in 24-h-Schritten –
 * sonst landet man über eine Zeitumstellung hinweg kurz nach Mitternacht einen Tag zu früh (Fund 13.10.2026).
 */
export function berlinDate(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Demo-Daten in den Einstellungen einschalten und warten, bis sie geschrieben sind. */
export async function enableDemo(page: Page): Promise<void> {
  await page.goto('./#/einstellungen');
  await page.getByTestId('demo-toggle').check();
  await page.getByText(/Demo-Einträge angelegt/).waitFor(SLOW_WRITE);
  await page.getByTestId('demo-toggle').and(page.locator(':checked')).waitFor();
}

/**
 * Zwischenablage für Tests: Chromium bekommt echte Rechte, WebKit kennt `clipboard-read` als Recht nicht –
 * dort ersetzt ein kleiner Speicher die API (vor dem ersten Laden der Seite).
 */
export async function allowClipboard(page: Page): Promise<void> {
  if (test.info().project.name === 'webkit') {
    await page.addInitScript(() => {
      let buffer = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (t: string) => {
            buffer = t;
            return Promise.resolve();
          },
          readText: () => Promise.resolve(buffer),
        },
      });
    });
    return;
  }
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
}

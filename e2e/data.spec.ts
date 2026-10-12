import { expect, test, type Page } from './fixtures';
import { readFileSync } from 'node:fs';
import { berlinDate, allowClipboard, enableDemo, shot, SLOW_WRITE } from './helpers';

const health = (steps: number) =>
  JSON.stringify({
    v: 1,
    date: berlinDate(),
    steps,
    distanceKm: 6.1,
    flights: 12,
    sleep: { start: `${berlinDate(-1)}T23:12:00+02:00`, end: `${berlinDate()}T06:58:00+02:00` },
  });

async function openHealth(page: Page) {
  await page.goto('./#/heute');
  await page.getByTestId('health-hint').getByRole('button', { name: 'Health holen' }).click();
  await expect(page.getByRole('dialog', { name: 'Health holen' })).toBeVisible();
}

test('Health: Text einfügen, erneuter Import überschreibt nur Health-Werte @screens', async ({ page }) => {
  // Manueller Schlaf vorher
  await page.goto('./#/koerper');
  await page.getByRole('button', { name: 'Schlaf' }).click();
  await page.getByRole('button', { name: 'Eintragen' }).click();
  await page.getByRole('dialog').getByLabel('Bettzeit').fill('22:00');
  await page.getByRole('dialog').getByLabel('Aufwachzeit').fill('06:00');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();

  await openHealth(page);
  await shot(page, '07-health-sheet');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'JSON von Hand einfügen' }).click();
  await dialog.getByTestId('health-text').fill(health(8423));
  await dialog.getByRole('button', { name: 'Text importieren' }).click();
  await expect(dialog.getByTestId('health-result')).toContainText('8.423 Schritte');
  await shot(page, '07-health-ergebnis');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Schritte' })).toContainText('8.423');
  await expect(page.getByTestId('health-hint')).toHaveCount(0);
  // manueller Schlaf hat Vorrang
  await expect(page.getByRole('button', { name: 'Schlaf' })).toContainText('8:00');

  // erneuter Import
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-health').click();
  await page.getByRole('dialog').getByRole('button', { name: 'JSON von Hand einfügen' }).click();
  await page.getByRole('dialog').getByTestId('health-text').fill(health(10200));
  await page.getByRole('dialog').getByRole('button', { name: 'Text importieren' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Schritte' })).toContainText('10.200');
  await expect(page.getByRole('button', { name: 'Schlaf' })).toContainText('8:00');
});

test('Health: Zwischenablage nach Rückkehr und Datei-Import', async ({ page }) => {
  await allowClipboard(page);
  await openHealth(page);
  await page.evaluate((t) => navigator.clipboard.writeText(t), health(7777));
  await page.getByTestId('health-paste').click();
  await expect(page.getByTestId('health-result')).toContainText('7.777 Schritte');

  await page.getByTestId('health-file').setInputFiles({
    name: 'winter-health.json',
    mimeType: 'application/json',
    buffer: Buffer.from(health(9999)),
  });
  await expect(page.getByTestId('health-result')).toContainText('9.999 Schritte');
});

test('Health: kaputte Daten → klare Meldung, kein Absturz', async ({ page }) => {
  await openHealth(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'JSON von Hand einfügen' }).click();
  await dialog.getByTestId('health-text').fill('{"v":1,"steps":"viele"}');
  await dialog.getByRole('button', { name: 'Text importieren' }).click();
  await expect(dialog.getByTestId('health-error')).toContainText('keine Zahl');
  await shot(page, '07-health-fehler');
});

test('Backup exportieren → alles löschen → importieren → alles wieder da', async ({ page }) => {
  await page.goto('./#/heute');
  await page.getByRole('button', { name: 'Ein Glas Wasser' }).click();
  await page.getByRole('button', { name: 'Ein Glas Wasser' }).click();
  await page.getByRole('button', { name: 'Stimmung 5' }).click();
  await expect(page.getByTestId('backup-reminder')).toBeVisible();

  await page.goto('./#/einstellungen');
  const card = page.getByTestId('backup-card');
  await card.getByRole('button', { name: 'Backup erstellen' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    card.getByTestId('backup-save').click(),
  ]);
  const path = await download.path();
  expect(download.suggestedFilename()).toMatch(/^winter-backup-.*\.json$/);
  const json = readFileSync(path, 'utf8');
  expect(JSON.parse(json).app).toBe('winter');
  await expect(card).toContainText('Letztes Backup');

  // Alles löschen
  await page.getByRole('button', { name: 'Alle Daten löschen' }).click();
  const wipe = page.getByRole('dialog', { name: 'Alle Daten löschen' });
  await expect(wipe.getByRole('button', { name: 'Endgültig löschen' })).toBeDisabled();
  await wipe.getByLabel('Zur Bestätigung LÖSCHEN eingeben').fill('LÖSCHEN');
  await wipe.getByRole('button', { name: 'Endgültig löschen' }).click();
  await page.goto('./#/heute');
  await expect(page.getByTestId('water-value')).toContainText('0');

  // Import
  await page.goto('./#/einstellungen');
  await page
    .getByTestId('backup-file')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  const preview = page.getByTestId('import-preview');
  await expect(preview).toContainText('Einträge werden importiert');
  await shot(page, '07-import-vorschau');
  await preview.getByRole('button', { name: 'Ersetzen und importieren' }).click();
  await page.goto('./#/heute');
  await expect(page.getByTestId('water-value')).toContainText('2');
  await expect(page.getByRole('button', { name: 'Stimmung 5' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('backup-reminder')).toHaveCount(0);
});

test('Backup-Import lehnt fremde Datei ab', async ({ page }) => {
  await page.goto('./#/einstellungen');
  await page
    .getByTestId('backup-file')
    .setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hallo":1}') });
  await expect(page.getByText('Das ist keine Winter-Sicherung')).toBeVisible();
});

test('Markdown-Export für Obsidian', async ({ page }) => {
  await page.goto('./#/einstellungen');
  await page.getByRole('region', { name: 'Markdown-Export' }).getByRole('button', { name: 'Öffnen' }).click();
  const pre = page.getByTestId('md-preview');
  await expect(pre).toContainText(`datum: ${berlinDate()}`);
  await expect(pre).toContainText('## Aufgaben');
  await expect(pre).toContainText('## Notizen');
  await expect(pre).toContainText('## Training');
  await page.getByRole('dialog').getByRole('button', { name: 'Woche' }).click();
  await expect(pre).toContainText('tags: [wochenrückblick, winter]');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('dialog').getByRole('button', { name: 'Datei' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^\d{4}-KW\d{2}\.md$/);
});

test('Demo-Daten an → alle Screens mit Daten → aus = vollständig weg @screens', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./#/einstellungen');
  await shot(page, '07-einstellungen', true);
  await enableDemo(page);

  await page.goto('./#/heute');
  await expect(page.getByTestId('demo-notice')).toBeVisible();
  await expect(page.getByTestId('deadline-alerts')).toContainText('EA 2');
  await shot(page, '07-demo-heute');
  await shot(page, '07-demo-heute-voll', true);

  await page.goto('./#/training');
  await expect(page.getByTestId('load-card')).not.toContainText('mindestens 3 Wochen');
  await expect(page.getByTestId('bests-card')).toContainText('Kniebeuge');
  await shot(page, '07-demo-training', true);

  await page.goto('./#/schule');
  await page.getByRole('button', { name: 'Klausuren' }).click();
  await expect(page.getByTestId('grades-card')).toContainText('Gesamt');
  await shot(page, '07-demo-schule', true);

  await page.goto('./#/koerper');
  await shot(page, '07-demo-koerper', true);
  await page.getByRole('button', { name: 'Schlaf' }).click();
  await shot(page, '07-demo-schlaf', true);

  await page.goto('./#/rueckblick');
  await expect(page.getByTestId('review-season')).toContainText('Spiele');
  await shot(page, '07-demo-rueckblick', true);
  await page.getByRole('button', { name: 'Monat' }).click();
  await shot(page, '07-demo-rueckblick-monat', true);

  await page.goto('./#/habits');
  await shot(page, '07-demo-habits', true);

  await page.goto('./#/einstellungen');
  // Der Schalter ist gesperrt, bis der echte Zustand geladen ist (kein Flackern auf „aus“).
  await expect(page.getByTestId('demo-toggle')).toBeChecked(SLOW_WRITE);
  await expect(page.getByTestId('demo-toggle')).toBeEnabled();
  await page.getByTestId('demo-toggle').uncheck();
  await expect(page.getByText(/Demo-Einträge gelöscht/)).toBeVisible(SLOW_WRITE);
  // Regression: Der Schalter darf nach dem Löschen nicht kurz zurückspringen (WebKit-Fund in v2).
  await page.waitForTimeout(500);
  await expect(page.getByTestId('demo-toggle')).not.toBeChecked();
  await expect(page.getByTestId('demo-toggle')).toBeEnabled();
  await page.goto('./#/training');
  await expect(page.getByTestId('session-row')).toHaveCount(0);
  await page.goto('./#/heute');
  await expect(page.getByTestId('demo-notice')).toHaveCount(0);
});

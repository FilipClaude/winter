import { expect, test } from './fixtures';
import { enableDemo, shot } from './helpers';

test('Rückblick v2 mit Demo-Daten: Vergleich, Wochenbericht, Trends, Zusammenhänge @screens', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await enableDemo(page);
  await page.goto('./#/rueckblick');
  // Letzte (abgeschlossene) Woche
  await page.getByRole('button', { name: 'Vorheriger Zeitraum' }).click();
  const report = page.getByTestId('week-report');
  await expect(report).toContainText('Wochenbericht KW');
  await expect(report).not.toContainText('Läuft noch');
  await expect(page.getByTestId('review-stats')).toContainText('Vergleich mit');
  await page.getByTestId('trends').getByRole('button', { name: 'Schlaf' }).click();
  await expect(
    page.getByTestId('trends').getByRole('group', { name: /Schlaf: 7-Tage-Schnitt/ }),
  ).toBeVisible();
  await expect(page.getByTestId('year-heatmap')).toBeVisible();
  // Demo hat 4 Wochen Daten: Zusammenhang Schlaf ↔ Stimmung mit r und n
  await expect(page.getByTestId('insight-schlaf-stimmung')).toContainText(/n = \d+|Datenpunkten/);
  await shot(page, '14-rueckblick', true);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    report.getByTestId('week-report-file').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^Wochenbericht \d{4}-KW\d{2}\.md$/);
});

test('Freier Zeitraum mit Vergleich zum gleich langen Zeitraum davor', async ({ page }) => {
  await page.goto('./#/rueckblick');
  await page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: 'Frei' }).click();
  await expect(page.getByTestId('custom-range')).toBeVisible();
  await page.getByLabel('Von').fill('2026-09-01');
  await page.getByLabel('Bis').fill('2026-09-30');
  await expect(page.getByTestId('review-stats')).toContainText('Vergleich mit 02.08.2026 – 31.08.2026');
});

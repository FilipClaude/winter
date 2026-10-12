import { expect, test } from './fixtures';
import { shot } from './helpers';

test('Habit anlegen → auf Heute abhaken → Streak und Heatmap @screens', async ({ page }) => {
  await page.goto('./#/habits');
  await expect(page.getByText('Noch keine Habits')).toBeVisible();
  await shot(page, '06-habits-leer');
  await page.getByRole('button', { name: 'Habit', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Neuer Habit' });
  await dialog.getByLabel('Name').fill('Dehnen 10 min');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Habit', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Neuer Habit' });
  await dialog.getByLabel('Name').fill('Vokabeln');
  await dialog.getByRole('button', { name: 'Bestimmte Tage' }).click();
  await dialog.getByRole('button', { name: 'Sa' }).click();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('habit-streaks')).toContainText('Mo, Di, Mi, Do, Fr, Sa');

  // Alle heute geplanten Habits abhaken (Vokabeln ist sonntags nicht geplant), damit der Tag
  // an jedem Wochentag 100 % erreicht.
  await page.goto('./#/heute');
  const checks = page.getByTestId('habit-list').getByRole('checkbox');
  await expect(checks.first()).toBeVisible();
  for (const box of await checks.all()) {
    await box.click();
    await expect(box).toHaveAttribute('aria-checked', 'true');
  }

  await page.goto('./#/habits');
  await expect(page.getByLabel('Aktueller Streak 1').first()).toBeVisible();
  await expect(page.getByTestId('habit-heatmap').locator('.heatmap .heatmap__cell.l4')).toHaveCount(1);
  await shot(page, '06-habits');
});

test('Habit archivieren', async ({ page }) => {
  await page.goto('./#/habits');
  await page.getByRole('button', { name: 'Habit', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Lesen');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await page.getByRole('button', { name: /^Lesen/ }).click();
  await page.getByRole('button', { name: 'Archivieren' }).click();
  await expect(page.getByRole('region', { name: 'Archivierte Habits' })).toContainText('Lesen');
});

test('Rückblick leer, Woche/Monat umschalten, ehrlicher Datenhinweis @screens', async ({ page }) => {
  await page.goto('./#/rueckblick');
  await expect(page.getByText('Keine Daten in diesem Zeitraum')).toBeVisible();
  await expect(page.getByTestId('insight-schlaf-stimmung')).toContainText('Zu wenig Datenpunkte');
  await shot(page, '06-rueckblick-leer', true);
  await expect(page.getByTestId('period-label')).toContainText('KW');
  await page.getByRole('button', { name: 'Monat' }).click();
  await expect(page.getByTestId('period-label')).toContainText('2026');
  await page.getByRole('button', { name: 'Vorheriger Zeitraum' }).click();
  await expect(page.getByRole('button', { name: 'Nächster Zeitraum' })).toBeEnabled();
});

test('Rückblick zeigt Kennzahlen nach Einträgen', async ({ page }) => {
  await page.goto('./#/heute');
  await page.getByRole('button', { name: 'Stimmung 4' }).click();
  await page.getByRole('button', { name: 'Mahlzeit eintragen' }).click();
  await page.getByTestId('meal-templates').getByRole('button', { name: /Skyr/ }).click();
  await page.goto('./#/rueckblick');
  const stats = page.getByTestId('review-stats');
  await expect(stats).toContainText('38'); // Ø Protein
  await expect(stats).toContainText('4,0'); // Ø Stimmung
  await expect(page.getByRole('group', { name: /Stimmung \(Linie\)/ })).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';
import { shot } from './helpers';

async function gymSession(page: Page, kg: string) {
  await page.getByRole('button', { name: 'Einheit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Gym', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kniebeuge' }).click();
  const ex = dialog.getByTestId('gym-exercise');
  await ex.getByLabel('Satz 1 Wiederholungen').fill('5');
  await ex.getByLabel('Satz 1 Gewicht').fill(kg);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/training');
  await expect(page.getByRole('heading', { name: 'Training', level: 1 })).toBeVisible();
});

test('Training leer @screens', async ({ page }) => {
  await expect(page.getByTestId('load-card')).toContainText('mindestens 3 Wochen');
  await shot(page, '04-training-leer', true);
});

test('Gym-Einheit → Verlauf → PR erkannt, Werte vorausgefüllt', async ({ page }) => {
  await gymSession(page, '80');
  await expect(page.getByTestId('session-row')).toHaveCount(1);
  await expect(page.getByTestId('session-row').first()).toContainText('Kniebeuge');

  await gymSession(page, '90');
  await expect(page.getByText('Neue Bestleistung: Kniebeuge')).toBeVisible();
  await expect(page.getByTestId('session-row')).toHaveCount(2);
  await expect(page.getByTestId('session-row').first()).toContainText('PR');
  await expect(page.getByTestId('bests-card')).toContainText('Kniebeuge');

  // Letzte Werte werden vorausgefüllt
  await page.getByRole('button', { name: 'Einheit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Gym', exact: true }).click();
  await dialog.getByRole('button', { name: 'Kniebeuge' }).click();
  await expect(dialog.getByLabel('Satz 1 Gewicht')).toHaveValue('90');
  await shot(page, '04-gym-sheet');
});

test('Spiel → Saisonstatistik @screens', async ({ page }) => {
  await page.getByRole('button', { name: 'Einheit', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Spiel', exact: true }).click();
  await dialog.getByLabel('Gegner', { exact: true }).fill('TSV Gräfelfing');
  await dialog.getByLabel('Tore wir').fill('3');
  await dialog.getByLabel('Tore Gegner').fill('1');
  await dialog.getByLabel('Minuten').fill('90');
  await dialog.getByLabel('Tore', { exact: true }).fill('2');
  await dialog.getByLabel('Assists').fill('1');
  await dialog.getByLabel('Torschüsse').fill('4');
  await dialog.getByRole('button', { name: 'Note 8' }).click();
  await shot(page, '04-spiel-sheet');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  const season = page.getByTestId('season-card');
  await expect(season).toContainText('2,00'); // Tore / 90
  await expect(season).toContainText('50'); // Chancenverwertung
  await expect(season).toContainText('1-0-0');
  await expect(page.getByTestId('session-row').first()).toContainText('TSV Gräfelfing 3:1');
  await shot(page, '04-training-daten', true);
});

test('Einheit bearbeiten und löschen', async ({ page }) => {
  await page.getByRole('button', { name: 'Einheit', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lauf', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await page.getByTestId('session-row').first().click();
  await page.getByRole('dialog').getByLabel('Dauer (min)').fill('45');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('session-row').first()).toContainText('45 min');
  await page.getByTestId('session-row').first().click();
  await page.getByRole('button', { name: 'Einheit löschen' }).click();
  await expect(page.getByTestId('session-row')).toHaveCount(0);
});

test('Wochenplan bearbeiten', async ({ page }) => {
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const dialog = page.getByRole('dialog', { name: 'Wochenplan' });
  // Montag: Gym zusätzlich
  await dialog.getByRole('button', { name: 'Gym' }).first().click();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('img', { name: 'Gym' }).first()).toBeVisible();
});

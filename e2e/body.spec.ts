import { expect, test } from '@playwright/test';
import { shot } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/koerper');
  await expect(page.getByRole('heading', { name: 'Körper', level: 1 })).toBeVisible();
});

test('Ernährung: Mahlzeit, Liste, Löschen @screens', async ({ page }) => {
  await shot(page, '04-koerper-leer', true);
  await page.getByRole('button', { name: 'Mahlzeit eintragen' }).click();
  await page.getByTestId('meal-templates').getByRole('button', { name: /Skyr/ }).click();
  await expect(page.getByTestId('meal-list')).toContainText('Skyr + Haferflocken');
  await shot(page, '04-koerper-ernaehrung', true);
  await page.getByRole('button', { name: 'Skyr + Haferflocken löschen' }).click();
  await expect(page.getByTestId('meal-list')).toHaveCount(0);
});

test('Neue Mahlzeiten-Vorlage', async ({ page }) => {
  await page.getByRole('button', { name: 'Vorlage', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Hähnchen Reis');
  await dialog.getByLabel('Kalorien (kcal)').fill('650');
  await dialog.getByLabel('Protein (g)').fill('45');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Hähnchen Reis')).toBeVisible();
});

test('Schlaf über Mitternacht @screens', async ({ page }) => {
  await page.getByRole('button', { name: 'Schlaf' }).click();
  await page.getByRole('button', { name: 'Eintragen' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Bettzeit').fill('23:30');
  await dialog.getByLabel('Aufwachzeit').fill('07:00');
  await expect(dialog.getByTestId('sleep-preview')).toContainText('7:30');
  await dialog.getByRole('button', { name: 'Schlafqualität 4' }).click();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('region', { name: 'Letzte Nacht' })).toContainText('7:30');
  await shot(page, '04-koerper-schlaf', true);
});

test('Health-Bereich im Leerzustand @screens', async ({ page }) => {
  await page.getByRole('button', { name: 'Health', exact: true }).click();
  await expect(page.getByText('Noch keine Health-Daten')).toBeVisible();
  await shot(page, '04-koerper-health-leer');
});

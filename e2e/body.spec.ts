import { expect, test } from './fixtures';
import { shot } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./#/koerper');
  await expect(page.getByRole('heading', { name: 'Körper', level: 1 })).toBeVisible();
});

test('Körper zeigt nur Schlaf und Health (v3: keine Ernährung)', async ({ page }) => {
  const tabs = page.getByRole('group', { name: 'Bereich' });
  await expect(tabs.getByRole('button')).toHaveText(['Schlaf', 'Health']);
  await expect(page.getByText('Ernährung')).toHaveCount(0);
  await shot(page, '04-koerper-leer', true);
});

test('Schlaf über Mitternacht @screens', async ({ page }) => {
  await page.getByRole('button', { name: 'Schlaf', exact: true }).click();
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

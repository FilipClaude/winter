import { expect, test } from './fixtures';
import { shot } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./#/alltag/schlaf');
  await expect(page.getByRole('heading', { name: 'Alltag', level: 1 })).toBeVisible();
});

test('Alltag: Habits, Schlaf, Health, Verdienst – keine Ernährung; alte Adressen leiten weiter', async ({
  page,
}) => {
  const tabs = page.getByRole('group', { name: 'Bereich' });
  await expect(tabs.getByRole('button')).toHaveText(['Habits', 'Schlaf', 'Health', 'Verdienst']);
  await expect(tabs.getByRole('button', { name: 'Schlaf' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Ernährung')).toHaveCount(0);
  await shot(page, '04-koerper-leer', true);
  await page.goto('./#/koerper');
  await expect(page.getByRole('heading', { name: 'Alltag', level: 1 })).toBeVisible();
  await expect(tabs.getByRole('button', { name: 'Schlaf' })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('./#/habits');
  await expect(tabs.getByRole('button', { name: 'Habits' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Alltag' })).toHaveAttribute(
    'aria-current',
    'page',
  );
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

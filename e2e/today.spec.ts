import { expect, test } from '@playwright/test';
import { shot } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/#/heute');
  await expect(page.getByTestId('ring-card')).toBeVisible();
});

test('Heute-Screen im Leerzustand @screens', async ({ page }) => {
  await expect(page.getByTestId('health-hint')).toBeVisible();
  await shot(page, '03-heute-leer');
  await shot(page, '03-heute-leer-voll', true);
});

test('Navigation über die Tab-Leiste', async ({ page }) => {
  for (const [tab, title] of [
    ['Training', 'Training'],
    ['Schule', 'Schule'],
    ['Körper', 'Körper'],
    ['Rückblick', 'Rückblick'],
  ] as const) {
    await page.getByRole('navigation').getByRole('button', { name: tab }).click();
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Einstellungen' }).click();
  await expect(page).toHaveURL(/#\/einstellungen/);
  await page.getByRole('navigation').getByRole('button', { name: 'Heute' }).click();
  await expect(page.getByTestId('ring-card')).toBeVisible();
});

test('Schnellerfassung: Wasser in zwei Taps', async ({ page }) => {
  await page.getByTestId('fab').click();
  await expect(page.getByRole('dialog', { name: 'Was willst du eintragen?' })).toBeVisible();
  await shot(page, '03-schnellerfassung');
  await page.getByTestId('qa-wasser').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('water-value')).toContainText('1');
});

test('Schnellerfassung: Mahlzeit-Vorlage in drei Taps, Protein zählt', async ({ page }) => {
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-mahlzeit').click();
  await page.getByTestId('meal-templates').getByRole('button', { name: /Skyr/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByTestId('protein-value')).toContainText('38');
});

test('Eigene Mahlzeit mit Werten', async ({ page }) => {
  await page.getByRole('button', { name: 'Mahlzeit eintragen' }).click();
  await page.getByLabel('Name').fill('Mensa');
  await page.getByLabel('Kalorien (kcal)').fill('750');
  await page.getByLabel('Protein (g)').fill('42,5');
  await page.getByRole('dialog').getByRole('button', { name: 'Eintragen', exact: true }).click();
  await expect(page.getByTestId('protein-value')).toContainText('43');
});

test('Wasser per Plus und zurück', async ({ page }) => {
  const plus = page.getByRole('button', { name: 'Ein Glas Wasser' });
  await plus.click();
  await plus.click();
  await expect(page.getByTestId('water-value')).toContainText('2');
  await page.getByRole('button', { name: 'Ein Glas zurück' }).click();
  await expect(page.getByTestId('water-value')).toContainText('1');
});

test('Stimmung mit einem Tap, bleibt nach Neuladen', async ({ page }) => {
  await page.getByRole('button', { name: 'Stimmung 4' }).click();
  await expect(page.getByRole('button', { name: 'Stimmung 4' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Stimmung 4' })).toHaveAttribute('aria-pressed', 'true');
});

test('Tagesnotiz speichern', async ({ page }) => {
  await page.getByRole('button', { name: 'Tagesnotiz öffnen' }).click();
  await page.getByRole('textbox', { name: 'Tagesnotiz' }).fill('Guter Tag, Training lief.');
  await page.getByLabel('Morgen wichtig').fill('Mathe-Hausaufgabe');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const card = page.getByRole('button', { name: 'Tagesnotiz öffnen' });
  await expect(card).toContainText('Guter Tag, Training lief.');
  await expect(card).toContainText('Mathe-Hausaufgabe');
});

test('Zum Vortag und zurück (Buttons und Wischen)', async ({ page }) => {
  await page.getByRole('button', { name: 'Ein Glas Wasser' }).click();
  await page.getByRole('button', { name: 'Vortag' }).click();
  await expect(page).toHaveURL(/#\/heute\/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByTestId('water-value')).toContainText('0');
  await expect(page.getByRole('button', { name: 'Zu heute' })).toBeVisible();
  await page.getByRole('button', { name: 'Zu heute' }).click();
  await expect(page.getByTestId('water-value')).toContainText('1');

  // Wischen nach links → Folgetag
  const box = await page.getByTestId('ring-card').boundingBox();
  if (!box) throw new Error('Ring-Karte nicht sichtbar');
  const y = box.y + box.height / 2;
  await page.mouse.move(300, y);
  await page.mouse.down();
  await page.mouse.move(200, y, { steps: 5 });
  await page.mouse.move(80, y, { steps: 5 });
  await page.mouse.up();
  await expect(page).toHaveURL(/#\/heute\/\d{4}-\d{2}-\d{2}/);
});

test('Sheet schließt mit Escape und über den Hintergrund', async ({ page }) => {
  await page.getByTestId('fab').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByTestId('fab').click();
  await page.mouse.click(195, 60);
  await expect(page.getByRole('dialog')).toBeHidden();
});

import { expect, test } from './fixtures';
import { shot } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./#/heute');
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

test('Schnellerfassung ohne Wasser, Mahlzeit und Frist (v3)', async ({ page }) => {
  await page.getByTestId('fab').click();
  await expect(page.getByRole('dialog', { name: 'Was willst du eintragen?' })).toBeVisible();
  await shot(page, '03-schnellerfassung');
  for (const id of ['qa-wasser', 'qa-mahlzeit', 'qa-frist'])
    await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByTestId('qa-training')).toBeVisible();
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
  const mood = page.getByRole('button', { name: 'Stimmung 4' });
  await mood.click();
  await expect(mood).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Vortag' }).click();
  await expect(page).toHaveURL(/#\/heute\/\d{4}-\d{2}-\d{2}/);
  await expect(mood).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Zu heute' })).toBeVisible();
  await page.getByRole('button', { name: 'Zu heute' }).click();
  await expect(mood).toHaveAttribute('aria-pressed', 'true');

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

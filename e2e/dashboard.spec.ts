import { expect, test } from './fixtures';
import { enableDemo, shot } from './helpers';

test('Dashboard mit Demo-Daten: Briefing, Widgets, ohne Habits und Abi-Schnitt @screens', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await enableDemo(page);
  await page.goto('./#/heute');
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing')).not.toBeEmpty();
  await expect(page.getByTestId('dashboard').locator('[data-widget]').first()).toBeVisible();
  for (const id of ['habits', 'abi'])
    await expect(page.getByTestId('dashboard').locator(`[data-widget="${id}"]`)).toHaveCount(0);
  await shot(page, '13-dashboard');
  await shot(page, '13-dashboard-voll', true);
});

test('Dashboard anpassen: ausblenden, verschieben, klein – bleibt nach Neuladen', async ({ page }) => {
  await page.goto('./#/heute');
  await page.getByTestId('dashboard-edit').click();
  const editor = page.getByTestId('dashboard-editor');
  await editor.getByRole('switch', { name: 'Tagesnotiz anzeigen' }).click();
  await expect(editor.getByRole('switch', { name: 'Tagesnotiz anzeigen' })).not.toBeChecked();
  // Stimmung sieben Plätze nach oben (vor Training)
  for (let i = 0; i < 7; i++)
    await editor.getByRole('button', { name: 'Stimmung & Energie nach oben' }).click();
  await expect(editor.getByText('Habits', { exact: true })).toHaveCount(0);
  await expect(editor.getByText('Abi-Schnitt', { exact: true })).toHaveCount(0);
  // Tagesring ist standardmäßig groß → auf klein
  await expect(editor.getByRole('button', { name: 'Tagesring: klein' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await editor.getByRole('button', { name: 'Tagesring: klein' }).click();
  await shot(page, '13-dashboard-editor');
  await page.keyboard.press('Escape');

  await page.reload();
  const dash = page.getByTestId('dashboard');
  await expect(dash.locator('[data-widget="journal"]')).toHaveCount(0);
  await expect(dash.locator('[data-widget="ring"]')).toHaveClass(/dash__w--s/);
  const order = await dash
    .locator('[data-widget]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-widget')));
  expect(order.indexOf('mood')).toBeLessThan(order.indexOf('training'));
});

test('Wochenziel „3× Gym“ zeigt Fortschritt', async ({ page }) => {
  await page.goto('./#/heute');
  await page.getByTestId('goals-widget').getByRole('button', { name: 'Ziel anlegen' }).click();
  const s = page.getByRole('dialog', { name: 'Neues Ziel' });
  await s.getByLabel('Kennzahl').selectOption({ label: 'Gym-Einheiten' });
  await s.getByLabel(/^Ziel/).fill('3');
  await s.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('goal-row')).toContainText('Gym-Einheiten diese Woche');
  await expect(page.getByTestId('goal-row')).toContainText('0 / 3');
});

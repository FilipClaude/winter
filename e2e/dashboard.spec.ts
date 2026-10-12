import { expect, test } from './fixtures';
import { enableDemo, shot } from './helpers';

function berlinDate(offsetDays = 0): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

test('Dashboard mit Demo-Daten: Briefing, Widgets, Abi-Schnitt @screens', async ({ page }) => {
  test.setTimeout(90_000);
  await enableDemo(page);
  await page.goto('./#/heute');
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing')).not.toBeEmpty();
  await expect(page.getByTestId('dashboard').locator('[data-widget]').first()).toBeVisible();
  await shot(page, '13-dashboard');
  await shot(page, '13-dashboard-voll', true);
});

test('Dashboard anpassen: ausblenden, verschieben, klein – bleibt nach Neuladen', async ({ page }) => {
  await page.goto('./#/heute');
  await page.getByTestId('dashboard-edit').click();
  const editor = page.getByTestId('dashboard-editor');
  await editor.getByRole('switch', { name: 'Tagesnotiz anzeigen' }).click();
  await expect(editor.getByRole('switch', { name: 'Tagesnotiz anzeigen' })).not.toBeChecked();
  // Habits zwei Plätze nach oben
  await editor.getByRole('button', { name: 'Habits nach oben' }).click();
  await editor.getByRole('button', { name: 'Habits nach oben' }).click();
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
  expect(order.indexOf('habits')).toBeLessThan(order.indexOf('training'));
});

test('Kritische Frist (morgen fällig) steht ganz oben, Briefing nennt sie', async ({ page }) => {
  await page.goto('./#/schule');
  await page.getByRole('group', { name: 'Bereich' }).getByRole('button', { name: 'FernUni' }).click();
  await page.getByRole('button', { name: 'Frist', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'FernUni-Frist' });
  await d.getByLabel('Neues Modul').fill('BWL');
  await d.getByLabel('Bezeichnung').fill('EA 3');
  await d.getByLabel('Fällig am').fill(berlinDate(1));
  await d.getByRole('button', { name: 'Speichern' }).click();
  await expect(d).toBeHidden();

  await page.goto('./#/heute');
  const first = page.getByTestId('dashboard').locator('[data-widget]').first();
  await expect(first).toHaveAttribute('data-widget', 'alerts');
  await expect(page.getByTestId('briefing')).toContainText('EA 3 (BWL) ist morgen fällig.');
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

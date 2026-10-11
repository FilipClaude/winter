import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function audit(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const report = serious
    .map(
      (v) =>
        `${name}: ${v.id} – ${v.help}\n  ${v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join('\n  ')}`,
    )
    .join('\n');
  expect(serious, report).toEqual([]);
}

test('Barrierefreiheit (axe, WCAG AA) aller Screens mit Demo-Daten', async ({ page }) => {
  test.setTimeout(90_000);
  // Ohne Überblendungen messen: axe würde sonst halbtransparente Zwischenstände bewerten.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/einstellungen');
  await page.getByTestId('demo-toggle').check();
  await expect(page.getByText(/Demo-Einträge angelegt/)).toBeVisible();
  await page.waitForTimeout(2800); // Toast abwarten

  for (const route of ['heute', 'training', 'schule', 'koerper', 'rueckblick', 'habits', 'einstellungen']) {
    await page.goto(`/#/${route}`);
    await audit(page, route);
  }
  // Offene Sheets
  await page.goto('/#/heute');
  await page.getByTestId('fab').click();
  await audit(page, 'schnellerfassung');
  await page.getByTestId('qa-training').click();
  await audit(page, 'training-sheet');
});

test('Seitentitel folgt dem Screen', async ({ page }) => {
  await page.goto('/#/schule');
  await expect(page).toHaveTitle('Schule · Winter');
  await page.goto('/#/heute');
  await expect(page).toHaveTitle('Heute · Winter');
});

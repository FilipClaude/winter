import { expect, test, type Page } from './fixtures';
import { berlinDate, shot } from './helpers';

async function addExam(page: Page, subject: string, inDays: number) {
  await page.goto('./#/schule/klausuren');
  await page.getByRole('button', { name: 'Klausur', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Klausur' });
  await dialog.getByLabel('Fach').selectOption({ label: subject });
  await dialog.getByLabel('Datum').fill(berlinDate(inDays));
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
}

test('Probe-Klausuren: Prozent, geschätzte Punkte, Trend, Widget und eigener Notenschlüssel @screens', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await addExam(page, 'Mathe', 6);
  await page.getByTestId('exam-list').getByRole('button', { name: /Mathe/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Klausur' });
  const section = dialog.getByTestId('mock-section');

  // 13/25 BE → 52 % → ≈ 6 P
  await section.getByTestId('mock-add').click();
  await section.getByLabel('Erreichte BE').fill('13');
  await section.getByLabel('Maximale BE').fill('25');
  await section.getByLabel('Datum').fill(berlinDate(-5));
  await expect(section.getByTestId('mock-preview')).toContainText('52 % · ≈ 6 P');
  await expect(section.getByTestId('mock-preview')).toContainText(
    'Schätzung, Notenschlüssel der Schule kann abweichen',
  );
  await section.getByRole('button', { name: 'Probe speichern' }).click();
  await expect(section.getByTestId('mock-row')).toHaveCount(1);

  // 15,5/22 BE (deutsches Komma) → 70,5 % → ≈ 10 P
  await section.getByTestId('mock-add').click();
  await section.getByLabel('Erreichte BE').fill('15,5');
  await section.getByLabel('Maximale BE').fill('22');
  await section.getByLabel('Datum').fill(berlinDate(-1));
  await section.getByLabel('Dauer (min, optional)').fill('45');
  await section.getByRole('button', { name: 'Probe speichern' }).click();
  await expect(section.getByTestId('mock-row')).toHaveCount(2);
  await expect(section.getByTestId('mock-row').first()).toContainText('15,5/22 BE · 70,5 % · ≈ 10 P');
  await expect(section.getByTestId('mock-summary')).toContainText('+4 P seit der ersten Probe');
  await expect(section.getByRole('group', { name: 'Geschätzte Punkte je Probe-Durchgang' })).toBeVisible();
  await shot(page, 'v3-04-probe-sheet', true);
  await page.keyboard.press('Escape');

  // Verlauf je Fach im Klausuren-Bereich, letztes Ergebnis im Widget auf Heute
  await expect(page.getByTestId('mock-trends')).toContainText('Mathe');
  await expect(page.getByTestId('mock-trends')).toContainText('zuletzt ≈ 10 P');
  await page.goto('./#/heute');
  await expect(page.getByTestId('next-exam')).toContainText('Probe 70,5 % · ≈ 10 P');

  // Eigener Schlüssel: 10 P erst ab 71 % → aus 70,5 % werden 9 P
  await page.goto('./#/einstellungen');
  await page.getByTestId('np-scale-card').getByRole('button', { name: 'Ändern' }).click();
  const np = page.getByTestId('np-scale-sheet');
  await np.getByLabel('10 P ab %').fill('71');
  await np.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('np-scale-card')).toContainText('eigene Tabelle');
  await page.goto('./#/heute');
  await expect(page.getByTestId('next-exam')).toContainText('≈ 9 P');

  // Löschen mit Rückgängig
  await page.goto('./#/schule/klausuren');
  await page.getByTestId('exam-list').getByRole('button', { name: /Mathe/ }).click();
  await dialog
    .getByRole('button', { name: /Probe vom .* löschen/ })
    .first()
    .click();
  await expect(section.getByTestId('mock-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(section.getByTestId('mock-row')).toHaveCount(2);
});

test('Probe-Eingabe: mehr BE als möglich wird abgelehnt', async ({ page }) => {
  await addExam(page, 'Bio', 3);
  await page.getByTestId('exam-list').getByRole('button', { name: /Bio/ }).click();
  const section = page.getByRole('dialog', { name: 'Klausur' }).getByTestId('mock-section');
  await section.getByTestId('mock-add').click();
  await section.getByLabel('Erreichte BE').fill('23');
  await section.getByLabel('Maximale BE').fill('22');
  await expect(section.getByText('Erreichte BE dürfen nicht über dem Maximum liegen.')).toBeVisible();
  await expect(section.getByRole('button', { name: 'Probe speichern' })).toBeDisabled();
});

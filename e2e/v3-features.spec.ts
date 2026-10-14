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

test('Gym-Split: Push wählen, überall sichtbar, Verteilung im Rückblick @screens', async ({ page }) => {
  await page.goto('./#/training');
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-training').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('group', { name: 'Art der Einheit' }).getByRole('button', { name: 'Gym' }).click();
  const split = dialog.getByRole('group', { name: 'Split' });
  await expect(split.getByRole('button')).toHaveText(['Push', 'Pull', 'Legs']);
  await split.getByRole('button', { name: 'Push' }).click();
  await expect(split.getByRole('button', { name: 'Push' })).toHaveAttribute('aria-pressed', 'true');
  await shot(page, 'v3-05-split-sheet');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Gym · Push gespeichert')).toBeVisible();
  await expect(page.getByTestId('session-row').first()).toContainText('Gym · Push');

  // zweite Einheit ohne Split bleibt „Gym“
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-training').click();
  await dialog.getByRole('group', { name: 'Art der Einheit' }).getByRole('button', { name: 'Gym' }).click();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Gym gespeichert')).toBeVisible();

  await page.goto('./#/heute');
  await expect(page.getByRole('region', { name: 'Training heute' })).toContainText('Gym · Push');
  await page.goto('./#/rueckblick');
  await expect(page.getByTestId('review-splits')).toContainText('Gym: 1× Push, 1× Gym');
  await expect(page.getByTestId('week-report')).toContainText('Gym: 1× Push, 1× Gym.');

  // Bearbeiten: Split wieder abwählen
  await page.goto('./#/training');
  await page.getByTestId('session-row').filter({ hasText: 'Gym · Push' }).click();
  await dialog.getByRole('group', { name: 'Split' }).getByRole('button', { name: 'Push' }).click();
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('session-row').filter({ hasText: 'Gym · Push' })).toHaveCount(0);
});

test('Verdienst: Komma-Eingabe, Wochenziel, Ring, Bearbeiten, Löschen mit Rückgängig, Ziel und Rückblick @screens', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('./#/heute');
  const widget = page.getByTestId('earnings-widget');
  await expect(widget.getByTestId('earnings-sum')).toHaveText('0,00 €');
  await expect(widget.getByRole('progressbar')).toHaveCount(0); // ohne Ziel kein leerer Balken

  // Schnellerfassung → 12,5 → 12,50 €
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-verdienst').click();
  const sheet = page.getByTestId('earning-sheet');
  await sheet.getByLabel('Betrag (€)').fill('12,5');
  await expect(sheet.getByTestId('earning-preview')).toHaveText('= 12,50 €');
  await sheet.getByLabel('Notiz (optional)').fill('Nachhilfe');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(widget.getByTestId('earnings-sum')).toHaveText('12,50 €');
  // klein (Standard): Einträge im Sheet
  await widget.getByTestId('earnings-more').click();
  await expect(page.getByTestId('earnings-week-sheet').getByTestId('earnings-list')).toContainText(
    'Nachhilfe',
  );
  await page.keyboard.press('Escape');

  // ungültiger Betrag
  await widget.getByRole('button', { name: 'Verdienst eintragen' }).click();
  await sheet.getByLabel('Betrag (€)').fill('-3');
  await expect(sheet.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  await sheet.getByLabel('Betrag (€)').fill('7');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(widget.getByTestId('earnings-sum')).toHaveText('19,50 €');

  // Bearbeiten: 7 → 27,50
  await widget.getByTestId('earnings-more').click();
  const list = page.getByTestId('earnings-week-sheet').getByTestId('earnings-list');
  await list.getByRole('button', { name: /^7,00 €(?!.*löschen)/ }).click();
  await page.getByTestId('earning-sheet').getByLabel('Betrag (€)').fill('27,50');
  await page.getByTestId('earning-sheet').getByRole('button', { name: 'Speichern' }).click();
  await expect(widget.getByTestId('earnings-sum')).toHaveText('40,00 €');

  // Löschen mit Rückgängig
  await widget.getByTestId('earnings-more').click();
  await list.getByRole('button', { name: /^12,50 € vom .* löschen$/ }).click();
  await expect(page.getByTestId('earnings-week-sheet')).toContainText('27,50 €');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByTestId('earnings-week-sheet')).toContainText('40,00 €');
  await page.keyboard.press('Escape');
  await expect(widget.getByTestId('earnings-sum')).toHaveText('40,00 €');

  // Wochenziel 80 € → Balken, Ring-Segment
  await page.goto('./#/einstellungen');
  await page.getByRole('region', { name: 'Tagesziele' }).getByRole('button', { name: 'Ändern' }).click();
  await page.getByTestId('earnings-goal').fill('80');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('region', { name: 'Tagesziele' })).toContainText('Verdienst 80 € pro Woche');
  await page.goto('./#/heute');
  await expect(widget).toContainText('von 80 €');
  await expect(widget.getByRole('progressbar', { name: 'Wochenziel Verdienst' })).toHaveAttribute(
    'aria-valuenow',
    '50',
  );
  await expect(page.getByTestId('ring-card')).toContainText('Verdienst');
  await shot(page, 'v3-06-verdienst-heute', true);

  // Ziel-Metrik in Euro
  await page.getByTestId('goals-widget').getByRole('button', { name: 'Ziel anlegen' }).click();
  const g = page.getByRole('dialog', { name: 'Neues Ziel' });
  await g.getByLabel('Kennzahl').selectOption({ label: 'Verdienst' });
  await g.getByLabel(/^Ziel/).fill('50');
  await g.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('goal-row')).toContainText('Verdienst diese Woche');
  await expect(page.getByTestId('goal-row')).toContainText('40,00 / 50,00 €');

  // Rückblick: 8 Wochen und Wochenbericht
  await page.goto('./#/rueckblick');
  await expect(page.getByTestId('earnings-weeks')).toContainText('Zusammen 40,00 €');
  await expect(page.getByTestId('week-report')).toContainText('Verdienst 40,00 € von 80 €');
});

test('Tagesring: Habits, Lernen, Schlaf, Training, Verdienst – einzeln abschaltbar', async ({ page }) => {
  await page.goto('./#/heute');
  const ring = page.getByTestId('ring-card');
  // Ohne Habits, ohne Wochenziel: Lernen, Schlaf und – falls heute laut Plan Training ist – Training
  await expect(ring).toContainText('Lernen');
  await expect(ring).toContainText('Schlaf');
  await expect(ring).not.toContainText('Protein');
  await expect(ring).not.toContainText('Wasser');
  await expect(ring).not.toContainText('Verdienst');

  await page.goto('./#/einstellungen');
  await page.getByRole('region', { name: 'Tagesziele' }).getByRole('button', { name: 'Ändern' }).click();
  const sheet = page.getByRole('dialog');
  for (const name of ['Habits', 'Lernzeit', 'Schlaf', 'Training', 'Verdienst'])
    await expect(sheet.getByRole('switch', { name })).toBeChecked();
  await expect(sheet.getByRole('switch', { name: 'Protein' })).toHaveCount(0);
  await sheet.getByTestId('earnings-goal').fill('70');
  await sheet.getByRole('switch', { name: 'Schlaf' }).uncheck();
  await sheet.getByRole('switch', { name: 'Lernzeit' }).uncheck();
  await sheet.getByRole('button', { name: 'Speichern' }).click();

  await page.goto('./#/heute');
  await expect(ring).toContainText('Verdienst');
  await expect(ring).not.toContainText('Schlaf');
  await expect(ring).not.toContainText('Lernen');
  await page.reload();
  await expect(ring).toContainText('Verdienst');
  await expect(ring).not.toContainText('Lernen');
});

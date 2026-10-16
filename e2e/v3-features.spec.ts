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

test('Tagesring: Habits, Hausaufgaben, Schlaf, Training, Verdienst – einzeln abschaltbar', async ({
  page,
}) => {
  await page.goto('./#/heute');
  const ring = page.getByTestId('ring-card');
  // Ohne Habits, ohne Wochenziel: Lernen, Schlaf und – falls heute laut Plan Training ist – Training
  await expect(ring).toContainText('Schlaf');
  await expect(ring).not.toContainText('Protein');
  await expect(ring).not.toContainText('Wasser');
  await expect(ring).not.toContainText('Verdienst');

  await page.goto('./#/einstellungen');
  await page.getByRole('region', { name: 'Tagesziele' }).getByRole('button', { name: 'Ändern' }).click();
  const sheet = page.getByRole('dialog');
  for (const name of ['Habits', 'Hausaufgaben', 'Schlaf', 'Training', 'Verdienst'])
    await expect(sheet.getByRole('switch', { name })).toBeChecked();
  await expect(sheet.getByRole('switch', { name: 'Protein' })).toHaveCount(0);
  await sheet.getByTestId('earnings-goal').fill('70');
  await sheet.getByRole('switch', { name: 'Schlaf' }).uncheck();
  await expect(sheet.getByRole('switch', { name: 'Lernzeit' })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Speichern' }).click();

  await page.goto('./#/heute');
  await expect(ring).toContainText('Verdienst');
  await expect(ring).not.toContainText('Schlaf');
  await page.reload();
  await expect(ring).toContainText('Verdienst');
  await expect(ring).not.toContainText('Schlaf');
});

test('Verdienst-Widget an einem Tag einer früheren Woche nennt die KW', async ({ page }) => {
  await page.goto(`./#/heute/${berlinDate(-7)}`);
  const widget = page.getByTestId('earnings-widget');
  await expect(widget).toContainText(/KW \d+/);
  await expect(widget).not.toContainText('diese Woche');
});

test('Hausaufgaben im Tagesring abhaken (nur an Schultagen)', async ({ page }) => {
  // Mittwoch, 14.10.2026 = Schultag; Samstag, 17.10. = schulfrei
  await page.clock.install({ time: new Date('2026-10-14T16:00:00+02:00') });
  await page.goto('./#/heute');
  const ring = page.getByTestId('ring-card');
  const hw = ring.getByTestId('ring-homework');
  const check = hw.getByRole('checkbox', { name: 'Hausaufgaben erledigt' });
  await expect(check).toHaveAttribute('aria-checked', 'false');
  await check.click();
  await expect(check).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(ring.getByRole('checkbox', { name: 'Hausaufgaben erledigt' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await shot(page, 'v3-07-hausaufgaben');
  await page.goto('./#/heute/2026-10-17');
  await expect(page.getByTestId('ring-card')).toBeVisible();
  await expect(page.getByTestId('ring-homework')).toHaveCount(0);
});

test('Hausaufgaben füllen sich automatisch, wenn alle heute fälligen Aufgaben erledigt sind', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Ohne feste Uhr: Mit heute fälligen Aufgaben erscheint das Segment an jedem Tag (auch am Wochenende)
  for (const title of ['Mathe S. 112', 'Englisch Vokabeln']) {
    await page.goto('./#/schule/aufgaben');
    await page.getByRole('button', { name: 'Aufgabe', exact: true }).click();
    const d = page.getByRole('dialog', { name: 'Aufgabe' });
    await d.getByLabel('Aufgabe').fill(title);
    await d.getByLabel('Fällig').fill(berlinDate(0));
    await d.getByRole('button', { name: 'Speichern' }).click();
    await expect(d).toBeHidden();
  }
  await page.goto('./#/heute');
  const hw = page.getByTestId('ring-homework');
  const check = hw.getByRole('checkbox', { name: 'Hausaufgaben erledigt' });
  await expect(hw.getByTestId('ring-homework-count')).toHaveText('0/2');
  await expect(check).toHaveAttribute('aria-checked', 'false');

  await page.goto('./#/schule/aufgaben');
  await page.getByRole('checkbox', { name: 'Mathe S. 112 erledigt' }).click();
  await page.goto('./#/heute');
  await expect(hw.getByTestId('ring-homework-count')).toHaveText('1/2');
  await expect(check).toHaveAttribute('aria-checked', 'false');

  await page.goto('./#/schule/aufgaben');
  await page.getByRole('checkbox', { name: 'Englisch Vokabeln erledigt' }).click();
  await page.goto('./#/heute');
  await expect(hw.getByTestId('ring-homework-count')).toHaveText('2/2');
  await expect(check).toHaveAttribute('aria-checked', 'true');

  // Ein Tap überschreibt die Automatik (z. B. noch etwas offen, das nicht eingetragen ist)
  await check.click();
  await expect(check).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(
    page.getByTestId('ring-homework').getByRole('checkbox', { name: 'Hausaufgaben erledigt' }),
  ).toHaveAttribute('aria-checked', 'false');
});

test('Schritte: ohne Import für heute zeigt Heute den letzten Stand mit Datum', async ({ page }) => {
  await page.goto('./#/heute');
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-health').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'JSON von Hand einfügen' }).click();
  await dialog.getByTestId('health-text').fill(JSON.stringify({ v: 1, date: berlinDate(-1), steps: 9120 }));
  await dialog.getByRole('button', { name: 'Text importieren' }).click();
  await expect(dialog.getByTestId('health-result')).toBeVisible();
  await page.keyboard.press('Escape');
  const card = page.getByRole('region', { name: 'Schritte' });
  await expect(card.getByTestId('steps-last')).toContainText('9.120');
  await expect(card.getByTestId('steps-last')).toContainText('gestern · für heute noch kein Import');
  // Mit Import für heute zählt der heutige Wert
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-health').click();
  await dialog.getByRole('button', { name: 'JSON von Hand einfügen' }).click();
  await dialog.getByTestId('health-text').fill(JSON.stringify({ v: 1, date: berlinDate(0), steps: 4321 }));
  await dialog.getByRole('button', { name: 'Text importieren' }).click();
  await expect(dialog.getByTestId('health-result')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toContainText('4.321');
  await expect(card.getByTestId('steps-last')).toHaveCount(0);
});

test('Health: Import mit altem Datum wird erkannt – Hinweis bleibt, „Für heute speichern“ korrigiert (v3.3)', async ({
  page,
}) => {
  await page.goto('./#/heute');
  const dialog = page.getByRole('dialog');
  const paste = async (json: string) => {
    await page.getByTestId('fab').click();
    await page.getByTestId('qa-health').click();
    await dialog.getByRole('button', { name: 'JSON von Hand einfügen' }).click();
    await dialog.getByTestId('health-text').fill(json);
    await dialog.getByRole('button', { name: 'Text importieren' }).click();
  };
  const old = JSON.stringify({ v: 1, date: berlinDate(-2), steps: 7300, distanceKm: 5.2 });

  await paste(old);
  await expect(dialog.getByTestId('health-stale')).toContainText('Nicht von heute');
  await shot(page, 'v33-health-stale');
  await page.keyboard.press('Escape');
  // Früher versteckte der Import (egal welcher Tag) den Hinweis – jetzt bleibt er, solange heute nichts da ist
  await expect(page.getByTestId('health-hint')).toBeVisible();

  // Dieselbe alte Zwischenablage noch einmal → klare Fehlermeldung statt „übernommen“
  await paste(old);
  await expect(dialog.getByTestId('health-error')).toContainText('alte Inhalt');
  await page.keyboard.press('Escape');

  // Neue Werte mit festem altem Datum → mit einem Tap für heute speichern
  await paste(JSON.stringify({ v: 1, date: berlinDate(-2), steps: 9876, distanceKm: 7.1 }));
  await dialog.getByTestId('health-move-today').click();
  await expect(dialog.getByTestId('health-stale')).toHaveCount(0);
  await page.keyboard.press('Escape');
  const card = page.getByRole('region', { name: 'Schritte' });
  await expect(card).toContainText('9.876');
  await expect(card.getByTestId('steps-last')).toHaveCount(0);
  await expect(page.getByTestId('health-hint')).toHaveCount(0);

  // Verlauf: heute mit den neuen Werten, der alte Tag wieder mit seinem alten Stand
  await page.goto('./#/alltag/health');
  const history = page.getByRole('region', { name: 'Health-Verlauf' });
  await expect(history).toContainText('9.876');
  await expect(history).toContainText('7.300');
  await expect(page.getByTestId('health-latest-day')).toHaveCount(0);
  await shot(page, 'v33-health-verlauf');
});

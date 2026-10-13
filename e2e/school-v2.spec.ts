import { expect, test, type Page } from './fixtures';
import { berlinDate, shot } from './helpers';

async function openSchoolTab(page: Page, tab: string) {
  await page.goto('./#/schule');
  await page.getByRole('group', { name: 'Bereich' }).getByRole('button', { name: tab, exact: true }).click();
}

test('Noten: große und kleine Leistungsnachweise → Halbjahresschnitt 1 : 1 @screens', async ({ page }) => {
  await openSchoolTab(page, 'Noten');
  await expect(page.getByTestId('grades-view')).toContainText('Noch keine Noten');
  const add = async (type: string, points: string) => {
    await page.getByRole('button', { name: 'Note eintragen' }).click();
    const d = page.getByRole('dialog', { name: 'Neue Note' });
    await d.getByLabel('Fach').selectOption({ label: 'Mathe' });
    await d.getByRole('group', { name: 'Art' }).getByRole('button', { name: type }).click();
    await d.getByLabel('Punkte (0–15)').fill(points);
    await d.getByRole('button', { name: 'Speichern' }).click();
    await expect(d).toBeHidden();
  };
  await add('Klausur', '12');
  await add('Ex', '9');
  await add('Abfrage', '11');
  const card = page.getByTestId('grade-subject');
  // (12 + (9 + 11) / 2) / 2 = 11
  await expect(card).toContainText('11,0');
  await expect(card).toContainText('11 P (Note 2)');
  await expect(page.getByTestId('grade-row')).toHaveCount(3);
  await shot(page, '12-noten');
});

test('Abi-Rechner: Abiturfächer wählen, Zeugnis eintragen, Szenario rechnet @screens', async ({ page }) => {
  await openSchoolTab(page, 'Abi');
  await expect(page.getByTestId('abi-setup-hint')).toBeVisible();
  await page.getByTestId('abi-exams').getByRole('button', { name: 'Fächer' }).click();
  const sheet = page.getByRole('dialog', { name: 'Abiturfächer' });
  for (const name of ['Deutsch', 'Mathe', 'PuG · LF', 'Englisch', 'Geschichte']) {
    await sheet.getByRole('button', { name, exact: true }).click();
  }
  await expect(sheet).toContainText('5 von 5 gewählt');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('abi-setup-hint')).toHaveCount(0);

  // Zeugniswert für Deutsch 12/1
  await page.getByRole('button', { name: /^Deutsch 12\/1:/ }).click();
  const z = page.getByRole('dialog', { name: 'Deutsch · 12/1' });
  await z.getByLabel('Halbjahresleistung laut Zeugnis (0–15)').fill('13');
  await z.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('button', { name: /^Deutsch 12\/1: 13 Punkte \(zeugnis/ })).toBeVisible();

  await expect(page.getByTestId('abi-grade')).not.toHaveText('–');
  await expect(page.getByTestId('abi-scenario-result')).toContainText(/Punkte|reicht auch eine 15/);
  await page.getByTestId('abi-rules').getByRole('button', { name: 'Anzeigen' }).click();
  await expect(page.getByTestId('abi-rules')).toContainText('unsicher');
  await expect(page.getByTestId('abi-rules')).toContainText('GSO');
  await shot(page, '12-abi', true);
});

test('Klausur mit Themen → Lernplan mit Wiederholungen, bewertete Klausur wird Note', async ({ page }) => {
  test.setTimeout(60_000);
  await openSchoolTab(page, 'Klausuren');
  await page.getByRole('button', { name: 'Klausur', exact: true }).click();
  const d = page.getByRole('dialog', { name: 'Klausur' });
  await d.getByLabel('Datum').fill(berlinDate(10));
  for (const t of ['Kurvendiskussion', 'Integrale']) {
    await d.getByLabel('Neues Thema').fill(t);
    await d.getByRole('button', { name: 'Thema' }).click();
  }
  await expect(d.getByTestId('exam-topics')).toContainText('Lernstand 0 %');
  await d.getByRole('group', { name: 'Lernstand Integrale' }).getByRole('button', { name: 'sitzt' }).click();
  await expect(d.getByTestId('exam-topics')).toContainText('Lernstand 33 %');
  await d.getByTestId('make-plan').click();
  await expect(d.getByTestId('plan-info')).toContainText('Lerneinheiten geplant');
  await shot(page, '12-klausur-themen');
  await d.getByRole('button', { name: 'Speichern' }).click();

  await openSchoolTab(page, 'Plan');
  const blocks = page.getByTestId('study-block');
  await expect(blocks.first()).toBeVisible();
  expect(await blocks.count()).toBeGreaterThanOrEqual(4);
  await blocks.first().getByRole('checkbox').click();
  await expect(blocks.first().getByRole('checkbox')).toHaveAttribute('aria-checked', 'true');
  await shot(page, '12-plan', true);

  // Rückgabe: Punkte eintragen → Note im Fach (Halbjahresleistung) vorhanden
  await openSchoolTab(page, 'Klausuren');
  await page.getByTestId('exam-list').getByRole('button').first().click();
  const e = page.getByRole('dialog', { name: 'Klausur' });
  await e.getByLabel('Punkte (0–15, nach Rückgabe)').fill('10');
  await e.getByRole('button', { name: 'Speichern' }).click();
  await expect(e).toBeHidden();
  await openSchoolTab(page, 'Noten');
  await expect(page.getByTestId('grade-row').first()).toContainText('Klausur · groß');
});

test('Stundenplan mit A/B-Wochen und Ferien-Hinweis', async ({ page }) => {
  await openSchoolTab(page, 'Plan');
  const tt = page.getByTestId('timetable');
  await tt.getByRole('group', { name: 'Wochentag' }).getByRole('button', { name: 'Di' }).click();
  await tt.getByRole('button', { name: 'Stunde eintragen' }).click();
  const d = page.getByRole('dialog', { name: 'Stunde' });
  await d.getByLabel('Stunde', { exact: true }).fill('3');
  await d.getByLabel('Raum').fill('A104');
  await d.getByLabel('Fach').selectOption({ label: 'PuG' });
  await d.getByRole('button', { name: 'Speichern' }).click();
  await expect(tt.getByTestId('lesson-row')).toContainText('PuG');
  await expect(tt.getByTestId('lesson-row')).toContainText('A104');
  await tt.getByRole('switch').click();
  await expect(tt.getByRole('switch')).toBeChecked();
  await expect(tt).toContainText(/[AB]-Woche/);
  await expect(page.getByTestId('breaks')).toContainText('Quelle');
});

test('Pomodoro-Timer zeigt Fokusphase; wiederkehrende Aufgabe erzeugt Folgeaufgabe', async ({ page }) => {
  await page.goto('./#/schule');
  await page.getByRole('button', { name: 'Lernen starten' }).click();
  const s = page.getByRole('dialog', { name: 'Lernzeit' });
  await s
    .getByRole('group', { name: 'Timer-Modus' })
    .getByRole('button', { name: /Pomodoro/ })
    .click();
  await s.getByRole('button', { name: 'Timer starten' }).click();
  await expect(page.getByTestId('timer-card')).toContainText('Fokus 1');
  await expect(page.getByTestId('pomodoro-info')).toContainText('nur die Fokuszeit');

  await openSchoolTab(page, 'Aufgaben');
  await page.getByRole('button', { name: 'Aufgabe', exact: true }).click();
  const t = page.getByRole('dialog', { name: 'Aufgabe' });
  await t.getByLabel('Aufgabe').fill('Vokabeln lernen');
  await t.getByLabel('Fällig').fill(berlinDate(1));
  await t.getByRole('group', { name: 'Wiederholen' }).getByRole('button', { name: 'Wöchentlich' }).click();
  await t.getByRole('group', { name: 'Priorität' }).getByRole('button', { name: 'Hoch' }).click();
  await t.getByRole('button', { name: 'Speichern' }).click();
  const list = page.getByTestId('todo-list');
  await expect(list).toContainText('wöchentlich');
  await list.getByRole('checkbox', { name: 'Vokabeln lernen erledigt' }).click();
  // Die Folgeaufgabe erscheint sofort wieder offen
  await expect(list.getByRole('checkbox', { name: 'Vokabeln lernen erledigt' })).toHaveCount(1);
  await expect(list).toContainText('in 8 Tagen');
});

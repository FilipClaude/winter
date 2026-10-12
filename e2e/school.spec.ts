import { expect, test, type Page } from './fixtures';
import { shot } from './helpers';

/** Berliner Datum in n Tagen als JJJJ-MM-TT. */
function berlinDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function addDeadline(page: Page, title: string, inDays: number, module?: string) {
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-frist').click();
  const dialog = page.getByRole('dialog', { name: 'FernUni-Frist' });
  if (module) {
    await dialog.getByLabel('Neues Modul').fill(module);
    await dialog.getByLabel('Nummer').fill('31001');
  }
  await dialog.getByLabel('Bezeichnung').fill(title);
  await dialog.getByLabel('Fällig am').fill(berlinDate(inDays));
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toBeHidden();
}

test('Lern-Timer übersteht Neuladen und speichert Lernzeit', async ({ page }) => {
  await page.goto('./#/schule');
  await page.getByRole('button', { name: 'Lernen starten' }).click();
  const dialog = page.getByRole('dialog', { name: 'Lernzeit' });
  await dialog.getByRole('button', { name: 'Mathe', exact: true }).click();
  await dialog.getByRole('button', { name: 'Timer starten' }).click();
  await expect(page.getByTestId('timer-clock')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Lern-Timer läuft' })).toContainText('Mathe');
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('timer-clock')).not.toHaveText('0:00');
  await shot(page, '05-timer');
  await page.getByRole('button', { name: 'Timer stoppen' }).click();
  await expect(page.getByRole('button', { name: 'Lernen starten' })).toBeVisible();
  await page.getByRole('button', { name: 'Lernzeit', exact: true }).click();
  await expect(page.getByTestId('study-stats')).toBeVisible();
});

test('Lernzeit nachtragen erscheint pro Fach @screens', async ({ page }) => {
  await page.goto('./#/schule');
  await page.getByTestId('fab').click();
  await page.getByTestId('qa-lernen').click();
  const dialog = page.getByRole('dialog', { name: 'Lernzeit' });
  await dialog.getByRole('button', { name: 'PuG', exact: true }).click();
  await dialog.getByLabel('Minuten').fill('75');
  await dialog.getByRole('button', { name: 'Lernzeit eintragen' }).click();
  await page.getByRole('button', { name: 'Lernzeit', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Lernzeit nach Fach' })).toContainText('PuG');
  await expect(page.getByRole('region', { name: 'Lernzeit nach Fach' })).toContainText('1 h 15 min');
  await shot(page, '05-lernzeit', true);
});

test('FernUni-Fristen: Warnstufen 14/7/2 Tage auf Heute, abhaken @screens', async ({ page }) => {
  await page.goto('./#/heute');
  await addDeadline(page, 'EA 1', 1, 'Grundlagen der BWL');
  await addDeadline(page, 'EA 2', 6);
  await addDeadline(page, 'EA 3', 12);
  await addDeadline(page, 'Klausur Modul', 30);

  const alerts = page.getByTestId('deadline-alerts');
  await expect(alerts.locator('.deadline')).toHaveCount(3); // 30 Tage noch nicht
  await expect(alerts.locator('.deadline--kritisch')).toContainText('EA 1');
  await expect(alerts.locator('.deadline--kritisch')).toContainText('morgen');
  await expect(alerts.locator('.deadline--nah')).toContainText('EA 2');
  await expect(alerts.locator('.deadline--bald')).toContainText('EA 3');
  await shot(page, '05-heute-fristen');

  await alerts.getByRole('checkbox', { name: 'EA 1 erledigt' }).click();
  await expect(alerts.locator('.deadline')).toHaveCount(2);

  await page.goto('./#/schule');
  await page.getByRole('button', { name: 'FernUni' }).click();
  await expect(page.getByTestId('deadline-list')).toContainText('Klausur Modul');
  await expect(page.getByTestId('deadline-list')).toContainText('in 30 Tagen');
  await shot(page, '05-fernuni', true);
});

test('Überfällige Frist bleibt sichtbar', async ({ page }) => {
  await page.goto('./#/heute');
  await addDeadline(page, 'EA verpasst', -2, 'Mikroökonomik');
  await expect(page.getByTestId('deadline-alerts').locator('.deadline--ueberfaellig')).toContainText(
    'seit 2 Tagen überfällig',
  );
});

test('Klausur mit Countdown und Notenschnitt @screens', async ({ page }) => {
  await page.goto('./#/schule');
  await page.getByRole('button', { name: 'Klausuren' }).click();
  // anstehend
  await page.getByRole('button', { name: 'Klausur', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Klausur' });
  await dialog.getByLabel('Fach').selectOption({ label: 'Mathe' });
  await dialog.getByLabel('Datum').fill(berlinDate(5));
  await dialog.getByLabel('Themen').fill('Analysis');
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('exam-list')).toContainText('Mathe');
  // bewertet
  for (const [subject, pts] of [
    ['Deutsch', '11'],
    ['Deutsch', '13'],
    ['PuG', '8'],
  ] as const) {
    await page.getByRole('button', { name: 'Klausur', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Klausur' });
    await dialog.getByLabel('Fach').selectOption({ label: subject });
    await dialog.getByLabel('Datum').fill(berlinDate(-20));
    await dialog.getByLabel('Punkte (0–15, nach Rückgabe)').fill(pts);
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toBeHidden();
  }
  const grades = page.getByTestId('grades-card');
  await expect(grades).toContainText('10,7'); // (11+13+8)/3
  await expect(grades).toContainText('12,0'); // Deutsch
  await shot(page, '05-klausuren', true);

  await page.goto('./#/heute');
  await expect(page.getByRole('button', { name: 'Nächster Termin' })).toContainText('Mathe');
  await expect(page.getByRole('button', { name: 'Nächster Termin' })).toContainText('5');
});

test('Aufgabe anlegen und abhaken', async ({ page }) => {
  await page.goto('./#/schule');
  await page.getByRole('button', { name: 'Aufgabe', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Aufgabe' });
  await dialog.getByLabel('Aufgabe').fill('Englisch Essay');
  await dialog.getByLabel('Fach').selectOption({ label: 'Englisch' });
  await dialog.getByLabel('Fällig').fill(berlinDate(0));
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByTestId('todo-list')).toContainText('Englisch Essay');
  await expect(page.getByTestId('todo-list')).toContainText('heute fällig');
  await shot(page, '05-aufgaben');
  await page.getByRole('checkbox', { name: 'Englisch Essay erledigt' }).click();
  await expect(page.getByTestId('todo-list')).toContainText('Alles erledigt');
  await expect(page.getByRole('region', { name: 'Erledigte Aufgaben' })).toContainText('Englisch Essay');
});

test('Vergessener Timer (> 6 h) wird gemeldet und lässt sich verwerfen', async ({ page }) => {
  await page.goto('./#/schule');
  await expect(page.getByRole('button', { name: 'Lernen starten' })).toBeVisible();
  // Timer direkt in IndexedDB setzen: Start vor 7 Stunden
  await page.evaluate(
    (startedAt) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('winter');
        req.onsuccess = () => {
          const tx = req.result.transaction('kv', 'readwrite');
          tx.objectStore('kv').put({ key: 'timer', value: { subjectId: 'x', startedAt } });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    new Date(Date.now() - 7 * 3_600_000).toISOString(),
  );
  await page.reload();
  await expect(page.getByTestId('timer-forgotten')).toContainText('seit über 7 h');
  await page.getByTestId('timer-forgotten').getByRole('button', { name: 'Verwerfen' }).click();
  await expect(page.getByRole('button', { name: 'Lernen starten' })).toBeVisible();
});

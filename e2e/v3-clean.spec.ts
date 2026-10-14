import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';
import { berlinDate, shot, SLOW_WRITE } from './helpers';

/**
 * v3: Uni und Ernährung sind aus der Oberfläche verschwunden – auch mit echten v2-Daten voller
 * FernUni-Module, Fristen, Uni-Lernzeit, Mahlzeiten, Wasser und Protein-Zielen (Fixture backup-v2.json).
 * Der Test importiert die Sicherung, öffnet jeden Screen, jeden Bereich und die wichtigsten Sheets und
 * durchsucht den sichtbaren Text.
 */
const V2 = readFileSync('src/test/fixtures/backup-v2.json', 'utf8');
const FORBIDDEN =
  /FernUni|\bUni\b|Modul|Einsende|Prüfungsberechtig|Frühstudium|Protein|Wasser|Gläser|kcal|Kalorien|Mahlzeit|Ernährung/i;

async function expectClean(page: Page, where: string) {
  // Sichtbarer Text inklusive Sheets und Toasts
  const text = await page.evaluate(() => document.body.innerText);
  const hit = FORBIDDEN.exec(text);
  expect(
    hit?.[0] ?? null,
    `${where}: „${hit ? text.slice(Math.max(0, hit.index - 60), hit.index + 60) : ''}“`,
  ).toBeNull();
}

async function closeSheet(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('kein Uni- und kein Ernährungstext in der Oberfläche – mit migrierten v2-Daten', async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto('./#/einstellungen');
  await page
    .getByTestId('backup-file')
    .setInputFiles({ name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(V2) });
  const preview = page.getByTestId('import-preview');
  await expect(preview).toContainText('Einträge werden importiert');
  // Ältere Bereiche werden mit importiert, aber nur als Summe genannt
  await expect(preview.getByTestId('import-retired')).toContainText('Ältere, ausgeblendete Daten');
  await expectClean(page, 'Import-Vorschau');
  await shot(page, 'v3-02-import-vorschau');
  await preview.getByRole('button', { name: 'Ersetzen und importieren' }).click();
  await expect(page.getByText(/importiert/).first()).toBeVisible(SLOW_WRITE);

  // Review-Fund: Auch Klausuren, Aufgaben, Stunden und Lerneinheiten zum Fach „FernUni“ (in v2 normal
  // wählbar) dürfen nirgends auftauchen – morgen, überfällig, heute im Stundenplan und im Lernplan.
  await page.evaluate(
    async ({ tomorrow, yesterday, today, weekday }) => {
      const idb = await new Promise<IDBDatabase>((res, rej) => {
        const r = indexedDB.open('winter');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const subjects = await new Promise<{ id: string; name: string }[]>((res) => {
        const r = idb.transaction('subjects').objectStore('subjects').getAll();
        r.onsuccess = () => res(r.result as { id: string; name: string }[]);
      });
      const fu = subjects.find((s) => s.name === 'FernUni');
      if (!fu) throw new Error('Fach FernUni fehlt in der Fixture');
      const at = new Date().toISOString();
      const meta = { createdAt: at, updatedAt: at };
      const tx = idb.transaction(['exams', 'todos', 'lessons', 'studyBlocks'], 'readwrite');
      tx.objectStore('exams').put({
        ...meta,
        id: 'fu-exam',
        date: tomorrow,
        subjectId: fu.id,
        kind: 'klausur',
        topics: 'Modulklausur',
        progress: 10,
      });
      tx.objectStore('todos').put({
        ...meta,
        id: 'fu-todo',
        date: yesterday,
        title: 'Einsendearbeit 3 abgeben',
        subjectId: fu.id,
        due: yesterday,
        done: false,
      });
      tx.objectStore('lessons').put({
        ...meta,
        id: 'fu-lesson',
        weekday,
        period: 7,
        subjectId: fu.id,
        room: 'Online',
        week: 'AB',
      });
      tx.objectStore('studyBlocks').put({
        ...meta,
        id: 'fu-block',
        date: today,
        subjectId: fu.id,
        topic: 'Modul 31001 wiederholen',
        kind: 'lernen',
        minutes: 30,
        done: false,
      });
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      idb.close();
    },
    {
      tomorrow: berlinDate(1),
      yesterday: berlinDate(-1),
      today: berlinDate(0),
      weekday: Math.min(5, ((new Date().getDay() + 6) % 7) + 1),
    },
  );

  const visit = async (hash: string, name: string) => {
    await page.goto(hash);
    await page.getByRole('heading', { level: 1 }).first().waitFor();
    await page.waitForTimeout(250);
    await expectClean(page, name);
  };

  await visit('./#/heute', 'Heute');
  await page.getByTestId('dashboard-edit').click();
  await expect(page.getByTestId('dashboard-editor')).toBeVisible();
  await expectClean(page, 'Dashboard anpassen');
  await closeSheet(page);
  await page.getByRole('button', { name: 'Schnellerfassung' }).click();
  await expect(page.getByTestId('quick-add')).toBeVisible();
  await expectClean(page, 'Schnellerfassung');
  await closeSheet(page);

  await visit('./#/training', 'Training');

  await visit('./#/schule', 'Schule');
  for (const tab of ['Aufgaben', 'Klausuren', 'Noten', 'Abi', 'Plan', 'Lernzeit']) {
    await page.getByRole('group', { name: 'Bereich' }).getByRole('button', { name: tab }).click();
    await page.waitForTimeout(200);
    await expectClean(page, `Schule · ${tab}`);
  }
  await expect(
    page.getByRole('group', { name: 'Bereich' }).getByRole('button', { name: 'FernUni' }),
  ).toHaveCount(0);
  // Gegenprobe: Die Suche läuft über echte Inhalte (Klausuren aus der Fixture sind sichtbar)
  await page.getByRole('group', { name: 'Bereich' }).getByRole('button', { name: 'Klausuren' }).click();
  await expect(page.getByTestId('exam-list')).toContainText('Geschichte');
  expect(FORBIDDEN.test('FernUni-Frist · 140 g Protein')).toBe(true);
  await page.getByRole('group', { name: 'Bereich' }).getByRole('button', { name: 'Aufgaben' }).click();
  await page.getByRole('button', { name: 'Aufgabe', exact: true }).click();
  await expectClean(page, 'Aufgabe (Fachauswahl)');
  await closeSheet(page);
  await page.getByRole('button', { name: 'Lernen starten' }).click();
  await expectClean(page, 'Lernzeit (Fachauswahl)');
  await closeSheet(page);

  await visit('./#/koerper', 'Körper');
  await visit('./#/rueckblick', 'Rückblick · Woche');
  await page.getByRole('group', { name: 'Zeitraum' }).getByRole('button', { name: 'Monat' }).click();
  await expectClean(page, 'Rückblick · Monat');
  await visit('./#/habits', 'Habits');

  await visit('./#/einstellungen', 'Einstellungen');
  await page.getByRole('region', { name: 'Tagesziele' }).getByRole('button', { name: 'Ändern' }).click();
  await expectClean(page, 'Tagesziele');
  await closeSheet(page);
  await page.getByRole('region', { name: 'Fächer' }).getByRole('button', { name: 'Bearbeiten' }).click();
  await expectClean(page, 'Fächer');
  await closeSheet(page);
  await page.getByRole('region', { name: 'Markdown-Export' }).getByRole('button', { name: 'Öffnen' }).click();
  await expect(page.getByTestId('md-preview')).toBeVisible();
  await expectClean(page, 'Markdown Tag');
  await page.getByRole('dialog').getByRole('button', { name: 'Woche' }).click();
  await expectClean(page, 'Markdown Woche');
  await closeSheet(page);

  // Die Daten selbst sind nicht verloren: alle Datensätze liegen weiter in der Datenbank (dass ein Backup
  // sie enthält, prüft src/db/migration-v3.test.ts)
  const counts = await page.evaluate(async () => {
    const idb = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('winter');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const count = (s: string) =>
      new Promise<number>((res) => {
        const r = idb.transaction(s).objectStore(s).count();
        r.onsuccess = () => res(r.result);
      });
    const out = {
      meals: await count('meals'),
      modules: await count('modules'),
      deadlines: await count('deadlines'),
      mealTemplates: await count('mealTemplates'),
    };
    idb.close();
    return out;
  });
  const f = JSON.parse(V2) as { tables: Record<string, unknown[]> };
  expect(counts).toEqual({
    meals: f.tables.meals?.length,
    modules: f.tables.modules?.length,
    deadlines: f.tables.deadlines?.length,
    mealTemplates: f.tables.mealTemplates?.length,
  });
});

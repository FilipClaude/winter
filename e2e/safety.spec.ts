import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { shot, SLOW_WRITE } from './helpers';

const FIXTURE = readFileSync('src/test/fixtures/backup-v1.json', 'utf8');

/** v1-Schema wie von Dexie angelegt (IndexedDB-Version = Dexie-Version × 10). */
const V1 = {
  sessions: ['id', ['date', 'type', 'demo']],
  exerciseTemplates: ['id', ['&name', 'order']],
  meals: ['id', ['date', 'demo']],
  mealTemplates: ['id', ['order']],
  days: ['id', ['&date', 'demo']],
  sleep: ['id', ['date', 'demo']],
  health: ['id', ['&date', 'demo']],
  subjects: ['id', ['order']],
  studySessions: ['id', ['date', 'subjectId', 'demo']],
  todos: ['id', ['date', 'due', 'subjectId', 'demo']],
  exams: ['id', ['date', 'subjectId', 'demo']],
  modules: ['id', ['demo']],
  deadlines: ['id', ['date', 'moduleId', 'demo']],
  habits: ['id', ['order', 'demo']],
  habitChecks: ['id', ['[habitId+date]', 'date', 'habitId', 'demo']],
  kv: ['key', []],
} as const;

test('Start mit echten v1-Daten: Migration auf v2 im Browser, alles noch da, Sicherung angelegt', async ({
  page,
}) => {
  test.setTimeout(90_000);
  // Leere Seite derselben Herkunft öffnen, ohne dass die App die Datenbank anlegt.
  await page.goto('/robots.txt');
  const total = await page.evaluate(
    async ({ fixture, schema }) => {
      const backup = JSON.parse(fixture) as {
        tables: Record<string, unknown[]>;
        kv: Record<string, unknown>;
      };
      const req = indexedDB.open('winter', 10);
      req.onupgradeneeded = () => {
        const idb = req.result;
        for (const [name, [key, indexes]] of Object.entries(schema)) {
          const store = idb.createObjectStore(name, { keyPath: key });
          for (const spec of indexes) {
            const unique = spec.startsWith('&');
            const clean = spec.replace('&', '');
            const keyPath = clean.startsWith('[') ? clean.slice(1, -1).split('+') : clean;
            store.createIndex(clean, keyPath, { unique });
          }
        }
      };
      const idb = await new Promise<IDBDatabase>((res, rej) => {
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      let n = 0;
      const tx = idb.transaction(Object.keys(schema), 'readwrite');
      for (const [t, rows] of Object.entries(backup.tables)) {
        for (const row of rows) {
          tx.objectStore(t).put(row);
          n++;
        }
      }
      for (const [key, value] of Object.entries(backup.kv)) tx.objectStore('kv').put({ key, value });
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      idb.close();
      return n;
    },
    { fixture: FIXTURE, schema: V1 },
  );
  expect(total).toBeGreaterThan(300);

  await page.goto('/#/einstellungen');
  await expect(page.getByText('Winter · Schema v2')).toBeVisible();
  const card = page.getByTestId('snapshots-card');
  await expect(card).toContainText('Vor dem Update auf v2', SLOW_WRITE);
  await expect(card).toContainText(`${total} Einträge`);
  // Ziele aus v1 sind erhalten
  await expect(page.getByRole('region', { name: 'Tagesziele' })).toContainText('150 g Protein');
  // Daten sind sichtbar: Training enthält die Einheiten aus v1
  await page.goto('/#/training');
  await expect(page.getByTestId('session-row').first()).toBeVisible();
  await shot(page, '11-migration-training');
});

test('Fehlergrenze: Absturz eines Bereichs blockiert weder die App noch das Backup', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('winter:crash', 'schule'));
  await page.goto('/#/schule');
  const panel = page.getByTestId('error-boundary');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Deine Daten sind nicht betroffen');
  await shot(page, '11-fehlergrenze');
  await panel.getByRole('button', { name: 'Backup erstellen' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: 'Backup teilen' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^winter-backup-.*\.json$/);
  // Andere Bereiche funktionieren weiter
  await page.getByRole('navigation').getByRole('button', { name: 'Heute' }).click();
  await expect(page.getByTestId('ring-card')).toBeVisible();
});

test('Tägliche Sicherung entsteht automatisch und lässt sich wiederherstellen', async ({ page }) => {
  test.setTimeout(60_000);
  // Beim Start entsteht die Tages-Sicherung (Stand: 0 Gläser).
  await page.goto('/#/einstellungen');
  const card = page.getByTestId('snapshots-card');
  await expect(card.getByRole('button', { name: 'Ansehen' }).first()).toBeVisible(SLOW_WRITE);
  // Danach erfasst – am selben Tag entsteht keine zweite Sicherung.
  await page.goto('/#/heute');
  await page.getByRole('button', { name: 'Ein Glas Wasser' }).click();
  await page.getByRole('button', { name: 'Ein Glas Wasser' }).click();
  await expect(page.getByTestId('water-value')).toContainText('2');
  await page.reload();
  await page.waitForTimeout(2000);
  await page.goto('/#/einstellungen');
  await card.getByRole('button', { name: 'Ansehen' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Sicherung wiederherstellen' });
  await dialog.getByRole('button', { name: 'Ersetzen und wiederherstellen' }).click();
  await expect(page.getByText(/wiederhergestellt/)).toBeVisible(SLOW_WRITE);
  await page.goto('/#/heute');
  await expect(page.getByTestId('water-value')).toHaveText('0Gläser');
  // Der Stand vor dem Wiederherstellen ist ebenfalls gesichert
  await page.goto('/#/einstellungen');
  await expect(card).toContainText('Vor dem letzten Import');
});

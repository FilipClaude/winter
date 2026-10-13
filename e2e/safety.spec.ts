import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import { shot, SLOW_WRITE } from './helpers';

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

/** v2 = v1 + neue Tabellen und der Index `sessions.bfvId`. */
const V2 = {
  ...V1,
  sessions: ['id', ['date', 'type', 'demo', 'bfvId']],
  grades: ['id', ['date', 'subjectId', 'semester', 'demo']],
  semesterResults: ['id', ['subjectId', 'semester', 'demo']],
  studyBlocks: ['id', ['date', 'subjectId', 'examId', 'demo']],
  lessons: ['id', ['weekday', 'subjectId', 'demo']],
  goals: ['id', ['period', 'demo']],
  snapshots: ['id', ['createdAt']],
} as const;

const CASES = [
  { from: 'v1', version: 10, schema: V1, fixture: readFileSync('src/test/fixtures/backup-v1.json', 'utf8') },
  { from: 'v2', version: 20, schema: V2, fixture: readFileSync('src/test/fixtures/backup-v2.json', 'utf8') },
] as const;

for (const { from, version, schema: SCHEMA, fixture: FIXTURE } of CASES)
  test(`Start mit echten ${from}-Daten: Migration auf v3 im Browser, alles noch da, Sicherung angelegt`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // Leere Seite derselben Herkunft öffnen, ohne dass die App die Datenbank anlegt.
    await page.goto('./robots.txt');
    const total = await page.evaluate(
      async ({ fixture, schema, version }) => {
        const backup = JSON.parse(fixture) as {
          tables: Record<string, unknown[]>;
          kv: Record<string, unknown>;
        };
        const req = indexedDB.open('winter', version);
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
      { fixture: FIXTURE, schema: SCHEMA, version },
    );
    expect(total).toBeGreaterThan(300);

    await page.goto('./#/einstellungen');
    await expect(page.getByText('Winter · Schema v3')).toBeVisible();
    const card = page.getByTestId('snapshots-card');
    await expect(card).toContainText('Vor dem Update auf v3', SLOW_WRITE);
    await expect(card).toContainText(`${total} Einträge`);
    // Ziele sind erhalten (Schlafziel, in v1 und v2 gesetzt)
    await expect(page.getByRole('region', { name: 'Tagesziele' })).toContainText(/8(,0)? h Schlaf/);
    // Daten sind sichtbar: Training enthält die Einheiten
    await page.goto('./#/training');
    await expect(page.getByTestId('session-row').first()).toBeVisible();
    await shot(page, `11-migration-${from}-training`);

    // Jede v1-Tabelle hat nach der Migration exakt so viele Datensätze wie vorher, und jede ID ist da.
    const after = await page.evaluate(
      async (stores) => {
        const idb = await new Promise<IDBDatabase>((res, rej) => {
          const r = indexedDB.open('winter');
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        const out: Record<string, string[]> = {};
        const tx = idb.transaction(stores, 'readonly');
        await Promise.all(
          stores.map(
            (s) =>
              new Promise<void>((res) => {
                const r = tx.objectStore(s).getAllKeys();
                r.onsuccess = () => {
                  out[s] = (r.result as IDBValidKey[]).map(String).sort();
                  res();
                };
              }),
          ),
        );
        idb.close();
        return { out, version: idb.version };
      },
      Object.keys(SCHEMA).filter((k) => k !== 'kv' && k !== 'snapshots'),
    );
    expect(after.version).toBe(30);
    const fixture = JSON.parse(FIXTURE) as { tables: Record<string, { id: string }[]> };
    for (const [t, rows] of Object.entries(fixture.tables)) {
      expect(after.out[t], t).toEqual(rows.map((r) => r.id).sort());
    }
  });

test('Datenbank öffnet nicht: Rettungsseite statt weißem Bildschirm, Rohdaten lassen sich sichern', async ({
  page,
}) => {
  // Datenbank mit einem Eintrag anlegen, dann jedes Öffnen *mit Versionsnummer* (so öffnet Dexie)
  // scheitern lassen – stellvertretend für Speicher voll, abgebrochenes Upgrade oder eine verlorene
  // IndexedDB-Verbindung. Der Rettungs-Export öffnet ohne Versionsnummer und kommt durch.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('winter:failopen') !== '1') return;
    const open = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (this: IDBFactory, name: string, version?: number) {
      if (version !== undefined) throw new DOMException('Speicher voll (Test)', 'QuotaExceededError');
      return open.call(this, name);
    };
  });
  await page.goto('./robots.txt');
  await page.evaluate(
    () =>
      new Promise<void>((res, rej) => {
        const r = indexedDB.open('winter', 20);
        r.onupgradeneeded = () => {
          const store = r.result.createObjectStore('sessions', { keyPath: 'id' });
          store.put({ id: 's1', date: '2026-10-01', type: 'gym' });
          r.result.createObjectStore('kv', { keyPath: 'key' });
        };
        r.onsuccess = () => {
          r.result.close();
          sessionStorage.setItem('winter:failopen', '1');
          res();
        };
        r.onerror = () => rej(r.error);
      }),
  );
  await page.goto('./#/heute');
  const rescue = page.getByTestId('root-error');
  await expect(rescue).toBeVisible();
  await expect(rescue).toContainText('Deine Daten liegen weiter auf diesem Gerät');
  await shot(page, '11-rettung');
  await rescue.getByRole('button', { name: 'Rohdaten sichern' }).click();
  await expect(rescue).toContainText('1 Einträge gelesen');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    rescue.getByRole('button', { name: 'Rohdaten teilen' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^winter-rettung-.*\.json$/);
});

test('Fehlergrenze: Absturz eines Bereichs blockiert weder die App noch das Backup', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('winter:crash', 'schule'));
  await page.goto('./#/schule');
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
  // Beim Start entsteht die Tages-Sicherung (Stand: keine Stimmung).
  await page.goto('./#/einstellungen');
  const card = page.getByTestId('snapshots-card');
  await expect(card.getByRole('button', { name: 'Ansehen' }).first()).toBeVisible(SLOW_WRITE);
  // Danach erfasst – am selben Tag entsteht keine zweite Sicherung.
  await page.goto('./#/heute');
  await page.getByRole('button', { name: 'Stimmung 4' }).click();
  await expect(page.getByRole('button', { name: 'Stimmung 4' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.waitForTimeout(2000);
  await page.goto('./#/einstellungen');
  await card.getByRole('button', { name: 'Ansehen' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Sicherung wiederherstellen' });
  await dialog.getByRole('button', { name: 'Ersetzen und wiederherstellen' }).click();
  await expect(page.getByText(/wiederhergestellt/)).toBeVisible(SLOW_WRITE);
  await page.goto('./#/heute');
  await expect(page.getByRole('button', { name: 'Stimmung 4' })).toHaveAttribute('aria-pressed', 'false');
  // Der Stand vor dem Wiederherstellen ist ebenfalls gesichert
  await page.goto('./#/einstellungen');
  await expect(card).toContainText('Vor einem Import');
});

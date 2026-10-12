import Dexie from 'dexie';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBackup,
  ensureDailySnapshot,
  listSnapshots,
  previewBackup,
  previewSnapshot,
  restoreBackup,
  SNAPSHOT_KEEP,
  wipeAll,
  type BackupFile,
} from '../lib/backup';
import { DATA_TABLES, db, SCHEMA_VERSION, V1_STORES, WinterDB } from './db';
import { parseSettings, saveGrade, saveGoal } from './repo';

/** Realistische v1-Sicherung, erzeugt mit dem v1-Code (nie neu erzeugen, nie anpassen). */
const FIXTURE_TEXT = readFileSync('src/test/fixtures/backup-v1.json', 'utf8');
const fixture = (): BackupFile => JSON.parse(FIXTURE_TEXT) as BackupFile;
const V1_TABLES = Object.keys(V1_STORES).filter((t) => t !== 'kv');

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Migration v1 → v2 (echte Dexie-Datenbank)', () => {
  it('öffnet eine v1-Datenbank mit v2, ohne einen Datensatz zu verlieren, und legt einen Sicherungs-Snapshot an', async () => {
    const name = 'migration-v1';
    await Dexie.delete(name);
    const v1 = new Dexie(name);
    v1.version(1).stores(V1_STORES);
    await v1.open();
    const f = fixture();
    let total = 0;
    for (const t of V1_TABLES) {
      const rows = f.tables[t as keyof typeof f.tables] ?? [];
      await v1.table(t).bulkAdd(rows);
      total += rows.length;
    }
    for (const [key, value] of Object.entries(f.kv)) await v1.table('kv').put({ key, value });
    v1.close();
    expect(total).toBeGreaterThan(300);

    const v2 = new WinterDB(name);
    await v2.open();
    expect(v2.verno).toBe(SCHEMA_VERSION);
    for (const t of V1_TABLES) {
      const expected = (f.tables[t as keyof typeof f.tables] ?? []) as { id: string }[];
      const actual = (await v2.table(t).toArray()) as { id: string }[];
      const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
      expect(actual.sort(byId), t).toEqual([...expected].sort(byId));
    }
    // Neue Tabellen existieren und sind leer
    for (const t of ['grades', 'semesterResults', 'studyBlocks', 'lessons', 'goals']) {
      expect(await v2.table(t).count(), t).toBe(0);
    }
    // Einstellungen: v1-Werte bleiben, v2-Felder kommen dazu
    const settings = parseSettings((await v2.kv.get('settings'))?.value);
    expect(settings.goals.proteinG).toBe(150);
    expect(settings.goals.steps).toBe(9000);
    expect(settings.snowMode).toBe('subtle');
    expect(settings.onboarded).toBe(true);
    expect((await v2.kv.get('timer'))?.value).toEqual(f.kv.timer);
    // Snapshot vor der Migration enthält alles
    const snap = await v2.snapshots.get('vor-v2');
    expect(snap?.rows).toBe(total);
    expect(snap?.reason).toBe('migration');
    v2.close();
    await Dexie.delete(name);
  });

  it('frische Installation: kein Migrations-Snapshot, Standardfächer vorhanden', async () => {
    expect(await db.snapshots.count()).toBe(0);
    expect(await db.subjects.count()).toBeGreaterThan(5);
  });
});

describe('Import alter Backups', () => {
  it('v1-Backup wird vollständig geprüft und importiert, Export danach enthält dieselben Datensätze', async () => {
    const p = previewBackup(FIXTURE_TEXT);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.preview.backup.schemaVersion).toBe(2);
    await restoreBackup(p.preview.backup);
    const out = await createBackup();
    expect(out.schemaVersion).toBe(SCHEMA_VERSION);
    const f = fixture();
    for (const t of V1_TABLES) {
      const key = t as keyof typeof f.tables;
      expect(out.tables[key].length, t).toBe(f.tables[key].length);
      expect(out.tables[key], t).toEqual(expect.arrayContaining(f.tables[key]));
    }
    expect(out.kv.settings).toEqual(f.kv.settings);
  });

  it('v2-Roundtrip mit neuen Tabellen: Export → Löschen → Import → identisch', async () => {
    const p = previewBackup(FIXTURE_TEXT);
    if (!p.ok) throw new Error(p.error);
    await restoreBackup(p.preview.backup);
    const subject = (await db.subjects.toArray())[0];
    if (!subject) throw new Error('Fächer fehlen');
    await saveGrade({
      date: '2026-10-05',
      subjectId: subject.id,
      semester: '12/1',
      size: 'gross',
      type: 'klausur',
      points: 11,
      weight: 1,
      note: '',
    });
    await saveGoal({ period: 'week', metric: 'studyMin', target: 600, archived: false });
    const before = await createBackup();
    await wipeAll();
    expect(await db.grades.count()).toBe(0);
    const again = previewBackup(JSON.stringify(before));
    if (!again.ok) throw new Error(again.error);
    await restoreBackup(again.preview.backup);
    const after = await createBackup();
    for (const t of DATA_TABLES) expect(after.tables[t], t).toEqual(before.tables[t]);
    expect(after.kv).toEqual(before.kv);
  });

  it('lehnt Backups aus einer neueren App-Version ab', () => {
    const f = fixture();
    const r = previewBackup(JSON.stringify({ ...f, schemaVersion: SCHEMA_VERSION + 1 }));
    expect(r.ok).toBe(false);
  });
});

describe('Einstellungen tolerant lesen', () => {
  it('ein kaputter Wert kostet nicht die übrigen Einstellungen', () => {
    const s = parseSettings({ goals: { proteinG: 170 }, glassMl: 'kaputt', snow: false, dashboard: 'x' });
    expect(s.goals.proteinG).toBe(170);
    expect(s.goals.kcal).toBe(2900);
    expect(s.glassMl).toBe(250);
    expect(s.snowMode).toBe('off');
    expect(s.dashboard.length).toBeGreaterThan(5);
  });

  it('ohne gespeicherte Einstellungen: Onboarding offen', () => {
    expect(parseSettings(undefined).onboarded).toBe(false);
  });
});

describe('Automatische Snapshots', () => {
  it('höchstens einer pro Tag, die letzten 7 bleiben, der Migrations-Snapshot bleibt unberührt', async () => {
    await db.snapshots.put({
      id: 'vor-v2',
      createdAt: '2026-10-01T08:00:00.000Z',
      schemaVersion: 1,
      reason: 'migration',
      rows: 1,
      data: fixture(),
    });
    for (let d = 1; d <= 10; d++) {
      const day = new Date(Date.UTC(2026, 9, d, 10));
      expect(await ensureDailySnapshot(day)).toBe(true);
      expect(await ensureDailySnapshot(day)).toBe(false);
    }
    const list = await listSnapshots();
    expect(list.filter((s) => s.reason === 'daily').map((s) => s.id)).toEqual([
      '2026-10-10',
      '2026-10-09',
      '2026-10-08',
      '2026-10-07',
      '2026-10-06',
      '2026-10-05',
      '2026-10-04',
    ]);
    expect(list.filter((s) => s.reason === 'daily')).toHaveLength(SNAPSHOT_KEEP);
    expect(list.some((s) => s.id === 'vor-v2')).toBe(true);
    const p = await previewSnapshot('vor-v2');
    expect(p.ok).toBe(true);
  });

  it('Snapshots überleben „Alles löschen“ und stellen den Stand wieder her', async () => {
    const p = previewBackup(FIXTURE_TEXT);
    if (!p.ok) throw new Error(p.error);
    await restoreBackup(p.preview.backup);
    await ensureDailySnapshot(new Date('2026-10-12T10:00:00Z'));
    const lastBackupAt = (await db.kv.get('lastBackupAt'))?.value;
    await wipeAll();
    expect(await db.sessions.count()).toBe(0);
    const s = await previewSnapshot('2026-10-12');
    if (!s.ok) throw new Error(s.error);
    await restoreBackup(s.preview.backup, { countsAsBackup: false });
    expect(await db.sessions.count()).toBe(fixture().tables.sessions.length);
    // Interner Snapshot zählt nicht als externe Sicherung
    expect((await db.kv.get('lastBackupAt'))?.value).toBeUndefined();
    expect(lastBackupAt).toBeDefined();
  });
});

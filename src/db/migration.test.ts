import Dexie from 'dexie';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBackup,
  deleteSnapshot,
  ensureDailySnapshot,
  ensureMigrationSnapshot,
  listSnapshots,
  saveSafetySnapshot,
  SAFETY_KEEP,
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
    // Das Upgrade selbst schreibt nichts (ein Fehler dort würde die App bei jedem Start blockieren),
    // es merkt sich nur die Migration für den Snapshot danach.
    expect(v2.migratedFromV1).toBe(true);
    expect(await v2.snapshots.count()).toBe(0);
    v2.close();
    await Dexie.delete(name);
  });

  it('nach der Migration: Sicherung „vor-v2“ mit allen Datensätzen, genau einmal', async () => {
    const p = previewBackup(FIXTURE_TEXT);
    if (!p.ok) throw new Error(p.error);
    await restoreBackup(p.preview.backup);
    db.migratedFromV1 = true;
    expect(await ensureMigrationSnapshot(new Date('2026-10-12T19:00:00Z'))).toBe(true);
    expect(await ensureMigrationSnapshot(new Date('2026-10-12T19:05:00Z'))).toBe(false);
    const meta = (await listSnapshots()).find((s) => s.id === 'vor-v2');
    expect(meta?.reason).toBe('migration');
    expect(meta?.rows).toBe(p.preview.total);
  });

  it('frische Installation: kein Migrations-Snapshot, Standardfächer vorhanden', async () => {
    expect(db.migratedFromV1).toBe(false);
    expect(await ensureMigrationSnapshot()).toBe(false);
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

  it('ein kaputtes Unterfeld kostet nur dieses Feld (Review-Fund)', () => {
    const s = parseSettings({ goals: { proteinG: 170, kcal: -5, steps: 12000 } });
    expect(s.goals.proteinG).toBe(170);
    expect(s.goals.steps).toBe(12000);
    expect(s.goals.kcal).toBe(2900);
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
    // Interner Snapshot zählt nicht als externe Sicherung und belebt keinen alten Lern-Timer
    expect((await db.kv.get('lastBackupAt'))?.value).toBeUndefined();
    expect(lastBackupAt).toBeDefined();
    expect(await db.kv.get('timer')).toBeUndefined();
    expect(fixture().kv.timer).toBeDefined();
  });

  it('„Alles löschen“ mit Sicherungen entfernt auch alle Kopien (Weitergabe des Geräts)', async () => {
    await ensureDailySnapshot(new Date('2026-10-12T10:00:00Z'));
    expect(await db.snapshots.count()).toBe(1);
    await wipeAll({ withSnapshots: true });
    expect(await db.snapshots.count()).toBe(0);
    expect(await listSnapshots()).toEqual([]);
  });

  it('vor Importen bleiben die letzten 3 Sicherungen, ältere verschwinden', async () => {
    for (let i = 0; i < 5; i++) await saveSafetySnapshot(new Date(Date.UTC(2026, 9, 12, 10, i)));
    const manual = (await listSnapshots()).filter((s) => s.reason === 'manual');
    expect(manual).toHaveLength(SAFETY_KEEP);
    expect(manual[0]?.createdAt).toBe('2026-10-12T10:04:00.000Z');
    expect(await db.snapshots.count()).toBe(SAFETY_KEEP);
  });

  it('„vor-v2“ wird nach 30 Tagen beim nächsten Snapshot entfernt', async () => {
    db.migratedFromV1 = true;
    await ensureMigrationSnapshot(new Date('2026-10-12T10:00:00Z'));
    await ensureDailySnapshot(new Date('2026-11-05T10:00:00Z'));
    expect((await listSnapshots()).some((s) => s.id === 'vor-v2')).toBe(true);
    await ensureDailySnapshot(new Date('2026-11-12T10:00:00Z'));
    expect((await listSnapshots()).some((s) => s.id === 'vor-v2')).toBe(false);
    expect(await db.snapshots.get('vor-v2')).toBeUndefined();
  });

  it('kein Snapshot bei knappem Speicher (> 50 % belegt)', async () => {
    const orig = Object.getOwnPropertyDescriptor(navigator, 'storage');
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: () => Promise.resolve({ usage: 90, quota: 100 }) },
    });
    try {
      expect(await ensureDailySnapshot(new Date('2026-10-12T10:00:00Z'))).toBe(false);
      expect(await db.snapshots.count()).toBe(0);
    } finally {
      if (orig) Object.defineProperty(navigator, 'storage', orig);
      else Reflect.deleteProperty(navigator, 'storage');
    }
  });

  it('Snapshots aus der Vorversion ohne Index: Liste baut ihn auf, ohne in der Abfrage zu schreiben', async () => {
    await db.snapshots.put({
      id: '2026-10-11',
      createdAt: '2026-10-11T10:00:00.000Z',
      schemaVersion: 2,
      reason: 'daily',
      rows: 5,
      data: fixture(),
    });
    // Lesen in einer reinen Lesetransaktion (wie useLiveQuery) darf nicht scheitern
    const list = await db.transaction('r', db.snapshots, db.kv, () => listSnapshots());
    expect(list.map((s) => s.id)).toEqual(['2026-10-11']);
    await deleteSnapshot('2026-10-11');
    expect(await db.snapshots.count()).toBe(0);
    expect(await listSnapshots()).toEqual([]);
  });
});

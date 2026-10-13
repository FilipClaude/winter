import Dexie from 'dexie';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createBackup,
  ensureMigrationSnapshot,
  listSnapshots,
  MIGRATION_SNAPSHOT_ID,
  previewBackup,
  previewSnapshot,
  restoreBackup,
  wipeAll,
  type BackupFile,
} from '../lib/backup';
import { normalizeDashboard } from '../lib/calc/dashboard-layout';
import { DATA_TABLES, db, SCHEMA_VERSION, V1_STORES, V2_STORES, WinterDB } from './db';
import { archiveRetiredGoals, parseSettings } from './repo';
import { DEFAULT_DASHBOARD, V2_DEFAULT_DASHBOARD } from './schemas';

/**
 * Realistische v2-Sicherung mit echten Daten (ohne Demo-Markierung), erzeugt mit dem v2-Code vor der
 * Schemaänderung v3: Mahlzeiten, Vorlagen, Wasser, FernUni-Fach mit Lernzeit, zwei Module mit
 * Prüfungsregel, Fristen mit EA-Punkten, Ziele mit `avgProtein`, eigenes Dashboard mit Ernährung und
 * „Nächste Termine“. Nie neu erzeugen, nie anpassen.
 */
const V2_TEXT = readFileSync('src/test/fixtures/backup-v2.json', 'utf8');
const V1_TEXT = readFileSync('src/test/fixtures/backup-v1.json', 'utf8');
const v2 = (): BackupFile => JSON.parse(V2_TEXT) as BackupFile;
const V2_TABLES = Object.keys({ ...V1_STORES, ...V2_STORES }).filter((t) => t !== 'kv' && t !== 'snapshots');
const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Fixture v2', () => {
  it('enthält alle Datenarten, die v3 ausblendet', () => {
    const f = v2();
    expect(f.schemaVersion).toBe(2);
    expect(f.tables.meals.length).toBeGreaterThan(50);
    expect(f.tables.mealTemplates.length).toBeGreaterThanOrEqual(3);
    expect(f.tables.modules.length).toBe(2);
    expect(f.tables.deadlines.length).toBeGreaterThanOrEqual(5);
    expect((f.tables.days as { water: number }[]).some((d) => d.water > 0)).toBe(true);
    expect((f.tables.goals as { metric: string }[]).some((g) => g.metric === 'avgProtein')).toBe(true);
    const fu = (f.tables.subjects as { id: string; name: string }[]).find((s) => s.name === 'FernUni');
    expect((f.tables.studySessions as { subjectId: string }[]).some((s) => s.subjectId === fu?.id)).toBe(
      true,
    );
    expect(
      Object.values(f.tables)
        .flat()
        .some((r) => (r as { demo?: number }).demo === 1),
    ).toBe(false);
  });
});

describe('Migration v2 → v3 (echte Dexie-Datenbank)', () => {
  it('öffnet eine v2-Datenbank mit v3: jeder Datensatz identisch, neue Tabellen leer, Einstellungen erhalten', async () => {
    const name = 'migration-v2';
    await Dexie.delete(name);
    const old = new Dexie(name);
    old.version(1).stores(V1_STORES);
    old.version(2).stores(V2_STORES);
    await old.open();
    const f = v2();
    let total = 0;
    for (const t of V2_TABLES) {
      const rows = f.tables[t as keyof typeof f.tables] ?? [];
      await old.table(t).bulkAdd(rows);
      total += rows.length;
    }
    for (const [key, value] of Object.entries(f.kv)) await old.table('kv').put({ key, value });
    old.close();
    expect(total).toBeGreaterThan(300);

    const next = new WinterDB(name);
    await next.open();
    expect(next.verno).toBe(SCHEMA_VERSION);
    expect(next.migratedFrom).toBe(2);
    for (const t of V2_TABLES) {
      const expected = (f.tables[t as keyof typeof f.tables] ?? []) as { id: string }[];
      const actual = (await next.table(t).toArray()) as { id: string }[];
      expect(actual.sort(byId), t).toEqual([...expected].sort(byId));
    }
    expect(await next.table('earnings').count()).toBe(0);
    expect(await next.table('mockExams').count()).toBe(0);
    // Das Upgrade schreibt nichts (DECISIONS #25), auch keine Sicherung
    expect(await next.snapshots.count()).toBe(0);
    // Einstellungen: v2-Werte (auch Protein/Wasser) bleiben, v3-Felder kommen mit Standardwert dazu
    const raw = (await next.kv.get('settings'))?.value;
    expect(raw).toEqual(f.kv.settings);
    const s = parseSettings(raw);
    expect(s.goals.proteinG).toBe(155);
    expect(s.glassMl).toBe(300);
    expect(s.ring).toEqual({
      habits: true,
      protein: true,
      water: false,
      study: true,
      sleep: true,
      training: true,
      earnings: true,
    });
    expect(s.earnings.weeklyGoalCents).toBe(0);
    expect(s.npScale).toHaveLength(15);
    next.close();
    await Dexie.delete(name);
  });

  it('Sicherung „vor-v3“ mit allen Datensätzen, danach Protein-Ziel archiviert statt gelöscht', async () => {
    const p = previewBackup(V2_TEXT);
    if (!p.ok) throw new Error(p.error);
    await restoreBackup(p.preview.backup);
    db.migratedFrom = 2;
    expect(await ensureMigrationSnapshot(new Date('2026-10-13T20:00:00Z'))).toBe(true);
    const meta = (await listSnapshots()).find((m) => m.id === MIGRATION_SNAPSHOT_ID);
    expect(meta?.rows).toBe(p.preview.total);
    expect(await archiveRetiredGoals()).toBe(1);
    expect(await archiveRetiredGoals()).toBe(0);
    const goals = await db.goals.toArray();
    expect(goals).toHaveLength(3);
    expect(goals.find((g) => g.metric === 'avgProtein')?.archived).toBe(true);
    expect(goals.filter((g) => g.archived)).toHaveLength(1);
    // Die Sicherung zeigt den Stand vor dem Archivieren
    const snap = await previewSnapshot(MIGRATION_SNAPSHOT_ID);
    if (!snap.ok) throw new Error(snap.error);
    const g = (snap.preview.backup.tables.goals as { metric: string; archived: boolean }[]).find(
      (x) => x.metric === 'avgProtein',
    );
    expect(g?.archived).toBe(false);
  });
});

describe('Backups nach v3', () => {
  it('v2-Backup importieren: alles da; Export danach enthält Mahlzeiten, Wasser, Module und Fristen unverändert', async () => {
    const p = previewBackup(V2_TEXT);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.preview.backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.preview.backup.tables.earnings).toEqual([]);
    expect(p.preview.backup.tables.mockExams).toEqual([]);
    await restoreBackup(p.preview.backup);
    const out = await createBackup();
    expect(out.schemaVersion).toBe(3);
    const f = v2();
    for (const t of V2_TABLES) {
      const key = t as keyof typeof f.tables;
      expect([...(out.tables[key] as { id: string }[])].sort(byId), t).toEqual(
        [...(f.tables[key] as { id: string }[])].sort(byId),
      );
    }
    expect(out.kv.settings).toEqual(f.kv.settings);
    expect(out.tables.meals.length).toBe(f.tables.meals.length);
    expect(out.tables.modules).toEqual(expect.arrayContaining(f.tables.modules));
  });

  it('v3-Roundtrip mit neuen Tabellen: Export → Löschen → Import → identisch', async () => {
    const p = previewBackup(V2_TEXT);
    if (!p.ok) throw new Error(p.error);
    await restoreBackup(p.preview.backup);
    const exam = (await db.exams.toArray())[0];
    if (!exam) throw new Error('Klausur fehlt');
    const at = '2026-10-13T18:00:00.000Z';
    await db.earnings.bulkAdd([
      { id: 'e1', createdAt: at, updatedAt: at, date: '2026-10-12', amountCents: 1250, note: 'Nachhilfe' },
      { id: 'e2', createdAt: at, updatedAt: at, date: '2026-10-13', amountCents: 3500 },
    ]);
    await db.mockExams.add({
      id: 'm1',
      createdAt: at,
      updatedAt: at,
      date: '2026-10-11',
      examId: exam.id,
      subjectId: exam.subjectId,
      points: 15.5,
      maxPoints: 22,
      durationMin: 45,
    });
    const gym = await db.sessions.where('type').equals('gym').first();
    if (!gym) throw new Error('Gym-Einheit fehlt');
    await db.sessions.put({ ...gym, split: 'push' });
    const before = await createBackup();
    await wipeAll();
    expect(await db.earnings.count()).toBe(0);
    const again = previewBackup(JSON.stringify(before));
    if (!again.ok) throw new Error(again.error);
    await restoreBackup(again.preview.backup);
    const after = await createBackup();
    for (const t of DATA_TABLES) expect(after.tables[t], t).toEqual(before.tables[t]);
    expect(after.kv).toEqual(before.kv);
  });

  it('v1-Backups bleiben importierbar', async () => {
    const p = previewBackup(V1_TEXT);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.preview.backup.schemaVersion).toBe(3);
    await restoreBackup(p.preview.backup);
    expect(await db.meals.count()).toBeGreaterThan(0);
  });

  it('ungültige Beträge und Probe-Ergebnisse werden beim Import abgelehnt', () => {
    const f = v2();
    const at = '2026-10-13T18:00:00.000Z';
    const bad = (tables: Partial<BackupFile['tables']>) =>
      previewBackup(JSON.stringify({ ...f, schemaVersion: 3, tables: { ...f.tables, ...tables } }));
    expect(
      bad({ earnings: [{ id: 'x', createdAt: at, updatedAt: at, date: '2026-10-13', amountCents: 12.5 }] })
        .ok,
    ).toBe(false);
    expect(
      bad({ earnings: [{ id: 'x', createdAt: at, updatedAt: at, date: '2026-10-13', amountCents: 0 }] }).ok,
    ).toBe(false);
    expect(
      bad({
        mockExams: [
          {
            id: 'x',
            createdAt: at,
            updatedAt: at,
            date: '2026-10-13',
            examId: 'a',
            subjectId: 'b',
            points: 23,
            maxPoints: 22,
          },
        ],
      }).ok,
    ).toBe(false);
  });
});

describe('Dashboard-Anordnung nach v3', () => {
  it('unveränderter v2-Standard → neuer Standard', () => {
    expect(normalizeDashboard(V2_DEFAULT_DASHBOARD)).toEqual(DEFAULT_DASHBOARD);
    expect(normalizeDashboard([])).toEqual(DEFAULT_DASHBOARD);
  });

  it('eigenes Layout: Ernährung und Termine fallen weg, Nächste Klausur direkt nach dem Briefing, Rest bleibt', () => {
    const s = parseSettings(v2().kv.settings);
    // Gespeicherte Anordnung bleibt trotz entfallener IDs gültig (sonst ginge das eigene Layout verloren)
    expect(s.dashboard.some((w) => w.id === 'nutrition')).toBe(true);
    const out = normalizeDashboard(s.dashboard);
    expect(out.map((w) => w.id)).toEqual([
      'briefing',
      'nextExam',
      'ring',
      'alerts',
      'training',
      'studyToday',
      'habits',
      'abi',
      'steps',
      'sleep',
      'nextMatch',
      'earnings',
      'goals',
      'mood',
      'journal',
    ]);
    expect(out.find((w) => w.id === 'ring')?.size).toBe('s');
    expect(out.find((w) => w.id === 'abi')?.hidden).toBe(true);
  });
});

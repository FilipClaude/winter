import { z } from 'zod';
import { BACKUP_KV_KEYS, DATA_TABLES, db, SCHEMA_VERSION, type DataTable } from '../db/db';
import {
  zDay,
  zDeadline,
  zEarning,
  zExam,
  zExerciseTemplate,
  zGoal,
  zGrade,
  zHabit,
  zHabitCheck,
  zHealthDay,
  zLesson,
  zMeal,
  zMealTemplate,
  zMockExam,
  zModule,
  zSemesterResult,
  zSession,
  zSleep,
  zStudyBlock,
  zStudySession,
  zSubject,
  zTodo,
  type Snapshot,
} from '../db/schemas';
import { buildDefaults } from '../db/seed';
import { nowISO, todayISO } from './date';

export const BACKUP_FORMAT = 1;

const TABLE_SCHEMAS: Record<DataTable, z.ZodType> = {
  grades: zGrade,
  semesterResults: zSemesterResult,
  studyBlocks: zStudyBlock,
  lessons: zLesson,
  goals: zGoal,
  earnings: zEarning,
  mockExams: zMockExam,
  sessions: zSession,
  exerciseTemplates: zExerciseTemplate,
  meals: zMeal,
  mealTemplates: zMealTemplate,
  days: zDay,
  sleep: zSleep,
  health: zHealthDay,
  subjects: zSubject,
  studySessions: zStudySession,
  todos: zTodo,
  exams: zExam,
  modules: zModule,
  deadlines: zDeadline,
  habits: zHabit,
  habitChecks: zHabitCheck,
};

export const TABLE_LABEL: Record<DataTable, string> = {
  sessions: 'Trainingseinheiten',
  exerciseTemplates: 'Übungsvorlagen',
  meals: 'Mahlzeiten',
  mealTemplates: 'Mahlzeiten-Vorlagen',
  days: 'Tageswerte',
  sleep: 'Schlafeinträge',
  health: 'Health-Tage',
  subjects: 'Fächer',
  studySessions: 'Lerneinheiten',
  todos: 'Aufgaben',
  exams: 'Klausuren',
  modules: 'Module',
  deadlines: 'Fristen',
  habits: 'Habits',
  habitChecks: 'Habit-Häkchen',
  grades: 'Noten',
  semesterResults: 'Halbjahresleistungen',
  studyBlocks: 'Lerneinheiten (Plan)',
  lessons: 'Stundenplan',
  goals: 'Ziele',
  earnings: 'Verdienst',
  mockExams: 'Probe-Klausuren',
};

/**
 * Tabellen, die die Oberfläche seit v3 nicht mehr zeigt (Ernährung, FernUni). Sie bleiben vollständig in
 * Datenbank, Backup, Rettungs-Export und Snapshots; die Import-Vorschau nennt sie nur als Summe.
 */
export const RETIRED_TABLES: readonly DataTable[] = ['meals', 'mealTemplates', 'modules', 'deadlines'];

/** kv-Schlüssel, die ins Backup gehören (Zeitstempel des Backups selbst nicht). */
const KV_KEYS = BACKUP_KV_KEYS;

export interface BackupFile {
  app: 'winter';
  format: number;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<DataTable, unknown[]>;
  kv: Record<string, unknown>;
}

const zEnvelope = z.object({
  app: z.literal('winter', { error: 'Das ist keine Winter-Sicherung (Feld "app" fehlt).' }),
  format: z.number().int(),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.unknown())),
  kv: z.record(z.string(), z.unknown()).optional(),
});

export async function createBackup(): Promise<BackupFile> {
  const tables = {} as Record<DataTable, unknown[]>;
  await db.transaction('r', [...DATA_TABLES.map((t) => db.table(t)), db.kv], async () => {
    for (const t of DATA_TABLES) tables[t] = await db.table(t).toArray();
  });
  const kv: Record<string, unknown> = {};
  for (const key of KV_KEYS) {
    const row = await db.kv.get(key);
    if (row) kv[key] = row.value;
  }
  return {
    app: 'winter',
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    tables,
    kv,
  };
}

export function backupFileName(exportedAt: string): string {
  return `winter-backup-${exportedAt.slice(0, 16).replace(/[:T]/g, '-')}.json`;
}

/**
 * Hebt ältere Backups auf das aktuelle Schema. Jede Schemaversion bekommt hier einen Schritt,
 * z. B. `if (b.schemaVersion < 2) { …; b.schemaVersion = 2; }`.
 */
export function migrateBackup(b: BackupFile): BackupFile {
  if (b.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Die Sicherung stammt aus einer neueren App-Version (Schema ${b.schemaVersion}). Bitte erst die App aktualisieren.`,
    );
  }
  const out: BackupFile = { ...b, tables: { ...b.tables }, kv: { ...b.kv } };
  if (out.schemaVersion < 2) {
    // v1 → v2: nur neue Tabellen (leer). Bestehende Datensätze bleiben unverändert gültig,
    // neue Felder sind optional; Einstellungen werden beim Lesen ergänzt (parseSettings).
    for (const t of DATA_TABLES) out.tables[t] ??= [];
    out.schemaVersion = 2;
  }
  if (out.schemaVersion < 3) {
    // v2 → v3: nur neue Tabellen (Verdienst, Probe-Klausuren). Mahlzeiten, Wasser und FernUni bleiben
    // unverändert erhalten, auch wenn die Oberfläche sie nicht mehr zeigt.
    for (const t of DATA_TABLES) out.tables[t] ??= [];
    out.schemaVersion = 3;
  }
  return out;
}

export interface BackupPreview {
  backup: BackupFile;
  counts: { table: DataTable; label: string; count: number }[];
  total: number;
  demo: number;
}

export type PreviewResult = { ok: true; preview: BackupPreview } | { ok: false; error: string };

/** Prüft eine Sicherung vollständig (jeder Datensatz gegen sein Zod-Schema), ohne etwas zu schreiben. */
export function previewBackup(text: string): PreviewResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Die Datei ist kein gültiges JSON.' };
  }
  const env = zEnvelope.safeParse(raw);
  if (!env.success) {
    const issue = env.error.issues[0];
    return {
      ok: false,
      error: issue?.message.startsWith('Das ist keine')
        ? issue.message
        : `Ungültige Sicherung: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim(),
    };
  }
  let backup: BackupFile;
  try {
    backup = migrateBackup({
      ...env.data,
      kv: env.data.kv ?? {},
      tables: env.data.tables as Record<DataTable, unknown[]>,
      app: 'winter',
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const counts: BackupPreview['counts'] = [];
  let demo = 0;
  for (const t of DATA_TABLES) {
    const rows = backup.tables[t] ?? [];
    for (const [i, row] of rows.entries()) {
      const r = TABLE_SCHEMAS[t].safeParse(row);
      if (!r.success) {
        const issue = r.error.issues[0];
        return {
          ok: false,
          error: `${TABLE_LABEL[t]}, Eintrag ${i + 1}: ${issue?.path.join('.') ?? ''} – ${issue?.message ?? 'ungültig'}`,
        };
      }
      if ((row as { demo?: number }).demo === 1) demo++;
    }
    backup.tables[t] = rows;
    counts.push({ table: t, label: TABLE_LABEL[t], count: rows.length });
  }
  return { ok: true, preview: { backup, counts, total: counts.reduce((a, c) => a + c.count, 0), demo } };
}

/** Ersetzt alle Daten durch die Sicherung (eine Transaktion: alles oder nichts). */
export async function restoreBackup(
  backup: BackupFile,
  { countsAsBackup = true }: { countsAsBackup?: boolean } = {},
): Promise<number> {
  let n = 0;
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.kv], async () => {
    for (const t of DATA_TABLES) {
      await db.table(t).clear();
      const rows = backup.tables[t] ?? [];
      if (rows.length > 0) await db.table(t).bulkPut(rows);
      n += rows.length;
    }
    for (const key of KV_KEYS) await db.kv.delete(key);
    for (const [key, value] of Object.entries(backup.kv)) {
      // Interne Snapshots: keinen alten Lern-Timer wiederbeleben – sonst würde beim Stoppen die ganze
      // Zeit seit dem Snapshot als Lernzeit gebucht.
      if (!countsAsBackup && key === 'timer') continue;
      if (KV_KEYS.includes(key)) await db.kv.put({ key, value });
    }
    // Der wiederhergestellte Stand ist durch genau diese Sicherung gedeckt (nicht bei internen Snapshots).
    if (countsAsBackup && !Number.isNaN(new Date(backup.exportedAt).getTime()))
      await db.kv.put({ key: 'lastBackupAt', value: backup.exportedAt });
  });
  return n;
}

/**
 * Löscht alle Daten (inkl. Einstellungen) und legt Standardfächer/-vorlagen neu an.
 * Interne Sicherungen bleiben, außer `withSnapshots` (z. B. vor Weitergabe des Geräts).
 */
export async function wipeAll({ withSnapshots = false }: { withSnapshots?: boolean } = {}): Promise<void> {
  const d = buildDefaults();
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.kv, db.snapshots], async () => {
    for (const t of DATA_TABLES) await db.table(t).clear();
    const index = withSnapshots ? undefined : (await db.kv.get(INDEX_KEY))?.value;
    await db.kv.clear();
    if (withSnapshots) await db.snapshots.clear();
    else if (index !== undefined) await db.kv.put({ key: INDEX_KEY, value: index });
    await db.subjects.bulkAdd(d.subjects);
    await db.exerciseTemplates.bulkAdd(d.exerciseTemplates);
  });
}

export async function markBackupDone(): Promise<void> {
  await db.kv.put({ key: 'lastBackupAt', value: nowISO() });
}

// ---------- Automatische Snapshots ----------

export const SNAPSHOT_KEEP = 7;
export const SAFETY_KEEP = 3;
export const MIGRATION_KEEP_DAYS = 30;
/** Ab diesem Anteil belegten Speichers entstehen keine neuen Snapshots (Schutz vor vollem Speicher). */
export const SNAPSHOT_MAX_USAGE = 0.5;

export type SnapshotMeta = Omit<Snapshot, 'data'>;
/** Metadaten aller Snapshots in kv – damit Liste und Aufräumen nie alle Datenkopien laden. */
const INDEX_KEY = 'snapshotIndex';

const zMetaList = z.array(
  z.object({
    id: z.string(),
    createdAt: z.string(),
    schemaVersion: z.number(),
    reason: z.enum(['daily', 'migration', 'manual']),
    rows: z.number(),
  }),
);

/**
 * Index lesen. Fehlt er (Snapshots aus einer früheren Version), wird er Zeile für Zeile neu aufgebaut
 * und – nur in Schreibtransaktionen (`persist`) – gespeichert. In Live-Abfragen sind Schreibzugriffe verboten.
 */
async function readIndex(persist = true): Promise<SnapshotMeta[]> {
  const raw = (await db.kv.get(INDEX_KEY))?.value;
  const r = zMetaList.safeParse(raw);
  if (r.success) return r.data;
  const rebuilt: SnapshotMeta[] = [];
  await db.snapshots.each(({ data: _data, ...meta }) => {
    rebuilt.push(meta);
  });
  if (persist) await db.kv.put({ key: INDEX_KEY, value: rebuilt });
  return rebuilt;
}

/** Lohnt sich ein weiterer Snapshot? Nein, wenn der Speicher schon zu mehr als der Hälfte voll ist. */
async function storageAllowsSnapshot(): Promise<boolean> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est?.quota || est.usage === undefined) return true;
    return est.usage / est.quota < SNAPSHOT_MAX_USAGE;
  } catch {
    return true;
  }
}

/** Schreibt einen Snapshot und räumt nach den Aufbewahrungsregeln auf (eine Transaktion). */
async function writeSnapshot(meta: SnapshotMeta, data: BackupFile, now: Date): Promise<void> {
  await db.transaction('rw', db.snapshots, db.kv, async () => {
    const index = (await readIndex()).filter((m) => m.id !== meta.id);
    index.push(meta);
    const byNewest = (a: SnapshotMeta, b: SnapshotMeta) => b.createdAt.localeCompare(a.createdAt);
    const drop = [
      ...index
        .filter((m) => m.reason === 'daily')
        .sort(byNewest)
        .slice(SNAPSHOT_KEEP),
      ...index
        .filter((m) => m.reason === 'manual')
        .sort(byNewest)
        .slice(SAFETY_KEEP),
      ...index.filter(
        (m) =>
          m.reason === 'migration' &&
          now.getTime() - new Date(m.createdAt).getTime() > MIGRATION_KEEP_DAYS * 86_400_000,
      ),
    ].map((m) => m.id);
    await db.snapshots.put({ ...meta, data } satisfies Snapshot);
    await db.snapshots.bulkDelete(drop);
    await db.kv.put({ key: INDEX_KEY, value: index.filter((m) => !drop.includes(m.id)) });
  });
}

async function snapshotOf(reason: Snapshot['reason'], id: string, now: Date) {
  const backup = await createBackup();
  const rows = DATA_TABLES.reduce((a, t) => a + (backup.tables[t]?.length ?? 0), 0);
  return { backup, meta: { id, createdAt: now.toISOString(), schemaVersion: SCHEMA_VERSION, reason, rows } };
}

/**
 * Legt höchstens einmal pro Kalendertag einen Snapshot aller Daten an und behält die letzten
 * `SNAPSHOT_KEEP`. Übersprungen bei leerer Datenbank oder knappem Speicher.
 * Gibt true zurück, wenn ein neuer Snapshot entstanden ist.
 */
export async function ensureDailySnapshot(now: Date = new Date()): Promise<boolean> {
  const id = todayISO(now);
  if ((await readIndex(false)).some((m) => m.id === id)) return false;
  if (!(await storageAllowsSnapshot())) return false;
  const { backup, meta } = await snapshotOf('daily', id, now);
  if (meta.rows === 0) return false;
  await writeSnapshot(meta, backup, now);
  return true;
}

/** Kennung der Sicherung vor dem Update auf die aktuelle Schemaversion. */
export const MIGRATION_SNAPSHOT_ID = `vor-v${SCHEMA_VERSION}`;

/**
 * Nach einem Schema-Update (v1/v2 → v3): Sicherung „vor-v3“. Die Migrationen sind rein additiv, der
 * Inhalt entspricht also dem alten Stand. Läuft nach dem Öffnen in einer normalen Transaktion – ein
 * Fehler hier blockiert die App nicht. Wird nach 30 Tagen automatisch entfernt.
 */
export async function ensureMigrationSnapshot(now: Date = new Date()): Promise<boolean> {
  if (db.migratedFrom === null) return false;
  db.migratedFrom = null;
  if ((await readIndex(false)).some((m) => m.id === MIGRATION_SNAPSHOT_ID)) return false;
  const { backup, meta } = await snapshotOf('migration', MIGRATION_SNAPSHOT_ID, now);
  if (meta.rows === 0) return false;
  await writeSnapshot(meta, backup, now);
  return true;
}

/** Sichert den aktuellen Stand unmittelbar vor einem Import/einer Wiederherstellung (die letzten 3 bleiben). */
export async function saveSafetySnapshot(now: Date = new Date()): Promise<void> {
  const { backup, meta } = await snapshotOf('manual', `vor-import-${now.toISOString()}`, now);
  if (meta.rows === 0) return;
  await writeSnapshot(meta, backup, now);
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  return [...(await readIndex(false))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function deleteSnapshot(id: string): Promise<void> {
  await db.transaction('rw', db.snapshots, db.kv, async () => {
    await db.snapshots.delete(id);
    await db.kv.put({ key: INDEX_KEY, value: (await readIndex()).filter((m) => m.id !== id) });
  });
}

export async function deleteAllSnapshots(): Promise<void> {
  await db.transaction('rw', db.snapshots, db.kv, async () => {
    await db.snapshots.clear();
    await db.kv.delete(INDEX_KEY);
  });
}

/** Prüft einen Snapshot wie eine importierte Datei (inkl. Migration) und gibt die Vorschau zurück. */
export async function previewSnapshot(id: string): Promise<PreviewResult> {
  const s = await db.snapshots.get(id);
  if (!s) return { ok: false, error: 'Sicherung nicht gefunden.' };
  return previewBackup(JSON.stringify(s.data));
}

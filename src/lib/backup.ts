import { z } from 'zod';
import { DATA_TABLES, db, SCHEMA_VERSION, type DataTable } from '../db/db';
import {
  zDay,
  zDeadline,
  zExam,
  zExerciseTemplate,
  zHabit,
  zHabitCheck,
  zHealthDay,
  zMeal,
  zMealTemplate,
  zModule,
  zSession,
  zSleep,
  zStudySession,
  zSubject,
  zTodo,
} from '../db/schemas';
import { buildDefaults } from '../db/seed';
import { nowISO } from './date';

export const BACKUP_FORMAT = 1;

const TABLE_SCHEMAS: Record<DataTable, z.ZodType> = {
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
  modules: 'FernUni-Module',
  deadlines: 'Fristen',
  habits: 'Habits',
  habitChecks: 'Habit-Häkchen',
};

/** kv-Schlüssel, die ins Backup gehören (Zeitstempel des Backups selbst nicht). */
const KV_KEYS = ['settings', 'timer', 'lastHealthImport', 'demoActive'] as const;

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
  return b;
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
export async function restoreBackup(backup: BackupFile): Promise<number> {
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
      if ((KV_KEYS as readonly string[]).includes(key)) await db.kv.put({ key, value });
    }
    // Der wiederhergestellte Stand ist durch genau diese Sicherung gedeckt.
    if (!Number.isNaN(new Date(backup.exportedAt).getTime()))
      await db.kv.put({ key: 'lastBackupAt', value: backup.exportedAt });
  });
  return n;
}

/** Löscht alle Daten (inkl. Einstellungen) und legt Standardfächer/-vorlagen neu an. */
export async function wipeAll(): Promise<void> {
  const d = buildDefaults();
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.kv], async () => {
    for (const t of DATA_TABLES) await db.table(t).clear();
    await db.kv.clear();
    await db.subjects.bulkAdd(d.subjects);
    await db.exerciseTemplates.bulkAdd(d.exerciseTemplates);
    await db.mealTemplates.bulkAdd(d.mealTemplates);
  });
}

export async function markBackupDone(): Promise<void> {
  await db.kv.put({ key: 'lastBackupAt', value: nowISO() });
}

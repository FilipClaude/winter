import Dexie, { type EntityTable } from 'dexie';
import type {
  Day,
  Deadline,
  Earning,
  Exam,
  ExerciseTemplate,
  Goal,
  Grade,
  Habit,
  HabitCheck,
  HealthDay,
  Lesson,
  Meal,
  MealTemplate,
  MockExam,
  Module,
  SemesterResult,
  Session,
  Sleep,
  Snapshot,
  StudyBlock,
  StudySession,
  Subject,
  Todo,
} from './schemas';
import { seedDefaults } from './seed';

export interface KV {
  key: string;
  value: unknown;
}

/**
 * Schema-Version der Datenbank. Wird bei jeder Schemaänderung erhöht und auch in Backups gespeichert.
 * Migrationen: neue `this.version(n).stores({...}).upgrade(tx => …)` UNTER den bestehenden anhängen,
 * alte Versionen niemals ändern. Backup-Importe älterer Versionen laufen durch `migrateBackup()`.
 */
export const SCHEMA_VERSION = 3;

/** Schema v1 (eingefroren – nie ändern, wird auch von den Migrationstests genutzt). */
export const V1_STORES = {
  sessions: 'id, date, type, demo',
  exerciseTemplates: 'id, &name, order',
  meals: 'id, date, demo',
  mealTemplates: 'id, order',
  days: 'id, &date, demo',
  sleep: 'id, date, demo',
  health: 'id, &date, demo',
  subjects: 'id, order',
  studySessions: 'id, date, subjectId, demo',
  todos: 'id, date, due, subjectId, demo',
  exams: 'id, date, subjectId, demo',
  modules: 'id, demo',
  deadlines: 'id, date, moduleId, demo',
  habits: 'id, order, demo',
  habitChecks: 'id, [habitId+date], date, habitId, demo',
  kv: 'key',
} as const;

const V1_DATA_TABLES = [
  'sessions',
  'exerciseTemplates',
  'meals',
  'mealTemplates',
  'days',
  'sleep',
  'health',
  'subjects',
  'studySessions',
  'todos',
  'exams',
  'modules',
  'deadlines',
  'habits',
  'habitChecks',
] as const;

/** kv-Schlüssel, die zu den Nutzerdaten gehören (Backups, Snapshots). */
export const BACKUP_KV_KEYS: readonly string[] = ['settings', 'timer', 'lastHealthImport', 'demoActive'];

/** Änderungen v1 → v2: nur neue Tabellen und ein zusätzlicher Index. */
export const V2_STORES = {
  sessions: 'id, date, type, demo, bfvId',
  grades: 'id, date, subjectId, semester, demo',
  semesterResults: 'id, subjectId, semester, demo',
  studyBlocks: 'id, date, subjectId, examId, demo',
  lessons: 'id, weekday, subjectId, demo',
  goals: 'id, period, demo',
  snapshots: 'id, createdAt',
} as const;

/** Änderungen v2 → v3: nur neue Tabellen (Verdienst, Probe-Klausuren). Neue Felder sind optional. */
export const V3_STORES = {
  earnings: 'id, date, demo',
  mockExams: 'id, date, examId, subjectId, demo',
} as const;

export class WinterDB extends Dexie {
  sessions!: EntityTable<Session, 'id'>;
  exerciseTemplates!: EntityTable<ExerciseTemplate, 'id'>;
  meals!: EntityTable<Meal, 'id'>;
  mealTemplates!: EntityTable<MealTemplate, 'id'>;
  days!: EntityTable<Day, 'id'>;
  sleep!: EntityTable<Sleep, 'id'>;
  health!: EntityTable<HealthDay, 'id'>;
  subjects!: EntityTable<Subject, 'id'>;
  studySessions!: EntityTable<StudySession, 'id'>;
  todos!: EntityTable<Todo, 'id'>;
  exams!: EntityTable<Exam, 'id'>;
  modules!: EntityTable<Module, 'id'>;
  deadlines!: EntityTable<Deadline, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitChecks!: EntityTable<HabitCheck, 'id'>;
  kv!: EntityTable<KV, 'key'>;
  grades!: EntityTable<Grade, 'id'>;
  semesterResults!: EntityTable<SemesterResult, 'id'>;
  studyBlocks!: EntityTable<StudyBlock, 'id'>;
  lessons!: EntityTable<Lesson, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  snapshots!: EntityTable<Snapshot, 'id'>;
  earnings!: EntityTable<Earning, 'id'>;
  mockExams!: EntityTable<MockExam, 'id'>;

  /**
   * Von welcher Schemaversion wurde beim Öffnen migriert (null = keine Migration)? Dann legt
   * `ensureMigrationSnapshot` die Sicherung „vor-v<aktuell>“ an.
   */
  migratedFrom: number | null = null;

  constructor(name = 'winter') {
    super(name);
    this.version(1).stores(V1_STORES);
    // Bewusst ohne Schreibzugriffe im Upgrade: Schlüge dort etwas fehl (z. B. Speicher voll), bräche
    // IndexedDB das Upgrade bei jedem Start erneut ab und die App wäre unbenutzbar. Die Migration ist
    // rein additiv – die Sicherung „vor-v2“ entsteht danach in einer normalen Transaktion (gleicher Inhalt).
    this.version(2)
      .stores(V2_STORES)
      .upgrade(() => {
        this.migratedFrom ??= 1;
      });
    // v3: wie v2 rein additiv, ohne Schreibzugriffe im Upgrade.
    this.version(3)
      .stores(V3_STORES)
      .upgrade(() => {
        this.migratedFrom ??= 2;
      });
    this.on('populate', (tx) => seedDefaults(tx));
  }
}

/** Alle Datentabellen (ohne kv und Snapshots) – Reihenfolge = Reihenfolge in Backups. */
export const DATA_TABLES = [
  ...V1_DATA_TABLES,
  'grades',
  'semesterResults',
  'studyBlocks',
  'lessons',
  'goals',
  'earnings',
  'mockExams',
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export const db = new WinterDB();

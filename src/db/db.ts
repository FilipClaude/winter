import Dexie, { type EntityTable } from 'dexie';
import type {
  Day,
  Deadline,
  Exam,
  ExerciseTemplate,
  Habit,
  HabitCheck,
  HealthDay,
  Meal,
  MealTemplate,
  Module,
  Session,
  Sleep,
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
export const SCHEMA_VERSION = 1;

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

  constructor(name = 'winter') {
    super(name);
    this.version(1).stores({
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
    });
    this.on('populate', (tx) => seedDefaults(tx));
  }
}

/** Alle Datentabellen (ohne kv) – Reihenfolge = Reihenfolge in Backups. */
export const DATA_TABLES = [
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
export type DataTable = (typeof DATA_TABLES)[number];

export const db = new WinterDB();

import { z } from 'zod';
import { isISODate, isTimeHM } from '../lib/date';

// ---------- Bausteine ----------

export const zId = z.string().min(1).max(80);
export const zDate = z.string().refine(isISODate, { error: 'Ungültiges Datum (erwartet JJJJ-MM-TT)' });
export const zTime = z.string().refine(isTimeHM, { error: 'Ungültige Uhrzeit (erwartet HH:MM)' });
export const zInstant = z.iso.datetime({ offset: true, error: 'Ungültiger Zeitpunkt (ISO 8601)' });
const zInt = (min: number, max: number) => z.number().int().min(min).max(max);
const zText = (max: number) => z.string().max(max);

const meta = {
  id: zId,
  createdAt: zInstant,
  updatedAt: zInstant,
  /** Demo-Daten sind mit 1 markiert und vollständig löschbar. */
  demo: z.literal(1).optional(),
};
const dated = { ...meta, date: zDate };

// ---------- Training ----------

export const SESSION_TYPES = ['football', 'match', 'gym', 'run', 'recovery', 'other'] as const;
export const zSessionType = z.enum(SESSION_TYPES);
export type SessionType = z.infer<typeof zSessionType>;

export const zMatch = z.object({
  opponent: zText(80),
  goalsFor: zInt(0, 99),
  goalsAgainst: zInt(0, 99),
  minutes: zInt(0, 130),
  goals: zInt(0, 20),
  assists: zInt(0, 20),
  shots: zInt(0, 50),
  rating: zInt(1, 10),
  reflection: zText(4000),
});
export type Match = z.infer<typeof zMatch>;

export const zGymSet = z.object({
  reps: zInt(0, 200),
  weightKg: z.number().min(0).max(600),
});
export type GymSet = z.infer<typeof zGymSet>;

export const zGymExercise = z.object({
  name: z.string().trim().min(1).max(60),
  sets: z.array(zGymSet).max(30),
});
export type GymExercise = z.infer<typeof zGymExercise>;

export const zSession = z.object({
  ...dated,
  type: zSessionType,
  durationMin: zInt(1, 600),
  rpe: zInt(1, 10),
  note: zText(4000),
  match: zMatch.optional(),
  gym: z.object({ exercises: z.array(zGymExercise).max(40) }).optional(),
});
export type Session = z.infer<typeof zSession>;

export const zExerciseTemplate = z.object({
  ...meta,
  name: z.string().trim().min(1).max(60),
  lastSets: z.array(zGymSet).max(30),
  order: zInt(0, 10_000),
});
export type ExerciseTemplate = z.infer<typeof zExerciseTemplate>;

// ---------- Körper ----------

export const zMeal = z.object({
  ...dated,
  time: zTime.optional(),
  name: z.string().trim().min(1).max(80),
  kcal: zInt(0, 6000),
  proteinG: z.number().min(0).max(500),
  templateId: zId.optional(),
});
export type Meal = z.infer<typeof zMeal>;

export const zMealTemplate = z.object({
  ...meta,
  name: z.string().trim().min(1).max(80),
  kcal: zInt(0, 6000),
  proteinG: z.number().min(0).max(500),
  order: zInt(0, 10_000),
});
export type MealTemplate = z.infer<typeof zMealTemplate>;

/** Ein Datensatz pro Kalendertag (id = Datum): Wasser, Stimmung, Energie, Journal. */
export const zDay = z.object({
  ...dated,
  water: zInt(0, 60),
  mood: zInt(1, 5).optional(),
  energy: zInt(1, 5).optional(),
  note: zText(10_000),
  good: zText(2000),
  better: zText(2000),
  tomorrow: zText(2000),
});
export type Day = z.infer<typeof zDay>;

const MAX_SLEEP_MS = 20 * 3_600_000;

/** Manuell erfasster Schlaf. `date` = Aufwachtag. */
export const zSleep = z
  .object({
    ...dated,
    start: zInstant,
    end: zInstant,
    quality: zInt(1, 5).optional(),
  })
  .refine((s) => new Date(s.end).getTime() > new Date(s.start).getTime(), {
    error: 'Aufwachzeit muss nach der Bettzeit liegen',
    path: ['end'],
  })
  .refine((s) => new Date(s.end).getTime() - new Date(s.start).getTime() <= MAX_SLEEP_MS, {
    error: 'Schlaf länger als 20 Stunden ist unplausibel',
    path: ['end'],
  });
export type Sleep = z.infer<typeof zSleep>;

/** Importierte Health-Werte. Getrennt von manuellen Einträgen; ein Datensatz pro Tag (id = Datum). */
export const zHealthDay = z.object({
  ...dated,
  steps: zInt(0, 200_000).optional(),
  distanceKm: z.number().min(0).max(300).optional(),
  flights: zInt(0, 2000).optional(),
  sleepStart: zInstant.optional(),
  sleepEnd: zInstant.optional(),
  source: z.string().max(40),
  importedAt: zInstant,
});
export type HealthDay = z.infer<typeof zHealthDay>;

// ---------- Schule ----------

export const zSubject = z.object({
  ...meta,
  name: z.string().trim().min(1).max(40),
  short: z.string().trim().min(1).max(8),
  order: zInt(0, 10_000),
  archived: z.boolean(),
  /** Leistungsfach (für die Anzeige). */
  major: z.boolean().optional(),
});
export type Subject = z.infer<typeof zSubject>;

export const zStudySession = z.object({
  ...dated,
  subjectId: zId,
  start: zInstant,
  end: zInstant,
  minutes: zInt(0, 24 * 60),
});
export type StudySession = z.infer<typeof zStudySession>;

export const zTodo = z.object({
  ...dated,
  title: z.string().trim().min(1).max(200),
  subjectId: zId.optional(),
  due: zDate.optional(),
  done: z.boolean(),
  doneAt: zInstant.optional(),
});
export type Todo = z.infer<typeof zTodo>;

export const EXAM_KINDS = ['klausur', 'kurzarbeit', 'ex', 'referat'] as const;
export const zExam = z.object({
  ...dated,
  subjectId: zId,
  kind: z.enum(EXAM_KINDS),
  topics: zText(2000),
  progress: zInt(0, 100),
  points: zInt(0, 15).optional(),
});
export type Exam = z.infer<typeof zExam>;

export const zModule = z.object({
  ...meta,
  name: z.string().trim().min(1).max(80),
  number: zText(20),
  archived: z.boolean(),
});
export type Module = z.infer<typeof zModule>;

export const DEADLINE_KINDS = ['einsendearbeit', 'pruefung', 'sonstiges'] as const;
/** FernUni-Frist. `date` = Fälligkeitstag. */
export const zDeadline = z.object({
  ...dated,
  moduleId: zId,
  kind: z.enum(DEADLINE_KINDS),
  title: z.string().trim().min(1).max(120),
  time: zTime.optional(),
  done: z.boolean(),
});
export type Deadline = z.infer<typeof zDeadline>;

// ---------- Habits ----------

export const zHabitSchedule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily') }),
  z.object({ kind: z.literal('weekdays'), days: z.array(zInt(1, 7)).min(1).max(7) }),
]);
export type HabitSchedule = z.infer<typeof zHabitSchedule>;

export const zHabit = z.object({
  ...meta,
  name: z.string().trim().min(1).max(60),
  schedule: zHabitSchedule,
  order: zInt(0, 10_000),
  archived: z.boolean(),
  /** Ab diesem Tag zählt der Habit (für Streaks und Quoten). */
  startDate: zDate,
});
export type Habit = z.infer<typeof zHabit>;

export const zHabitCheck = z.object({ ...dated, habitId: zId });
export type HabitCheck = z.infer<typeof zHabitCheck>;

// ---------- Einstellungen ----------

export const zGoals = z.object({
  proteinG: zInt(0, 500),
  kcal: zInt(0, 8000),
  waterGlasses: zInt(0, 40),
  studyMin: zInt(0, 1440),
  sleepH: z.number().min(0).max(14),
  steps: zInt(0, 100_000),
});
export type Goals = z.infer<typeof zGoals>;

export const zWeekPlan = z.record(z.string().regex(/^[1-7]$/), z.array(zSessionType).max(4));
export type WeekPlan = z.infer<typeof zWeekPlan>;

export const zSettings = z.object({
  goals: zGoals,
  weekPlan: zWeekPlan,
  glassMl: zInt(50, 1000),
  snow: z.boolean(),
  shortcutName: z.string().trim().min(1).max(60),
  /** In den Tagesring einbezogene Ziele. */
  ring: z.object({
    habits: z.boolean(),
    protein: z.boolean(),
    water: z.boolean(),
    study: z.boolean(),
    sleep: z.boolean(),
  }),
});
export type Settings = z.infer<typeof zSettings>;

export const DEFAULT_SETTINGS: Settings = {
  goals: { proteinG: 140, kcal: 2900, waterGlasses: 10, studyMin: 90, sleepH: 8, steps: 10_000 },
  weekPlan: {
    '1': ['football'],
    '2': ['gym'],
    '3': ['football'],
    '4': ['gym'],
    '5': ['football'],
    '6': ['match'],
    '7': ['recovery'],
  },
  glassMl: 250,
  snow: true,
  shortcutName: 'Winter Health',
  ring: { habits: true, protein: true, water: true, study: true, sleep: true },
};

/** Laufender Lern-Timer: gespeicherte Startzeit, damit er Schließen/Neuladen übersteht. */
export const zTimer = z.object({ subjectId: zId, startedAt: zInstant });
export type Timer = z.infer<typeof zTimer>;

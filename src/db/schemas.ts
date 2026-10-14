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
/** v3: Trainingssplit einer Gym-Einheit. */
export const GYM_SPLITS = ['push', 'pull', 'legs'] as const;
export type GymSplit = (typeof GYM_SPLITS)[number];
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

/** Vom BFV-Abgleich übernommene Spieldaten (v2). Manuelle Werte in `match` haben immer Vorrang. */
export const zBfvMatch = z.object({
  id: z.string().min(1).max(80),
  kickoff: zInstant.optional(),
  home: z.boolean(),
  /** Vom BFV gelieferte Felder, die in `match` vorausgefüllt wurden (Anzeige „vom BFV“). */
  prefilled: z.array(z.enum(['opponent', 'goalsFor', 'goalsAgainst', 'minutes', 'goals'])).max(10),
});

export const zSession = z.object({
  ...dated,
  type: zSessionType,
  durationMin: zInt(1, 600),
  rpe: zInt(1, 10),
  note: zText(4000),
  match: zMatch.optional(),
  gym: z.object({ exercises: z.array(zGymExercise).max(40) }).optional(),
  /** v2: Spiel stammt aus dem BFV-Abgleich. */
  bfv: zBfvMatch.optional(),
  /** v2: Index-Feld für schnelle Suche nach BFV-Spielen. */
  bfvId: z.string().max(80).optional(),
  /** v3: Split einer Gym-Einheit (fehlt = „Gym“ ohne Split, z. B. alte Einheiten). */
  split: z.enum(GYM_SPLITS).optional(),
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

export const TODO_PRIORITIES = ['hoch', 'normal', 'niedrig'] as const;
export const TODO_REPEATS = ['none', 'weekly', 'biweekly'] as const;

export const zTodo = z.object({
  ...dated,
  title: z.string().trim().min(1).max(200),
  subjectId: zId.optional(),
  due: zDate.optional(),
  done: z.boolean(),
  doneAt: zInstant.optional(),
  /** v2: Priorität (fehlt = normal). */
  priority: z.enum(TODO_PRIORITIES).optional(),
  /** v2: Wiederholung – beim Abhaken entsteht die nächste Aufgabe. */
  repeat: z.enum(TODO_REPEATS).optional(),
});
export type Todo = z.infer<typeof zTodo>;

/** Halbjahre der Qualifikationsphase (G9 Bayern: Q12/Q13). */
export const SEMESTERS = ['12/1', '12/2', '13/1', '13/2'] as const;
export const zSemester = z.enum(SEMESTERS);
export type Semester = z.infer<typeof zSemester>;

/** v2: Thema einer Klausur mit Lernstand 0–3 (offen, angefangen, sitzt, wiederholt). */
export const zExamTopic = z.object({
  id: zId,
  title: z.string().trim().min(1).max(120),
  level: zInt(0, 3),
});
export type ExamTopic = z.infer<typeof zExamTopic>;

export const EXAM_KINDS = ['klausur', 'kurzarbeit', 'ex', 'referat'] as const;
export const zExam = z.object({
  ...dated,
  subjectId: zId,
  kind: z.enum(EXAM_KINDS),
  topics: zText(2000),
  progress: zInt(0, 100),
  points: zInt(0, 15).optional(),
  /** v2: Themen als Checkliste (ersetzt bei Vorhandensein `progress`). */
  topicList: z.array(zExamTopic).max(60).optional(),
  /** v2: Reflexion nach der Rückgabe. */
  reflection: zText(4000).optional(),
  semester: zSemester.optional(),
});
export type Exam = z.infer<typeof zExam>;

/** v2: Regel zur Prüfungsberechtigung eines FernUni-Moduls. */
export const zModuleRule = z.object({
  /** Mindestanzahl bestandener Einsendearbeiten. */
  minPassed: zInt(0, 20),
  /** Ab wie vielen Punkten (in %) eine EA als bestanden zählt. */
  passPercent: zInt(0, 100),
});
export type ModuleRule = z.infer<typeof zModuleRule>;

export const zModule = z.object({
  ...meta,
  name: z.string().trim().min(1).max(80),
  number: zText(20),
  archived: z.boolean(),
  rule: zModuleRule.optional(),
  /** v2: freie Notiz, z. B. Belegungshinweise. */
  note: zText(4000).optional(),
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
  /** v2: erreichte und maximale Punkte einer Einsendearbeit. */
  points: z.number().min(0).max(1000).optional(),
  maxPoints: z.number().min(1).max(1000).optional(),
});
export type Deadline = z.infer<typeof zDeadline>;

// ---------- v2: Noten, Abi, Lernplan, Stundenplan ----------

export const GRADE_TYPES = [
  'klausur',
  'kurzarbeit',
  'ex',
  'referat',
  'abfrage',
  'muendlich',
  'sonstiges',
] as const;
export const GRADE_TYPE_LABEL: Record<(typeof GRADE_TYPES)[number], string> = {
  klausur: 'Klausur',
  kurzarbeit: 'Kurzarbeit',
  ex: 'Ex',
  referat: 'Referat',
  abfrage: 'Abfrage',
  muendlich: 'Mündlich',
  sonstiges: 'Sonstiges',
};

/** Leistungsnachweis (groß = Klausur o. Ä., klein = Ex, Abfrage, mündlich …). */
export const zGrade = z.object({
  ...dated,
  subjectId: zId,
  semester: zSemester,
  size: z.enum(['gross', 'klein']),
  type: z.enum(GRADE_TYPES),
  points: zInt(0, 15),
  /** Gewicht innerhalb der Gruppe (groß/klein), Standard 1. */
  weight: z.number().min(0.1).max(10),
  note: zText(500),
  examId: zId.optional(),
});
export type Grade = z.infer<typeof zGrade>;

/** Halbjahresleistung eines Fachs (Zeugnis), überschreibt den berechneten Wert. id = `${subjectId}:${semester}`. */
export const zSemesterResult = z.object({
  ...meta,
  subjectId: zId,
  semester: zSemester,
  points: zInt(0, 15),
});
export type SemesterResult = z.infer<typeof zSemesterResult>;

/** Geplante Lerneinheit (aus dem Lernplan-Generator oder von Hand). */
export const zStudyBlock = z.object({
  ...dated,
  subjectId: zId,
  examId: zId.optional(),
  topic: zText(120),
  kind: z.enum(['lernen', 'wiederholen']),
  minutes: zInt(5, 600),
  done: z.boolean(),
  doneAt: zInstant.optional(),
});
export type StudyBlock = z.infer<typeof zStudyBlock>;

/** Stundenplan-Eintrag. week: A, B oder beide Wochen. */
export const zLesson = z.object({
  ...meta,
  weekday: zInt(1, 5),
  period: zInt(1, 12),
  subjectId: zId,
  room: zText(20),
  week: z.enum(['AB', 'A', 'B']),
});
export type Lesson = z.infer<typeof zLesson>;

export const GOAL_METRICS = [
  'studyMin',
  'gymSessions',
  'trainingSessions',
  'avgProtein',
  'avgSleepH',
  'avgSteps',
  'habitRate',
  'abiAverage',
  'earnings',
] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
/** v3: In der Oberfläche wählbare Kennzahlen (`avgProtein` bleibt für alte, archivierte Ziele lesbar). */
export const GOAL_METRICS_ACTIVE = GOAL_METRICS.filter((m) => m !== 'avgProtein');

export const zGoal = z.object({
  ...meta,
  period: z.enum(['week', 'month']),
  metric: z.enum(GOAL_METRICS),
  /** Lernzeit in Minuten, Verdienst in Cent (v3: Obergrenze 10 Mio., damit auch Monatsziele in Euro passen). */
  target: z.number().min(0).max(10_000_000),
  archived: z.boolean(),
});
export type Goal = z.infer<typeof zGoal>;

/** Automatische Sicherung (nicht im Export). id = Kalendertag bzw. „vor-v2“. */
export const zSnapshot = z.object({
  id: zId,
  createdAt: zInstant,
  schemaVersion: zInt(1, 1000),
  reason: z.enum(['daily', 'migration', 'manual']),
  rows: zInt(0, 10_000_000),
  /** Inhalt im Backup-Format (Tabellen + kv). */
  data: z.unknown(),
});
export type Snapshot = z.infer<typeof zSnapshot>;

// ---------- v3: Probe-Klausuren, Verdienst ----------

/** Probe-Durchgang einer Klausur: erreichte und maximale Bewertungseinheiten (BE, Kommazahlen erlaubt). */
export const zMockExam = z
  .object({
    ...dated,
    examId: zId,
    subjectId: zId,
    points: z.number().min(0).max(1000),
    maxPoints: z.number().positive().max(1000),
    durationMin: zInt(1, 600).optional(),
    note: zText(500).optional(),
  })
  .refine((m) => m.points <= m.maxPoints, {
    error: 'Erreichte BE dürfen nicht über dem Maximum liegen',
    path: ['points'],
  });
export type MockExam = z.infer<typeof zMockExam>;

/** Verdienst-Eintrag. Beträge immer in Cent als Ganzzahl (nie Kommazahlen speichern). */
export const zEarning = z.object({
  ...dated,
  amountCents: z
    .number()
    .int({ error: 'Betrag in Cent muss eine ganze Zahl sein' })
    .positive({ error: 'Betrag muss größer als 0 sein' })
    .max(10_000_000, { error: 'Betrag ist unplausibel hoch' }),
  note: zText(80).optional(),
});
export type Earning = z.infer<typeof zEarning>;

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

export const SKY_PHASES = ['night', 'dawn', 'day', 'dusk'] as const;
export type SkyPhase = (typeof SKY_PHASES)[number];

export const DASHBOARD_WIDGETS = [
  'briefing',
  'ring',
  'nextExam',
  'alerts',
  'studyToday',
  'training',
  'nextMatch',
  'earnings',
  'steps',
  'sleep',
  'habits',
  'mood',
  'abi',
  'goals',
  'journal',
] as const;
export type DashboardWidgetId = (typeof DASHBOARD_WIDGETS)[number];
/** Widgets aus v2, die es nicht mehr gibt. Gespeicherte Anordnungen mit ihnen bleiben gültig (sie fallen beim Anzeigen weg). */
export const LEGACY_WIDGETS = ['deadlines', 'nutrition'] as const;

export const zDashboardWidget = z.object({
  id: z.enum([...DASHBOARD_WIDGETS, ...LEGACY_WIDGETS]),
  size: z.enum(['s', 'l']),
  hidden: z.boolean(),
});
export type StoredDashboardWidget = z.infer<typeof zDashboardWidget>;
export type DashboardWidget = StoredDashboardWidget & { id: DashboardWidgetId };

export const zSettings = z.object({
  goals: zGoals,
  weekPlan: zWeekPlan,
  glassMl: zInt(50, 1000),
  /** v1-Schalter, bleibt für alte Backups lesbar. Maßgeblich ist `snowMode`. */
  snow: z.boolean(),
  shortcutName: z.string().trim().min(1).max(60),
  /** In den Tagesring einbezogene Ziele. */
  ring: z.object({
    habits: z.boolean(),
    /** v1/v2, seit v3 ohne Wirkung (bleibt für alte Backups lesbar). */
    protein: z.boolean(),
    /** v1/v2, seit v3 ohne Wirkung (bleibt für alte Backups lesbar). */
    water: z.boolean(),
    study: z.boolean(),
    sleep: z.boolean(),
    /** v3 */
    training: z.boolean(),
    /** v3 */
    earnings: z.boolean(),
  }),
  // ----- v2 -----
  snowMode: z.enum(['off', 'subtle', 'weather']),
  /** Entwickler-Schalter: Himmelsphase fest einstellen. */
  skySimulate: z.enum(['auto', ...SKY_PHASES]),
  /** Alpen-Parallaxe per Gerätebewegung (nur nach Erlaubnis). */
  tilt: z.boolean(),
  timetable: z.object({
    /** A/B-Wochen aktiv. */
    abWeeks: z.boolean(),
    /** Ein Montag, der in einer A-Woche liegt. */
    weekARef: zDate,
  }),
  pomodoro: z.object({ workMin: zInt(5, 120), breakMin: zInt(1, 60) }),
  dashboard: z.array(zDashboardWidget).max(30),
  onboarded: z.boolean(),
  /** Abi: Fächer der Abiturprüfungen (Fach-IDs) und geplante Prüfungspunkte. */
  abi: z.object({
    examSubjects: z.array(zId).max(5),
    examPoints: z.record(z.string(), zInt(0, 15)),
    /** Gewichtung groß : klein bei der Halbjahresleistung (GSO: 1 : 1). */
    bigWeight: z.number().min(0).max(10),
    smallWeight: z.number().min(0).max(10),
    /** Einbringungsrolle je Fach-ID (fehlt = automatisch). */
    roles: z.record(z.string(), z.enum(['all', 'three', 'free', 'none'])),
    /** W-Seminar: Halbjahresleistungen 12/1, 12/2 und Gesamtleistung der Seminararbeit (0–30, zählt wie 2 HJL). */
    seminar: z.object({
      s1: zInt(0, 15).nullable(),
      s2: zInt(0, 15).nullable(),
      paper: zInt(0, 30).nullable(),
    }),
  }),
  bfv: z.object({ enabled: z.boolean(), playerName: zText(80) }),
  // ----- v3 -----
  /** Wochenziel Verdienst in Cent (0 = aus). */
  earnings: z.object({ weeklyGoalCents: z.number().int().min(0).max(10_000_000) }),
  /**
   * Schätzung Prozent → Notenpunkte für Probe-Klausuren: Mindestprozent für 15, 14, …, 1 Punkt
   * (15 Werte, streng fallend). Darunter 0 Punkte.
   */
  npScale: z
    .array(z.number().min(0).max(100))
    .length(15)
    .refine((xs) => xs.every((x, i) => i === 0 || x < (xs[i - 1] ?? 101)), {
      error: 'Die Schwellen müssen von 15 nach 1 Punkt fallen',
    }),
});
export type Settings = z.infer<typeof zSettings>;

/**
 * Standard-Notenschlüssel für Probe-Klausuren: der verbreitete Abitur-Schlüssel nach den
 * Einheitlichen Prüfungsanforderungen (EPA) – 15 Punkte ab 95 %, in 5-%-Schritten bis 5 Punkte ab 45 %,
 * dann 4 ab 40, 3 ab 33, 2 ab 27, 1 ab 20 %. Nur eine Schätzung, der Schlüssel der Schule kann abweichen.
 */
export const DEFAULT_NP_SCALE = [95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 33, 27, 20];

/** Standard-Anordnung von v2 (eingefroren): Wer sie unverändert hat, bekommt den neuen Standard. */
export const V2_DEFAULT_DASHBOARD: StoredDashboardWidget[] = [
  { id: 'briefing', size: 'l', hidden: false },
  { id: 'ring', size: 'l', hidden: false },
  { id: 'alerts', size: 'l', hidden: false },
  { id: 'studyToday', size: 'l', hidden: false },
  { id: 'steps', size: 's', hidden: false },
  { id: 'sleep', size: 's', hidden: false },
  { id: 'nutrition', size: 'l', hidden: false },
  { id: 'deadlines', size: 'l', hidden: false },
  { id: 'nextMatch', size: 's', hidden: false },
  { id: 'abi', size: 's', hidden: false },
  { id: 'training', size: 'l', hidden: false },
  { id: 'habits', size: 'l', hidden: false },
  { id: 'goals', size: 'l', hidden: false },
  { id: 'mood', size: 'l', hidden: false },
  { id: 'journal', size: 'l', hidden: false },
];

/** Standard ab v3: Briefing, Ring, Nächste Klausur, Lernen, Training/Spiel, Verdienst, Habits, Rest. */
export const DEFAULT_DASHBOARD: DashboardWidget[] = [
  { id: 'briefing', size: 'l', hidden: false },
  { id: 'ring', size: 'l', hidden: false },
  { id: 'nextExam', size: 'l', hidden: false },
  { id: 'alerts', size: 'l', hidden: false },
  { id: 'studyToday', size: 'l', hidden: false },
  { id: 'training', size: 'l', hidden: false },
  { id: 'nextMatch', size: 's', hidden: false },
  { id: 'earnings', size: 's', hidden: false },
  { id: 'habits', size: 'l', hidden: false },
  { id: 'steps', size: 's', hidden: false },
  { id: 'sleep', size: 's', hidden: false },
  { id: 'abi', size: 's', hidden: false },
  { id: 'goals', size: 'l', hidden: false },
  { id: 'mood', size: 'l', hidden: false },
  { id: 'journal', size: 'l', hidden: false },
];

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
  ring: {
    habits: true,
    protein: true,
    water: true,
    study: true,
    sleep: true,
    training: true,
    earnings: true,
  },
  snowMode: 'subtle',
  skySimulate: 'auto',
  tilt: false,
  timetable: { abWeeks: false, weekARef: '2026-09-14' },
  pomodoro: { workMin: 25, breakMin: 5 },
  dashboard: DEFAULT_DASHBOARD,
  onboarded: false,
  abi: {
    examSubjects: [],
    examPoints: {},
    bigWeight: 1,
    smallWeight: 1,
    roles: {},
    seminar: { s1: null, s2: null, paper: null },
  },
  bfv: { enabled: true, playerName: '' },
  earnings: { weeklyGoalCents: 0 },
  npScale: DEFAULT_NP_SCALE,
};

/** Laufender Lern-Timer: gespeicherte Startzeit, damit er Schließen/Neuladen übersteht. */
export const zTimer = z.object({
  subjectId: zId,
  startedAt: zInstant,
  /** v2: Pomodoro – abwechselnd Fokus und Pause; gebucht wird nur die Fokuszeit. */
  pomodoro: z.object({ workMin: zInt(5, 120), breakMin: zInt(1, 60) }).optional(),
});
export type Timer = z.infer<typeof zTimer>;

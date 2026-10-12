import type { z } from 'zod';
import { nowISO, splitAtMidnight, todayISO, type ISODate } from '../lib/date';
import { uid } from '../lib/id';
import { normalizeExercise } from '../lib/calc/training';
import { sleepFromWallTimes } from '../lib/calc/sleep';
import { db } from './db';
import {
  DEFAULT_SETTINGS,
  zDay,
  zDeadline,
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
  zModule,
  zSemesterResult,
  zSession,
  zSettings,
  zSleep,
  zStudyBlock,
  zStudySession,
  zSubject,
  zTimer,
  zTodo,
  type Day,
  type Deadline,
  type Exam,
  type Goal,
  type Grade,
  type GymSet,
  type Habit,
  type Lesson,
  type Semester,
  type StudyBlock,
  type HealthDay,
  type Meal,
  type MealTemplate,
  type Module,
  type Session,
  type Settings,
  type Subject,
  type Timer,
  type Todo,
} from './schemas';

// ---------- Validierung ----------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Parst mit Zod und wirft eine verständliche deutsche Fehlermeldung. */
export function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const path = issue?.path.length ? `${issue.path.join('.')}: ` : '';
  throw new ValidationError(`${path}${issue?.message ?? 'Ungültige Eingabe'}`);
}

type Meta = { id: string; createdAt: string; updatedAt: string };
type WithOptionalMeta<T> = Omit<T, keyof Meta> & Partial<Meta>;

/** Ergänzt id/createdAt (falls neu) und setzt updatedAt. Die Typprüfung übernimmt danach `validate`. */
function stamp<V extends object>(value: V): V & Meta {
  const now = nowISO();
  const m = value as Partial<Meta>;
  return { ...value, id: m.id ?? uid(), createdAt: m.createdAt ?? now, updatedAt: now };
}

// ---------- Key-Value / Einstellungen ----------

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

/** Objekt-Einstellungen mit festen Feldern (keine freien Records wie der Wochenplan). */
const MERGED_KEYS = new Set<keyof Settings>(['goals', 'ring', 'timetable', 'pomodoro', 'abi', 'bfv']);

/**
 * Liest gespeicherte Einstellungen tolerant: Jeder Schlüssel wird einzeln geprüft und fällt bei Fehlern
 * auf den Standard zurück – ein kaputter Wert kostet nie die übrigen Einstellungen. Objekte werden mit
 * ihren Standardwerten zusammengeführt (neue Felder aus späteren Versionen).
 */
export function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const shape = zSettings.shape;
  for (const key of Object.keys(shape) as (keyof Settings)[]) {
    const def = DEFAULT_SETTINGS[key];
    let value = src[key];
    if (value === undefined) {
      // v1 → v2: Schneeschalter übernehmen; wer schon Einstellungen hat, braucht kein Onboarding.
      if (key === 'snowMode' && typeof src.snow === 'boolean') value = src.snow ? 'subtle' : 'off';
      else if (key === 'onboarded') value = true;
      else value = def;
    } else if (MERGED_KEYS.has(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      value = { ...(def as object), ...value };
    }
    const r = shape[key].safeParse(value);
    out[key] = r.success ? r.data : def;
  }
  return out as Settings;
}

export async function getSettings(): Promise<Settings> {
  return parseSettings(await kvGet('settings'));
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = validate(zSettings, { ...(await getSettings()), ...patch });
  await kvSet('settings', next);
  return next;
}

// ---------- Tageswerte (Wasser, Stimmung, Journal) ----------

export function emptyDay(date: ISODate): Day {
  const now = nowISO();
  return {
    id: date,
    date,
    createdAt: now,
    updatedAt: now,
    water: 0,
    note: '',
    good: '',
    better: '',
    tomorrow: '',
  };
}

export async function getDay(date: ISODate): Promise<Day> {
  return (await db.days.get(date)) ?? emptyDay(date);
}

export async function updateDay(
  date: ISODate,
  patch: Partial<Omit<Day, 'id' | 'date' | 'createdAt'>>,
): Promise<Day> {
  return db.transaction('rw', db.days, async () => {
    const cur = await getDay(date);
    const next = validate(zDay, { ...cur, ...patch, id: date, date, updatedAt: nowISO() });
    await db.days.put(next);
    return next;
  });
}

export async function addWater(date: ISODate, delta: number): Promise<number> {
  return db.transaction('rw', db.days, async () => {
    const cur = await getDay(date);
    const water = Math.min(60, Math.max(0, cur.water + delta));
    await updateDay(date, { water });
    return water;
  });
}

// ---------- Mahlzeiten ----------

export async function addMeal(input: WithOptionalMeta<Meal>): Promise<Meal> {
  const meal = validate(zMeal, stamp(input));
  await db.meals.put(meal);
  return meal;
}

export async function addMealFromTemplate(templateId: string, date: ISODate): Promise<Meal> {
  const t = await db.mealTemplates.get(templateId);
  if (!t) throw new ValidationError('Vorlage nicht gefunden');
  return addMeal({ date, name: t.name, kcal: t.kcal, proteinG: t.proteinG, templateId: t.id });
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.delete(id);
}

export async function saveMealTemplate(
  input: WithOptionalMeta<Omit<MealTemplate, 'order'>> & { order?: number },
) {
  const order = input.order ?? (await db.mealTemplates.count());
  const t = validate(zMealTemplate, stamp({ ...input, order }));
  await db.mealTemplates.put(t);
  return t;
}

export async function deleteMealTemplate(id: string): Promise<void> {
  await db.mealTemplates.delete(id);
}

// ---------- Training ----------

/** Speichert eine Einheit. Bei Gym-Einheiten werden Übungsvorlagen mit den letzten Werten aktualisiert. */
export async function saveSession(input: WithOptionalMeta<Session>): Promise<Session> {
  const s = validate(zSession, stamp(input));
  if (s.type !== 'match') delete s.match;
  if (s.type !== 'gym') delete s.gym;
  await db.transaction('rw', db.sessions, db.exerciseTemplates, async () => {
    await db.sessions.put(s);
    for (const ex of s.gym?.exercises ?? []) await rememberExercise(ex.name, ex.sets);
  });
  return s;
}

async function rememberExercise(name: string, sets: GymSet[]): Promise<void> {
  const all = await db.exerciseTemplates.toArray();
  const existing = all.find((t) => normalizeExercise(t.name) === normalizeExercise(name));
  const lastSets = sets.filter((x) => x.reps > 0);
  if (existing) {
    if (lastSets.length > 0)
      await db.exerciseTemplates.update(existing.id, { lastSets, updatedAt: nowISO() });
    return;
  }
  const t = validate(zExerciseTemplate, stamp({ name: name.trim(), lastSets, order: all.length }));
  await db.exerciseTemplates.put(t);
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
}

export async function deleteExerciseTemplate(id: string): Promise<void> {
  await db.exerciseTemplates.delete(id);
}

// ---------- Schlaf und Health ----------

/** Manueller Schlaf für einen Aufwachtag (ein Eintrag pro Tag, wird ersetzt). */
export async function saveSleep(wakeDate: ISODate, bed: string, wake: string, quality?: number) {
  const { start, end } = sleepFromWallTimes(wakeDate, bed, wake);
  const existing = await db.sleep.where('date').equals(wakeDate).first();
  const entry = validate(
    zSleep,
    stamp({
      ...(existing ? { id: existing.id, createdAt: existing.createdAt } : {}),
      date: wakeDate,
      start,
      end,
      ...(quality !== undefined ? { quality } : {}),
    }),
  );
  await db.sleep.put(entry);
  return entry;
}

export async function deleteSleep(id: string): Promise<void> {
  await db.sleep.delete(id);
}

/**
 * Schreibt importierte Health-Werte eines Tages. Überschreibt nur die Health-Tabelle –
 * manuelle Einträge (Schlaf, Mahlzeiten …) werden nie angefasst.
 */
export async function upsertHealthDay(
  input: Omit<HealthDay, 'id' | 'createdAt' | 'updatedAt' | 'importedAt'>,
): Promise<HealthDay> {
  const existing = await db.health.get(input.date);
  const now = nowISO();
  const row = validate(zHealthDay, {
    ...input,
    id: input.date,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    importedAt: now,
  });
  await db.health.put(row);
  await kvSet('lastHealthImport', now);
  return row;
}

// ---------- Schule ----------

export async function saveSubject(input: WithOptionalMeta<Subject>): Promise<Subject> {
  const s = validate(zSubject, stamp(input));
  await db.subjects.put(s);
  return s;
}

export async function getTimer(): Promise<Timer | null> {
  const r = zTimer.safeParse(await kvGet('timer'));
  return r.success ? r.data : null;
}

export async function startTimer(subjectId: string, now = new Date()): Promise<Timer> {
  const running = await getTimer();
  if (running) await stopTimer(now);
  const t: Timer = { subjectId, startedAt: now.toISOString() };
  await kvSet('timer', t);
  return t;
}

/** Stoppt den Timer und speichert die Lernzeit, an Mitternacht auf Kalendertage aufgeteilt. */
export async function stopTimer(now = new Date()): Promise<number> {
  const t = await getTimer();
  if (!t) return 0;
  const segments = splitAtMidnight(t.startedAt, now.toISOString());
  await db.transaction('rw', db.studySessions, db.kv, async () => {
    for (const seg of segments) {
      await db.studySessions.put(
        validate(
          zStudySession,
          stamp({
            date: seg.date,
            subjectId: t.subjectId,
            start: seg.start,
            end: seg.end,
            minutes: seg.minutes,
          }),
        ),
      );
    }
    await db.kv.delete('timer');
  });
  return segments.reduce((a, s) => a + s.minutes, 0);
}

export async function cancelTimer(): Promise<void> {
  await db.kv.delete('timer');
}

/** Nachträglich erfasste Lernzeit (ohne Timer). */
export async function addStudyManual(subjectId: string, date: ISODate, minutes: number) {
  const end = date === todayISO() ? new Date() : new Date(`${date}T12:00:00Z`);
  const start = new Date(end.getTime() - minutes * 60_000);
  const s = validate(
    zStudySession,
    stamp({ date, subjectId, start: start.toISOString(), end: end.toISOString(), minutes }),
  );
  await db.studySessions.put(s);
  return s;
}

export async function deleteStudySession(id: string): Promise<void> {
  await db.studySessions.delete(id);
}

export async function saveTodo(input: WithOptionalMeta<Todo>): Promise<Todo> {
  const t = validate(zTodo, stamp(input));
  await db.todos.put(t);
  return t;
}

export async function toggleTodo(id: string): Promise<void> {
  const t = await db.todos.get(id);
  if (!t) return;
  const done = !t.done;
  const next: Todo = { ...t, done, updatedAt: nowISO() };
  if (done) next.doneAt = nowISO();
  else delete next.doneAt;
  await db.todos.put(next);
}

export async function deleteTodo(id: string): Promise<void> {
  await db.todos.delete(id);
}

export async function saveExam(input: WithOptionalMeta<Exam>): Promise<Exam> {
  const e = validate(zExam, stamp(input));
  await db.exams.put(e);
  return e;
}

export async function deleteExam(id: string): Promise<void> {
  await db.exams.delete(id);
}

export async function saveModule(input: WithOptionalMeta<Module>): Promise<Module> {
  const m = validate(zModule, stamp(input));
  await db.modules.put(m);
  return m;
}

export async function deleteModule(id: string): Promise<void> {
  await db.transaction('rw', db.modules, db.deadlines, async () => {
    await db.deadlines.where('moduleId').equals(id).delete();
    await db.modules.delete(id);
  });
}

export async function saveDeadline(input: WithOptionalMeta<Deadline>): Promise<Deadline> {
  const d = validate(zDeadline, stamp(input));
  await db.deadlines.put(d);
  return d;
}

export async function toggleDeadline(id: string): Promise<void> {
  const d = await db.deadlines.get(id);
  if (d) await db.deadlines.put({ ...d, done: !d.done, updatedAt: nowISO() });
}

export async function deleteDeadline(id: string): Promise<void> {
  await db.deadlines.delete(id);
}

// ---------- v2: Noten, Halbjahre, Lernplan, Stundenplan, Ziele ----------

export async function saveGrade(input: WithOptionalMeta<Grade>): Promise<Grade> {
  const g = validate(zGrade, stamp(input));
  await db.grades.put(g);
  return g;
}

export async function deleteGrade(id: string): Promise<void> {
  await db.grades.delete(id);
}

/** Setzt (points) bzw. entfernt (null) die Zeugnis-Halbjahresleistung eines Fachs. */
export async function setSemesterResult(subjectId: string, semester: Semester, points: number | null) {
  const id = `${subjectId}:${semester}`;
  if (points === null) {
    await db.semesterResults.delete(id);
    return null;
  }
  const existing = await db.semesterResults.get(id);
  const r = validate(
    zSemesterResult,
    stamp({ id, createdAt: existing?.createdAt, subjectId, semester, points }),
  );
  await db.semesterResults.put(r);
  return r;
}

export async function saveStudyBlock(input: WithOptionalMeta<StudyBlock>): Promise<StudyBlock> {
  const b = validate(zStudyBlock, stamp(input));
  await db.studyBlocks.put(b);
  return b;
}

export async function toggleStudyBlock(id: string): Promise<void> {
  const b = await db.studyBlocks.get(id);
  if (!b) return;
  const next: StudyBlock = { ...b, done: !b.done, updatedAt: nowISO() };
  if (next.done) next.doneAt = nowISO();
  else delete next.doneAt;
  await db.studyBlocks.put(next);
}

export async function deleteStudyBlock(id: string): Promise<void> {
  await db.studyBlocks.delete(id);
}

/** Ersetzt die offenen, generierten Lerneinheiten einer Klausur durch einen neuen Plan. Erledigte bleiben. */
export async function replaceExamPlan(examId: string, blocks: WithOptionalMeta<StudyBlock>[]) {
  await db.transaction('rw', db.studyBlocks, async () => {
    const old = await db.studyBlocks.where('examId').equals(examId).toArray();
    await db.studyBlocks.bulkDelete(old.filter((b) => !b.done).map((b) => b.id));
    await db.studyBlocks.bulkPut(blocks.map((b) => validate(zStudyBlock, stamp(b))));
  });
}

export async function saveLesson(input: WithOptionalMeta<Lesson>): Promise<Lesson> {
  const l = validate(zLesson, stamp(input));
  await db.lessons.put(l);
  return l;
}

export async function deleteLesson(id: string): Promise<void> {
  await db.lessons.delete(id);
}

export async function saveGoal(input: WithOptionalMeta<Goal>): Promise<Goal> {
  const g = validate(zGoal, stamp(input));
  await db.goals.put(g);
  return g;
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
}

// ---------- Habits ----------

export async function saveHabit(input: WithOptionalMeta<Omit<Habit, 'order'>> & { order?: number }) {
  const order = input.order ?? (await db.habits.count());
  const h = validate(zHabit, stamp({ ...input, order }));
  await db.habits.put(h);
  return h;
}

export async function deleteHabit(id: string): Promise<void> {
  await db.transaction('rw', db.habits, db.habitChecks, async () => {
    await db.habitChecks.where('habitId').equals(id).delete();
    await db.habits.delete(id);
  });
}

/** Hakt einen Habit an einem Tag ab bzw. wieder auf. Gibt den neuen Zustand zurück. */
export async function toggleHabit(habitId: string, date: ISODate): Promise<boolean> {
  return db.transaction('rw', db.habitChecks, async () => {
    const existing = await db.habitChecks.where('[habitId+date]').equals([habitId, date]).first();
    if (existing) {
      await db.habitChecks.delete(existing.id);
      return false;
    }
    await db.habitChecks.put(validate(zHabitCheck, stamp({ habitId, date })));
    return true;
  });
}

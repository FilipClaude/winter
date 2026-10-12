import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { emptyDay } from '../../db/repo';
import type { Day, Habit, HealthDay, Meal, Session, Sleep } from '../../db/schemas';
import { isScheduled } from '../../lib/calc/habits';
import { effectiveSleep, type EffectiveSleep } from '../../lib/calc/sleep';
import { studyMinutesOn } from '../../lib/calc/school';
import type { ISODate } from '../../lib/date';

export interface DayData {
  day: Day;
  meals: Meal[];
  sessions: Session[];
  manualSleep: Sleep | undefined;
  health: HealthDay | undefined;
  sleep: EffectiveSleep | null;
  habits: Habit[];
  checked: Set<string>;
  studyMin: number;
  proteinG: number;
  kcal: number;
}

export function useDayData(date: ISODate): DayData | undefined {
  return useLiveQuery(async () => {
    const [day, meals, sessions, manualSleep, health, habits, checks, study] = await Promise.all([
      db.days.get(date),
      db.meals.where('date').equals(date).toArray(),
      db.sessions.where('date').equals(date).toArray(),
      db.sleep.where('date').equals(date).first(),
      db.health.get(date),
      db.habits.orderBy('order').toArray(),
      db.habitChecks.where('date').equals(date).toArray(),
      db.studySessions.where('date').equals(date).toArray(),
    ]);
    const planned = habits.filter((h) => !h.archived && isScheduled(h, date));
    return {
      day: day ?? emptyDay(date),
      meals: meals.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      sessions,
      manualSleep,
      health,
      sleep: effectiveSleep(manualSleep, health),
      habits: planned,
      checked: new Set(checks.map((c) => c.habitId)),
      studyMin: studyMinutesOn(study, date),
      proteinG: meals.reduce((a, m) => a + m.proteinG, 0),
      kcal: meals.reduce((a, m) => a + m.kcal, 0),
    };
  }, [date]);
}

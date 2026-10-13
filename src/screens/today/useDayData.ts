import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { emptyDay } from '../../db/repo';
import type { Day, Habit, HealthDay, Session, Sleep } from '../../db/schemas';
import { sumCents, weekOf } from '../../lib/calc/earnings';
import { isScheduled } from '../../lib/calc/habits';
import { effectiveSleep, type EffectiveSleep } from '../../lib/calc/sleep';
import { studyMinutesOn } from '../../lib/calc/school';
import { withoutUni } from '../../lib/calc/subjects';
import type { ISODate } from '../../lib/date';

export interface DayData {
  day: Day;
  sessions: Session[];
  manualSleep: Sleep | undefined;
  health: HealthDay | undefined;
  sleep: EffectiveSleep | null;
  habits: Habit[];
  checked: Set<string>;
  /** Lernzeit des Tages (ohne ausgeblendete Uni-Fächer). */
  studyMin: number;
  /** Verdienst der Woche des Tages bis einschließlich dieses Tages (Cent). */
  weekEarningsCents: number;
}

export function useDayData(date: ISODate): DayData | undefined {
  return useLiveQuery(async () => {
    const week = weekOf(date);
    const [day, sessions, manualSleep, health, habits, checks, study, subjects, earnings] = await Promise.all([
      db.days.get(date),
      db.sessions.where('date').equals(date).toArray(),
      db.sleep.where('date').equals(date).first(),
      db.health.get(date),
      db.habits.orderBy('order').toArray(),
      db.habitChecks.where('date').equals(date).toArray(),
      db.studySessions.where('date').equals(date).toArray(),
      db.subjects.toArray(),
      db.earnings.where('date').between(week.from, date, true, true).toArray(),
    ]);
    const planned = habits.filter((h) => !h.archived && isScheduled(h, date));
    return {
      day: day ?? emptyDay(date),
      sessions,
      manualSleep,
      health,
      sleep: effectiveSleep(manualSleep, health),
      habits: planned,
      checked: new Set(checks.map((c) => c.habitId)),
      studyMin: studyMinutesOn(withoutUni(study, subjects), date),
      weekEarningsCents: sumCents(earnings, week.from, date),
    };
  }, [date]);
}

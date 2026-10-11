import { addDays, dateRange, isoWeekday, type ISODate } from '../date';
import type { Habit } from '../../db/schemas';

export function isScheduled(habit: Pick<Habit, 'schedule' | 'startDate'>, date: ISODate): boolean {
  if (date < habit.startDate) return false;
  if (habit.schedule.kind === 'daily') return true;
  return habit.schedule.days.includes(isoWeekday(date));
}

export interface Streak {
  current: number;
  longest: number;
}

/**
 * Streaks zählen nur geplante Tage. Nicht geplante Tage unterbrechen nichts.
 * Ein heute noch offener Habit bricht den aktuellen Streak nicht (der Tag läuft noch).
 */
export function habitStreak(habit: Pick<Habit, 'schedule' | 'startDate'>, checked: Set<ISODate>, today: ISODate): Streak {
  let current = 0;
  let cursor = today;
  if (isScheduled(habit, today) && !checked.has(today)) cursor = addDays(today, -1);
  while (cursor >= habit.startDate) {
    if (isScheduled(habit, cursor)) {
      if (!checked.has(cursor)) break;
      current++;
    }
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  if (habit.startDate <= today) {
    for (const d of dateRange(habit.startDate, today)) {
      if (!isScheduled(habit, d)) continue;
      if (checked.has(d)) {
        run++;
        longest = Math.max(longest, run);
      } else if (d !== today) {
        run = 0;
      }
    }
  }
  return { current, longest: Math.max(longest, current) };
}

/** Anteil erledigter geplanter Habit-Tage im Zeitraum (0–1) oder null, wenn nichts geplant war. */
export function habitRate(
  habits: Pick<Habit, 'id' | 'schedule' | 'startDate'>[],
  checks: { habitId: string; date: ISODate }[],
  from: ISODate,
  to: ISODate,
): number | null {
  const done = new Set(checks.map((c) => `${c.habitId}|${c.date}`));
  let planned = 0;
  let hit = 0;
  for (const d of dateRange(from, to)) {
    for (const h of habits) {
      if (!isScheduled(h, d)) continue;
      planned++;
      if (done.has(`${h.id}|${d}`)) hit++;
    }
  }
  return planned === 0 ? null : hit / planned;
}

/** Erfüllungsgrad je Tag (0–1) für die Heatmap, null = nichts geplant. */
export function dailyCompletion(
  habits: Pick<Habit, 'id' | 'schedule' | 'startDate'>[],
  checks: { habitId: string; date: ISODate }[],
  days: ISODate[],
): Map<ISODate, number | null> {
  const done = new Set(checks.map((c) => `${c.habitId}|${c.date}`));
  const out = new Map<ISODate, number | null>();
  for (const d of days) {
    const planned = habits.filter((h) => isScheduled(h, d));
    out.set(d, planned.length === 0 ? null : planned.filter((h) => done.has(`${h.id}|${d}`)).length / planned.length);
  }
  return out;
}

/** Heatmap-Stufe 0–4 aus einem Anteil. */
export function heatLevel(value: number | null): 0 | 1 | 2 | 3 | 4 {
  if (value === null || value <= 0) return 0;
  if (value < 0.34) return 1;
  if (value < 0.67) return 2;
  if (value < 1) return 3;
  return 4;
}

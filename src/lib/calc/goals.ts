import type { Goal, GoalMetric } from '../../db/schemas';
import { addDays, endOfMonth, startOfMonth, startOfWeek, type ISODate } from '../date';
import { periodSummary, type ReviewData } from './review';

export const GOAL_LABEL: Record<GoalMetric, { label: string; unit: string; lowerIsBetter?: boolean }> = {
  studyMin: { label: 'Lernzeit', unit: 'h' },
  gymSessions: { label: 'Gym-Einheiten', unit: '×' },
  trainingSessions: { label: 'Trainingseinheiten', unit: '×' },
  avgProtein: { label: 'Ø Protein', unit: 'g' },
  avgSleepH: { label: 'Ø Schlaf', unit: 'h' },
  avgSteps: { label: 'Ø Schritte', unit: '' },
  habitRate: { label: 'Habit-Quote', unit: '%' },
  abiAverage: { label: 'Abi-Schnitt', unit: '', lowerIsBetter: true },
};

export function goalRange(period: Goal['period'], today: ISODate): { from: ISODate; to: ISODate } {
  return period === 'week'
    ? { from: startOfWeek(today), to: addDays(startOfWeek(today), 6) }
    : { from: startOfMonth(today), to: endOfMonth(today) };
}

export interface GoalProgress {
  value: number | null;
  /** 0–1 (gedeckelt), bei „niedriger ist besser“ umgekehrt bewertet. */
  ratio: number;
  reached: boolean;
  /** Anzeige des Zielwerts in der Einheit der Kennzahl (Lernzeit in Stunden). */
  targetShown: number;
  valueShown: number | null;
}

/**
 * Fortschritt eines Ziels im laufenden Zeitraum. Summen (Lernzeit, Einheiten) wachsen über die Woche;
 * Durchschnitte (Protein, Schlaf, Schritte) zählen nur Tage mit Werten. Lernzeit-Ziele stehen in
 * Minuten in der Datenbank und werden in Stunden angezeigt.
 */
export function goalProgress(
  goal: Pick<Goal, 'metric' | 'period' | 'target'>,
  data: ReviewData,
  today: ISODate,
  abiAverage: number | null,
): GoalProgress {
  const { from } = goalRange(goal.period, today);
  const s = periodSummary(data, from, today);
  const inRange = data.sessions.filter((x) => x.date >= from && x.date <= today);
  const value: number | null = (() => {
    switch (goal.metric) {
      case 'studyMin':
        return s.studyMin;
      case 'gymSessions':
        return inRange.filter((x) => x.type === 'gym').length;
      case 'trainingSessions':
        return inRange.filter((x) => x.type !== 'recovery').length;
      case 'avgProtein':
        return s.proteinAvg;
      case 'avgSleepH':
        return s.sleepAvgMin === null ? null : s.sleepAvgMin / 60;
      case 'avgSteps':
        return s.stepsAvg;
      case 'habitRate':
        return s.habitRate === null ? null : s.habitRate * 100;
      case 'abiAverage':
        return abiAverage;
    }
  })();
  const lower = GOAL_LABEL[goal.metric].lowerIsBetter === true;
  const ratio =
    value === null || goal.target <= 0
      ? 0
      : lower
        ? Math.min(1, goal.target / Math.max(value, 0.01))
        : Math.min(1, value / goal.target);
  const reached = value !== null && (lower ? value <= goal.target : value >= goal.target);
  const toShown = (v: number) => (goal.metric === 'studyMin' ? v / 60 : v);
  return {
    value,
    ratio,
    reached,
    targetShown: toShown(goal.target),
    valueShown: value === null ? null : toShown(value),
  };
}

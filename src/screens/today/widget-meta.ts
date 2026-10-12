import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { DashboardWidgetId } from '../../db/schemas';
import { addDays, type ISODate } from '../../lib/date';

export const WIDGET_LABEL: Record<DashboardWidgetId, string> = {
  briefing: 'Tagesbriefing',
  ring: 'Tagesring',
  alerts: 'Hinweise & Fristen',
  deadlines: 'Nächste Termine',
  studyToday: 'Lernen heute',
  training: 'Training',
  nextMatch: 'Nächstes Spiel',
  steps: 'Schritte',
  sleep: 'Schlaf',
  nutrition: 'Ernährung',
  habits: 'Habits',
  mood: 'Stimmung & Energie',
  abi: 'Abi-Schnitt',
  goals: 'Ziele',
  journal: 'Tagesnotiz',
};

/** Widgets mit kompakter Variante (Größe „klein“ = halbe Breite). */
export const HAS_SMALL = new Set<DashboardWidgetId>(['ring', 'steps', 'sleep', 'nutrition', 'abi']);

/** Offene Fristen, die überfällig oder in ≤ 2 Tagen fällig sind. */
export function useCriticalCount(today: ISODate): number {
  return (
    useLiveQuery(
      async () => (await db.deadlines.where('date').belowOrEqual(addDays(today, 2)).toArray()).filter((d) => !d.done).length,
      [today],
    ) ?? 0
  );
}


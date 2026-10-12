import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { Deadline, Exam, Timer } from '../../db/schemas';
import { useKV } from '../../hooks/useSettings';
import { deadlineLevel } from '../../lib/calc/school';
import { addDays, type ISODate } from '../../lib/date';

export const DEADLINE_KIND_LABEL: Record<Deadline['kind'], string> = {
  einsendearbeit: 'Einsendearbeit',
  pruefung: 'Prüfung',
  sonstiges: 'Frist',
};

export const EXAM_KIND_LABEL: Record<Exam['kind'], string> = { klausur: 'Klausur', kurzarbeit: 'Kurzarbeit', ex: 'Ex', referat: 'Referat' };

/** Offene FernUni-Fristen bis 14 Tage voraus, inklusive überfälliger. */
export function useUrgentDeadlines(today: ISODate) {
  return useLiveQuery(async () => {
    const [rows, modules] = await Promise.all([db.deadlines.where('date').belowOrEqual(addDays(today, 14)).toArray(), db.modules.toArray()]);
    const names = new Map(modules.map((m) => [m.id, m.name]));
    return rows
      .filter((d) => !d.done)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, moduleName: names.get(d.moduleId) ?? 'Modul', level: deadlineLevel(d.date, today) }));
  }, [today]);
}

export function useTimer() {
  return useKV<Timer>('timer');
}

/** Sekunden → "m:ss" bzw. "h:mm:ss". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(h > 0 ? 2 : 1, '0')}:${String(sec).padStart(2, '0')}`;
}

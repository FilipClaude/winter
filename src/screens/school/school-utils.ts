import type { Exam, Timer } from '../../db/schemas';
import { useKV } from '../../hooks/useSettings';

export const EXAM_KIND_LABEL: Record<Exam['kind'], string> = { klausur: 'Klausur', kurzarbeit: 'Kurzarbeit', ex: 'Ex', referat: 'Referat' };

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

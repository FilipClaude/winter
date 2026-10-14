import { DEFAULT_NP_SCALE, type Exam, type MockExam } from '../../db/schemas';
import { diffDays, formatDayMonth, formatWeekdayShort, type ISODate } from '../date';

/** Anstehende, noch nicht bewertete Klausuren ab heute, chronologisch (gleicher Tag: zuerst angelegt). */
export function upcomingExams<T extends Pick<Exam, 'date' | 'points' | 'createdAt'>>(
  exams: T[],
  today: ISODate,
): T[] {
  return exams
    .filter((e) => e.date >= today && e.points === undefined)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/** Höchstens so viele Tage nach der nächsten gilt die übernächste Klausur als „dicht dahinter“. */
export const CLOSE_EXAM_DAYS = 7;

/**
 * Die nächste Klausur groß, die übernächste klein darunter – aber nur, wenn sie am selben Tag oder dicht
 * dahinter liegt (≤ 7 Tage). Erwartet die Liste aus `upcomingExams`.
 */
export function pickNextExams<T extends Pick<Exam, 'date'>>(
  upcoming: T[],
): { next: T | null; also: T | null } {
  const [next, second] = upcoming;
  if (!next) return { next: null, also: null };
  return { next, also: second && diffDays(next.date, second.date) <= CLOSE_EXAM_DAYS ? second : null };
}

/** „heute“, „morgen“, „in 5 Tagen“ (Kalendertage in Berliner Zeit). */
export function examCountdown(date: ISODate, today: ISODate): string {
  const d = diffDays(today, date);
  if (d <= 0) return 'heute';
  if (d === 1) return 'morgen';
  return `in ${d} Tagen`;
}

/** „Do, 16.10.“ */
export function formatExamDay(date: ISODate): string {
  return `${formatWeekdayShort(date)}, ${formatDayMonth(date)}`;
}

// ---------- Probe-Klausuren ----------

/** Erreichte BE in Prozent (0–100), auf eine Nachkommastelle gerundet. */
export function mockPercent(m: Pick<MockExam, 'points' | 'maxPoints'>): number {
  if (m.maxPoints <= 0) return 0;
  return Math.round((Math.min(m.points, m.maxPoints) / m.maxPoints) * 1000) / 10;
}

/**
 * Prozent → geschätzte Notenpunkte nach der Tabelle (Mindestprozent für 15, 14, …, 1 Punkt).
 * Unter der letzten Schwelle 0 Punkte. Nur eine Schätzung – der Schlüssel der Schule kann abweichen.
 */
export function percentToPoints(percent: number, scale: readonly number[] = DEFAULT_NP_SCALE): number {
  const i = scale.findIndex((min) => percent >= min);
  return i < 0 ? 0 : 15 - i;
}

export interface MockResult {
  id: string;
  date: ISODate;
  examId: string;
  subjectId: string;
  percent: number;
  points: number;
}

/** Probe-Durchgänge mit Prozent und geschätzten Punkten, chronologisch. */
export function mockResults(
  mocks: Pick<MockExam, 'id' | 'date' | 'examId' | 'subjectId' | 'points' | 'maxPoints' | 'createdAt'>[],
  scale: readonly number[] = DEFAULT_NP_SCALE,
): MockResult[] {
  return [...mocks]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((m) => {
      const percent = mockPercent(m);
      const exact = m.maxPoints > 0 ? (Math.min(m.points, m.maxPoints) / m.maxPoints) * 100 : 0;
      return {
        id: m.id,
        date: m.date,
        examId: m.examId,
        subjectId: m.subjectId,
        percent,
        // Schwelle am ungerundeten Wert prüfen: 14,5/44 BE = 32,95 % sind 2 P, nicht 3 (Review-2-Fund)
        points: percentToPoints(exact, scale),
      };
    });
}

/** Letzter Probe-Durchgang einer Klausur (oder undefined). */
export function lastMock(results: MockResult[], examId: string): MockResult | undefined {
  return results.filter((r) => r.examId === examId).at(-1);
}

/**
 * Trend eines Verlaufs: Unterschied der geschätzten Punkte zwischen erstem und letztem Durchgang
 * (null bei weniger als zwei Durchgängen).
 */
export function mockTrend(results: MockResult[]): number | null {
  const first = results[0];
  const last = results.at(-1);
  return results.length < 2 || !first || !last ? null : last.points - first.points;
}

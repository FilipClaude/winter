import { addDays, diffDays, startOfWeek, type ISODate } from '../date';
import type { StudySession } from '../../db/schemas';

/** Durchschnitt der Oberstufen-Punkte (0–15), eine Nachkommastelle. Leere Liste → null. */
export function pointsAverage(points: number[]): number | null {
  const valid = points.filter((p) => Number.isInteger(p) && p >= 0 && p <= 15);
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

/** Punkte → Note mit Tendenz (15 = 1+, 14 = 1, 13 = 1−, …, 1 = 5−, 0 = 6). */
export function pointsToGrade(points: number): string {
  const p = Math.round(points);
  if (p <= 0) return '6';
  if (p > 15) return '1+';
  const grade = Math.ceil((16 - p) / 3);
  const tendency = (p - 1) % 3; // 2 → +, 1 → glatt, 0 → −
  return `${grade}${tendency === 2 ? '+' : tendency === 0 ? '−' : ''}`;
}

/** Punkte-Schnitt → Notenschnitt nach der KMK-Formel (17 − P) / 3, z. B. 11,0 P → 2,0. */
export function pointsToDecimalGrade(points: number): number {
  return Math.round(Math.min(6, Math.max(0.7, (17 - points) / 3)) * 10) / 10;
}

export type DeadlineLevel = 'ueberfaellig' | 'kritisch' | 'nah' | 'bald' | 'spaeter';

/** Warnstufen für Fristen: ≤ 2 Tage kritisch, ≤ 7 nah, ≤ 14 bald. */
export function deadlineLevel(due: ISODate, today: ISODate): DeadlineLevel {
  const d = diffDays(today, due);
  if (d < 0) return 'ueberfaellig';
  if (d <= 2) return 'kritisch';
  if (d <= 7) return 'nah';
  if (d <= 14) return 'bald';
  return 'spaeter';
}

export function countdownLabel(due: ISODate, today: ISODate): string {
  const d = diffDays(today, due);
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d === -1) return 'seit gestern überfällig';
  if (d < 0) return `seit ${-d} Tagen überfällig`;
  return `in ${d} Tagen`;
}

export function studyMinutesOn(sessions: Pick<StudySession, 'date' | 'minutes'>[], date: ISODate): number {
  return sessions.filter((s) => s.date === date).reduce((a, s) => a + s.minutes, 0);
}

export function studyMinutesInRange(
  sessions: Pick<StudySession, 'date' | 'minutes'>[],
  from: ISODate,
  to: ISODate,
): number {
  return sessions.filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + s.minutes, 0);
}

export function studyMinutesThisWeek(
  sessions: Pick<StudySession, 'date' | 'minutes'>[],
  today: ISODate,
): number {
  return studyMinutesInRange(sessions, startOfWeek(today), today);
}

export function studyBySubject(sessions: Pick<StudySession, 'subjectId' | 'minutes'>[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(s.subjectId, (m.get(s.subjectId) ?? 0) + s.minutes);
  return m;
}

/** Lernminuten eines Fachs in den `days` Tagen vor einem Termin (Termintag ausgeschlossen). */
export function studyBefore(
  sessions: Pick<StudySession, 'subjectId' | 'date' | 'minutes'>[],
  subjectId: string,
  date: ISODate,
  days = 14,
): number {
  return studyMinutesInRange(
    sessions.filter((s) => s.subjectId === subjectId),
    addDays(date, -days),
    addDays(date, -1),
  );
}

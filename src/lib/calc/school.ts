import { addDays, diffDays, type ISODate } from '../date';
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

/** Themenstand einer Klausur: aus der Checkliste (Stufe ≥ 2 = „sitzt“), sonst null. */
export function topicStatus(
  topicList: { level: number }[] | undefined,
): { done: number; total: number } | null {
  if (!topicList || topicList.length === 0) return null;
  return { done: topicList.filter((t) => t.level >= 2).length, total: topicList.length };
}

export interface SchoolAlert {
  id: string;
  /** warn = heute/morgen bzw. überfällig, sonst ruhiger Hinweis. */
  tone: 'warn' | 'accent';
  text: string;
  examId?: string;
}

/**
 * Schul-Hinweise für „Heute“ (v3, ersetzt die FernUni-Fristen): Klausuren in den nächsten 3 Tagen mit
 * offenen Themen (bzw. ohne Checkliste unter 60 % Lernstand) und überfällige Aufgaben.
 */
export function schoolAlerts(input: {
  today: ISODate;
  exams: {
    id: string;
    subject: string;
    kind: string;
    date: ISODate;
    progress: number;
    topicList?: { level: number }[] | undefined;
  }[];
  overdueTodos: number;
}): SchoolAlert[] {
  const out: SchoolAlert[] = [];
  const exams = input.exams
    .map((e) => ({ ...e, days: diffDays(input.today, e.date) }))
    .filter((e) => e.days >= 0 && e.days <= 3)
    .sort((a, b) => a.days - b.days || a.subject.localeCompare(b.subject));
  for (const e of exams) {
    const t = topicStatus(e.topicList);
    const open = t ? t.total - t.done : null;
    if (open === 0 || (open === null && e.progress >= 60)) continue;
    const when = e.days === 0 ? 'heute' : e.days === 1 ? 'morgen' : `in ${e.days} Tagen`;
    out.push({
      id: `exam-${e.id}`,
      examId: e.id,
      tone: e.days <= 1 ? 'warn' : 'accent',
      text:
        t && open !== null
          ? `${e.subject}-${e.kind} ${when} – ${open} von ${t.total} ${t.total === 1 ? 'Thema' : 'Themen'} noch offen.`
          : `${e.subject}-${e.kind} ${when} – Lernstand erst ${e.progress} %.`,
    });
  }
  if (input.overdueTodos > 0)
    out.push({
      id: 'todos',
      tone: 'warn',
      text: `${input.overdueTodos} ${input.overdueTodos === 1 ? 'Aufgabe ist' : 'Aufgaben sind'} überfällig.`,
    });
  return out;
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

export function studyBySubject(sessions: Pick<StudySession, 'subjectId' | 'minutes'>[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(s.subjectId, (m.get(s.subjectId) ?? 0) + s.minutes);
  return m;
}

/**
 * Pomodoro-Stand nach `elapsedSec` Sekunden: aktuelle Phase, Restzeit der Phase, abgeschlossene
 * Fokusrunden und bisherige Fokuszeit (Pausen zählen nicht als Lernzeit).
 */
export function pomodoroState(elapsedSec: number, workMin: number, breakMin: number) {
  const work = workMin * 60;
  const cycle = (workMin + breakMin) * 60;
  const e = Math.max(0, elapsedSec);
  const rounds = Math.floor(e / cycle);
  const inCycle = e - rounds * cycle;
  const focus = inCycle < work;
  return {
    phase: focus ? ('fokus' as const) : ('pause' as const),
    remainingSec: focus ? work - inCycle : cycle - inCycle,
    round: rounds + 1,
    focusSec: rounds * work + Math.min(inCycle, work),
  };
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

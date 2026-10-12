import type { ISODate } from '../date';
import { diffDays } from '../date';

/**
 * Tagesbriefing: ein bis zwei Sätze, regelbasiert (keine KI, kein Netz). Reihenfolge nach Dringlichkeit:
 * Fristen → Klausuren → heutiger Ablauf (Spiel/Training, Lerneinheiten) → schulfrei/Ferien → Ruhe.
 */
export interface BriefingInput {
  today: ISODate;
  deadlines: { title: string; module: string; date: ISODate }[];
  exams: { subject: string; kind: string; date: ISODate; progress: number }[];
  /** Geplantes bzw. erledigtes Training heute (Bezeichnungen). */
  training: { planned: string[]; done: number };
  match?: { opponent: string; time?: string; home: boolean } | undefined;
  studyBlocks: { open: number; minutes: number; subjects: string[] };
  schoolFree: string | null;
  nextBreak?: { name: string; inDays: number } | null;
  habitsOpen: number;
}

const when = (days: number) => (days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`);

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1] ?? ''}`;
}

export function buildBriefing(i: BriefingInput): string[] {
  const out: string[] = [];

  // 1) Fristen: überfällig oder ≤ 2 Tage
  const urgent = i.deadlines
    .map((d) => ({ ...d, days: diffDays(i.today, d.date) }))
    .filter((d) => d.days <= 2)
    .sort((a, b) => a.days - b.days);
  const firstUrgent = urgent[0];
  if (firstUrgent) {
    out.push(
      firstUrgent.days < 0
        ? `${firstUrgent.title} (${firstUrgent.module}) ist seit ${-firstUrgent.days} ${firstUrgent.days === -1 ? 'Tag' : 'Tagen'} überfällig.`
        : `${firstUrgent.title} (${firstUrgent.module}) ist ${when(firstUrgent.days)} fällig.`,
    );
  }

  // 2) Nächste Klausur innerhalb von 7 Tagen
  const exam = i.exams
    .map((e) => ({ ...e, days: diffDays(i.today, e.date) }))
    .filter((e) => e.days >= 0 && e.days <= 7)
    .sort((a, b) => a.days - b.days)[0];
  if (exam && out.length < 2) {
    out.push(`${exam.subject}-${exam.kind} ${when(exam.days)}, Lernstand ${exam.progress} %.`);
  }

  // 3) Heutiger Ablauf
  if (out.length < 2) {
    const parts: string[] = [];
    if (i.match)
      parts.push(
        `Spiel ${i.match.time ? `${i.match.time} ` : ''}${i.match.home ? 'gegen' : 'bei'} ${i.match.opponent}`,
      );
    else if (i.training.planned.length > 0 && i.training.done === 0) parts.push(list(i.training.planned));
    if (i.studyBlocks.open > 0) {
      const subj = [...new Set(i.studyBlocks.subjects)];
      parts.push(
        `${i.studyBlocks.open} ${i.studyBlocks.open === 1 ? 'Lerneinheit' : 'Lerneinheiten'}${subj.length > 0 ? ` ${list(subj)}` : ''} (${i.studyBlocks.minutes} min)`,
      );
    }
    if (parts.length > 0)
      out.push(`Heute ${parts.length === 2 ? `${parts[0]}, danach ${parts[1]}` : parts[0]}.`);
  }

  // 4) Schulfrei / nächste Ferien
  if (out.length < 2 && i.schoolFree && i.schoolFree !== 'Wochenende')
    out.push(`Schulfrei: ${i.schoolFree}.`);
  else if (out.length < 2 && i.nextBreak && i.nextBreak.inDays > 0 && i.nextBreak.inDays <= 7)
    out.push(`${i.nextBreak.name} ${when(i.nextBreak.inDays)}.`);

  // 5) Ruhiger Tag
  if (out.length === 0) {
    out.push(
      i.habitsOpen > 0
        ? `Heute nichts Dringendes – ${i.habitsOpen} ${i.habitsOpen === 1 ? 'Habit ist' : 'Habits sind'} noch offen.`
        : 'Heute nichts Dringendes.',
    );
  }
  return out.slice(0, 2);
}

import { addDays, dateRange, diffDays, type ISODate } from '../date';
import { isSchoolDay } from './calendar-by';

export interface PlanTopic {
  title: string;
  /** 0 offen, 1 angefangen, 2 sitzt, 3 wiederholt (wird nur noch in der Abschlusswiederholung geübt). */
  level: number;
}

export interface PlannedBlock {
  date: ISODate;
  topic: string;
  kind: 'lernen' | 'wiederholen';
  minutes: number;
}

export interface PlanOptions {
  /** Lernminuten an Schultagen (Standard 45). An schulfreien Tagen doppelt so viel. */
  minutesPerSchoolDay?: number;
  learnMinutes?: number;
  repeatMinutes?: number;
  /** Abstände der Wiederholungen nach dem ersten Lernen (Tage). */
  intervals?: number[];
}

export interface StudyPlan {
  blocks: PlannedBlock[];
  /** Tage, an denen die Kapazität trotz Verschiebens überschritten ist. */
  overbooked: ISODate[];
  warning: string | null;
}

/**
 * Lernplan mit verteilter Wiederholung (Spaced Repetition): Jedes nicht sichere Thema wird einmal
 * gelernt und danach nach 1, 3 und 7 Tagen wiederholt (sofern vor der Klausur). Am Tag vor der
 * Klausur gibt es eine Abschlusswiederholung aller Themen. Schwache Themen kommen zuerst dran.
 * Schulfreie Tage haben doppelte Kapazität; überzählige Einheiten rücken auf den nächsten Tag mit Platz.
 */
export function buildStudyPlan(
  examDate: ISODate,
  today: ISODate,
  topics: PlanTopic[],
  opts: PlanOptions = {},
): StudyPlan {
  const perDay = opts.minutesPerSchoolDay ?? 45;
  const learnMin = opts.learnMinutes ?? 30;
  const repeatMin = opts.repeatMinutes ?? 15;
  const intervals = opts.intervals ?? [1, 3, 7];
  const days = diffDays(today, examDate) > 0 ? dateRange(today, addDays(examDate, -1)) : [];
  if (days.length === 0) return { blocks: [], overbooked: [], warning: 'Die Klausur ist heute oder vorbei.' };
  const open = topics.filter((t) => t.title.trim() && t.level < 3).sort((a, b) => a.level - b.level);
  const all = topics.filter((t) => t.title.trim());
  if (all.length === 0) return { blocks: [], overbooked: [], warning: 'Erst Themen eintragen.' };

  const last = days.length - 1;
  // Lernen auf die Tage vor der Abschlusswiederholung verteilen (bei nur einem Tag: alles an diesem Tag).
  const learnSpan = Math.max(1, last);
  const raw: PlannedBlock[] = [];
  open.forEach((t, i) => {
    const d = Math.min(last, Math.floor((i * learnSpan) / Math.max(1, open.length)));
    if (t.level === 0 || t.level === 1)
      raw.push({
        date: days[d] ?? today,
        topic: t.title,
        kind: 'lernen',
        minutes: t.level === 0 ? learnMin : Math.round(learnMin * 0.66),
      });
    for (const gap of intervals) {
      const r = d + gap;
      if (r < last)
        raw.push({ date: days[r] ?? today, topic: t.title, kind: 'wiederholen', minutes: repeatMin });
    }
  });
  raw.push({
    date: days[last] ?? today,
    topic: 'Abschlusswiederholung: ' + all.map((t) => t.title).join(', '),
    kind: 'wiederholen',
    minutes: Math.max(20, Math.min(120, all.length * 10)),
  });

  // Kapazität: überzählige Einheiten (außer der Abschlusswiederholung) auf den nächsten freien Tag.
  const capacity = (d: ISODate) => (isSchoolDay(d) ? perDay : perDay * 2);
  const used = new Map<ISODate, number>();
  const blocks: PlannedBlock[] = [];
  const order = [...raw].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === 'lernen' ? -1 : 1));
  // Je Thema: frühester erlaubter Tag. Wird das Lernen wegen voller Tage verschoben, rücken die
  // Wiederholungen mit – eine Wiederholung vor dem Lernen ergäbe keinen Sinn (Review-Fund).
  const earliest = new Map<string, number>();
  for (const b of order) {
    const isFinal = b.topic.startsWith('Abschlusswiederholung');
    let idx = Math.max(days.indexOf(b.date), isFinal ? 0 : (earliest.get(b.topic) ?? 0));
    idx = Math.min(idx, last);
    while (
      !isFinal &&
      idx < last &&
      (used.get(days[idx] ?? '') ?? 0) + b.minutes > capacity(days[idx] ?? today)
    )
      idx++;
    const date = days[idx] ?? b.date;
    used.set(date, (used.get(date) ?? 0) + b.minutes);
    blocks.push({ ...b, date });
    // Nächste Einheit desselben Themas frühestens am Folgetag (Abschlusswiederholung ausgenommen).
    if (!isFinal) earliest.set(b.topic, Math.min(last, idx + 1));
  }
  const overbooked = [...used.entries()].filter(([d, m]) => m > capacity(d)).map(([d]) => d);
  return {
    blocks: blocks.sort((a, b) => a.date.localeCompare(b.date)),
    overbooked,
    warning:
      overbooked.length > 0
        ? `An ${overbooked.length} Tag(en) mehr als geplant – früher anfangen oder Themen kürzen.`
        : null,
  };
}

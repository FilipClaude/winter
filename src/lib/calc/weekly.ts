import type { Goal } from '../../db/schemas';
import { addDays, formatDE, formatWeekdayShort, isoWeekNumber, startOfWeek, type ISODate } from '../date';
import { GOAL_LABEL, goalProgress } from './goals';
import { formatDecimal } from './insights';
import { splitCounts, splitSummary } from './training';
import { dailySeries, periodSummary, type ReviewData } from './review';

export interface Kpi {
  key: string;
  label: string;
  unit: string;
  value: number | null;
  prev: number | null;
  /** Veränderung gegenüber der Vorwoche (gleiche Einheit), null ohne Vergleich. */
  delta: number | null;
  higherIsBetter: boolean;
  digits: number;
}

export interface WeeklyReport {
  weekStart: ISODate;
  weekEnd: ISODate;
  kw: number;
  /** Fertig ab Sonntag (letzter Tag der Woche erreicht). */
  complete: boolean;
  kpis: Kpi[];
  highlights: string[];
  outliers: string[];
  goals: { label: string; reached: boolean; value: string; target: string }[];
  empty: boolean;
}

const r1 = (n: number | null, d = 1) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/**
 * Wochenbericht (Mo–So) mit Kennzahlen gegen die Vorwoche, Highlights (beste Tage, Spiele, Noten),
 * Ausreißern (Werte weit weg vom Wochenschnitt) und erreichten/verfehlten Wochenzielen.
 */
export function weeklyReport(
  data: ReviewData,
  anyDay: ISODate,
  today: ISODate,
  goals: Pick<Goal, 'metric' | 'period' | 'target' | 'archived'>[] = [],
  abiAverage: number | null = null,
): WeeklyReport {
  const weekStart = startOfWeek(anyDay);
  const weekEnd = addDays(weekStart, 6);
  // Laufende Woche nur bis heute rechnen und mit denselben Wochentagen der Vorwoche vergleichen –
  // sonst zählen künftige Tage als „nicht erledigt“ (Review-Fund: Habit-Quote am Mittwoch ≤ 43 %).
  const until = weekEnd > today ? today : weekEnd;
  const span = Math.max(0, Math.round((Date.parse(until) - Date.parse(weekStart)) / 86_400_000));
  const prevStart = addDays(weekStart, -7);
  const s = periodSummary(data, weekStart, until);
  const p = periodSummary(data, prevStart, addDays(prevStart, span));
  const kpi = (
    key: string,
    label: string,
    unit: string,
    v: number | null,
    pv: number | null,
    higherIsBetter = true,
    digits = 1,
  ): Kpi => ({
    key,
    label,
    unit,
    value: r1(v, digits),
    prev: r1(pv, digits),
    delta: v === null || pv === null ? null : r1(v - pv, digits),
    higherIsBetter,
    digits,
  });
  const kpis: Kpi[] = [
    kpi('study', 'Lernzeit', 'h', s.studyMin / 60, p.studyMin / 60),
    kpi('sessions', 'Einheiten', '', s.sessions, p.sessions, true, 0),
    kpi('load', 'Trainingslast', 'Load', s.load, p.load, true, 0),
    kpi(
      'sleep',
      'Ø Schlaf',
      'h',
      s.sleepAvgMin === null ? null : s.sleepAvgMin / 60,
      p.sleepAvgMin === null ? null : p.sleepAvgMin / 60,
    ),
    kpi('steps', 'Ø Schritte', '', s.stepsAvg, p.stepsAvg, true, 0),
    kpi(
      'habits',
      'Habit-Quote',
      '%',
      s.habitRate === null ? null : s.habitRate * 100,
      p.habitRate === null ? null : p.habitRate * 100,
      true,
      0,
    ),
    kpi('mood', 'Ø Stimmung', '', s.moodAvg, p.moodAvg),
  ];

  const series = dailySeries(data, weekStart, weekEnd > today ? today : weekEnd);
  const highlights: string[] = [];
  const bestStudy = [...series].sort((a, b) => b.studyMin - a.studyMin)[0];
  if (bestStudy && bestStudy.studyMin >= 60)
    highlights.push(
      `Meiste Lernzeit am ${formatWeekdayShort(bestStudy.date)}: ${formatDecimal(bestStudy.studyMin / 60, 1)} h.`,
    );
  const matches = data.sessions.filter(
    (x) => x.type === 'match' && x.date >= weekStart && x.date <= weekEnd && x.match,
  );
  for (const m of matches) {
    const mm = m.match;
    if (!mm) continue;
    highlights.push(
      `Spiel gegen ${mm.opponent} ${mm.goalsFor}:${mm.goalsAgainst}${mm.goals > 0 ? `, ${mm.goals} ${mm.goals === 1 ? 'Tor' : 'Tore'}` : ''}${mm.assists > 0 ? `, ${mm.assists} Assist${mm.assists === 1 ? '' : 's'}` : ''}.`,
    );
  }
  const splits = splitSummary(
    splitCounts(data.sessions.filter((x) => x.date >= weekStart && x.date <= weekEnd)),
  );
  if (splits) highlights.push(`Gym: ${splits}.`);
  for (const e of data.exams.filter(
    (x) => x.points !== undefined && x.date >= weekStart && x.date <= weekEnd,
  ))
    highlights.push(`Klausur vom ${formatDE(e.date).slice(0, 6)}: ${e.points} Punkte.`);
  const bestMood = series.filter((d) => d.mood !== null).sort((a, b) => (b.mood ?? 0) - (a.mood ?? 0))[0];
  if (bestMood && (bestMood.mood ?? 0) >= 4)
    highlights.push(`Beste Stimmung am ${formatWeekdayShort(bestMood.date)} (${bestMood.mood}/5).`);

  // Ausreißer: Schlaf unter 6 h oder über 10 h, Tage mit sehr hoher Last (> 2× Wochenschnitt)
  const outliers: string[] = [];
  for (const d of series) {
    if (d.sleepMin !== null && d.sleepMin < 360)
      outliers.push(
        `Wenig Schlaf vor ${formatWeekdayShort(d.date)}: ${formatDecimal(d.sleepMin / 60, 1)} h.`,
      );
    if (d.sleepMin !== null && d.sleepMin > 600)
      outliers.push(
        `Sehr langer Schlaf vor ${formatWeekdayShort(d.date)}: ${formatDecimal(d.sleepMin / 60, 1)} h.`,
      );
  }
  const trainDays = series.filter((d) => d.load > 0);
  const avgLoad = trainDays.length > 0 ? trainDays.reduce((a, d) => a + d.load, 0) / trainDays.length : 0;
  for (const d of trainDays)
    if (trainDays.length >= 3 && d.load > 2 * avgLoad)
      outliers.push(`Sehr hohe Last am ${formatWeekdayShort(d.date)}: ${d.load}.`);

  const goalRows = goals
    // Abi-Ziel nur mit bekanntem Schnitt – sonst stünde es immer auf „–“ (Review-Fund)
    .filter(
      (g) =>
        !g.archived &&
        g.metric !== 'avgProtein' &&
        g.period === 'week' &&
        (g.metric !== 'abiAverage' || abiAverage !== null),
    )
    .map((g) => {
      const pr = goalProgress(g, data, weekEnd > today ? today : weekEnd, abiAverage);
      const meta = GOAL_LABEL[g.metric];
      const d =
        g.metric === 'avgSteps' || g.metric === 'gymSessions' || g.metric === 'trainingSessions' ? 0 : 1;
      return {
        label: meta.label,
        reached: pr.reached,
        value: `${formatDecimal(pr.valueShown, d)}${meta.unit ? ` ${meta.unit}` : ''}`,
        target: `${meta.lowerIsBetter ? '≤ ' : ''}${formatDecimal(pr.targetShown, d)}${meta.unit ? ` ${meta.unit}` : ''}`,
      };
    });

  const empty = series.every(
    (d) => d.studyMin === 0 && d.load === 0 && d.sleepMin === null && d.mood === null && d.steps === null,
  );
  return {
    weekStart,
    weekEnd,
    kw: isoWeekNumber(weekStart),
    complete: today >= weekEnd,
    kpis,
    highlights,
    outliers,
    goals: goalRows,
    empty,
  };
}

const arrow = (k: Kpi) => (k.delta === null || k.delta === 0 ? '→' : k.delta > 0 ? '↑' : '↓');
const fmtK = (v: number | null, k: Kpi) =>
  v === null ? '–' : `${formatDecimal(v, k.digits)}${k.unit ? ` ${k.unit}` : ''}`;

/** Wochenbericht als Markdown für den Obsidian-Vault (Frontmatter `datum`, `tags: [wochenbericht]`). */
export function weeklyMarkdown(r: WeeklyReport): string {
  const lines = [
    '---',
    `datum: ${r.weekEnd}`,
    `kw: ${r.kw}`,
    'tags: [wochenbericht]',
    '---',
    `# Wochenbericht KW ${r.kw} (${formatDE(r.weekStart)} – ${formatDE(r.weekEnd)})`,
    '',
    '## Kennzahlen (gegen Vorwoche)',
    '',
    '| Kennzahl | Woche | Vorwoche | |',
    '|---|---|---|---|',
    ...r.kpis.map((k) => `| ${k.label} | ${fmtK(k.value, k)} | ${fmtK(k.prev, k)} | ${arrow(k)} |`),
    '',
  ];
  if (r.highlights.length > 0) lines.push('## Highlights', '', ...r.highlights.map((h) => `- ${h}`), '');
  if (r.outliers.length > 0) lines.push('## Ausreißer', '', ...r.outliers.map((o) => `- ${o}`), '');
  if (r.goals.length > 0)
    lines.push(
      '## Ziele',
      '',
      ...r.goals.map((g) => `- [${g.reached ? 'x' : ' '}] ${g.label}: ${g.value} von ${g.target}`),
      '',
    );
  lines.push('_Erstellt mit Winter. Gegenüberstellungen, keine Ursachen._', '');
  return lines.join('\n');
}

export function weeklyFileName(r: WeeklyReport): string {
  // Jahr der ISO-Woche = Jahr ihres Donnerstags (KW 1 kann im Dezember beginnen – v1-Fund)
  return `Wochenbericht-${addDays(r.weekStart, 3).slice(0, 4)}-KW${String(r.kw).padStart(2, '0')}.md`;
}

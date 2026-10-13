import type {
  Day,
  Earning,
  Exam,
  Habit,
  HabitCheck,
  HealthDay,
  Meal,
  Session,
  Sleep,
  StudySession,
} from '../../db/schemas';
import { addDays, dateRange, type ISODate } from '../date';
import { habitRate } from './habits';
import { compareByThreshold, describeCorrelation, formatDecimal, median, pearson } from './insights';
import { studyBefore } from './school';
import { effectiveSleep } from './sleep';
import { sessionLoad } from './training';

export interface ReviewData {
  sessions: Session[];
  meals: Meal[];
  days: Day[];
  sleep: Sleep[];
  health: HealthDay[];
  study: StudySession[];
  exams: Exam[];
  habits: Habit[];
  checks: HabitCheck[];
  /** v3 */
  earnings: Earning[];
}

export interface DayPoint {
  date: ISODate;
  studyMin: number;
  load: number;
  sleepMin: number | null;
  proteinG: number | null;
  mood: number | null;
  energy: number | null;
  steps: number | null;
}

/** Tageswerte für einen Zeitraum (inklusive). Fehlende Werte = null, nicht 0. */
export function dailySeries(data: ReviewData, from: ISODate, to: ISODate): DayPoint[] {
  const byDate = <T extends { date: ISODate }>(rows: T[]) => {
    const m = new Map<ISODate, T[]>();
    for (const r of rows) m.set(r.date, [...(m.get(r.date) ?? []), r]);
    return m;
  };
  const sessions = byDate(data.sessions);
  const meals = byDate(data.meals);
  const study = byDate(data.study);
  const days = new Map(data.days.map((d) => [d.date, d]));
  const sleep = new Map(data.sleep.map((s) => [s.date, s]));
  const health = new Map(data.health.map((h) => [h.date, h]));
  return dateRange(from, to).map((date) => {
    const day = days.get(date);
    const dayMeals = meals.get(date) ?? [];
    return {
      date,
      studyMin: (study.get(date) ?? []).reduce((a, s) => a + s.minutes, 0),
      load: (sessions.get(date) ?? []).reduce((a, s) => a + sessionLoad(s.durationMin, s.rpe), 0),
      sleepMin: effectiveSleep(sleep.get(date), health.get(date))?.minutes ?? null,
      proteinG: dayMeals.length > 0 ? dayMeals.reduce((a, m) => a + m.proteinG, 0) : null,
      mood: day?.mood ?? null,
      energy: day?.energy ?? null,
      steps: health.get(date)?.steps ?? null,
    };
  });
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length === 0 ? null : v.reduce((a, b) => a + b, 0) / v.length;
};

export interface PeriodSummary {
  studyMin: number;
  load: number;
  sessions: number;
  sleepAvgMin: number | null;
  proteinAvg: number | null;
  habitRate: number | null;
  moodAvg: number | null;
  energyAvg: number | null;
  stepsAvg: number | null;
}

export function periodSummary(data: ReviewData, from: ISODate, to: ISODate): PeriodSummary {
  const series = dailySeries(data, from, to);
  return {
    studyMin: series.reduce((a, d) => a + d.studyMin, 0),
    load: series.reduce((a, d) => a + d.load, 0),
    sessions: data.sessions.filter((s) => s.date >= from && s.date <= to).length,
    sleepAvgMin: avg(series.map((d) => d.sleepMin)),
    proteinAvg: avg(series.map((d) => d.proteinG)),
    habitRate: habitRate(
      data.habits.filter((h) => !h.archived),
      data.checks,
      from,
      to,
    ),
    moodAvg: avg(series.map((d) => d.mood)),
    energyAvg: avg(series.map((d) => d.energy)),
    stepsAvg: avg(series.map((d) => d.steps)),
  };
}

export interface Insight {
  id: string;
  title: string;
  /** Klartext-Einordnung: belastbarer Zusammenhang oder ausdrücklich „noch kein belastbarer Zusammenhang“. */
  text: string;
  /** Belastbar: mindestens MIN_INSIGHT_N Datenpunkte und |r| ≥ MIN_INSIGHT_R. */
  enough: boolean;
  n: number;
  r: number | null;
  /** Gegenüberstellung der Mittelwerte (anschaulich), falls beide Gruppen genug Punkte haben. */
  detail?: string;
}

/** Mindestanzahl Datenpunkte für eine Aussage (Auftrag: unter 14 keine). */
export const MIN_INSIGHT_N = 14;
/** Ab hier gilt ein Zusammenhang als mehr als schwach. */
export const MIN_INSIGHT_R = 0.3;

/** Kritische t-Werte (zweiseitig, p < 0,05) nach Freiheitsgraden – genug Genauigkeit für die Einordnung. */
const T_CRIT: [number, number][] = [
  [10, 2.23],
  [12, 2.18],
  [15, 2.13],
  [20, 2.09],
  [25, 2.06],
  [30, 2.04],
  [40, 2.02],
  [60, 2.0],
  [120, 1.98],
];

/**
 * Ist r bei n Punkten signifikant von 0 verschieden (t-Test, p < 0,05)? Bei n = 14 braucht es
 * |r| ≥ 0,53, bei n = 30 ≥ 0,36 (Review-Fund: |r| ≥ 0,3 allein wäre oft Zufall).
 */
export function significant(r: number, n: number): boolean {
  if (n < 3 || Math.abs(r) >= 1) return n >= 3;
  const df = n - 2;
  const t = Math.abs(r) * Math.sqrt(df / (1 - r * r));
  // Größter Tabelleneintrag ≤ df: kleinere Freiheitsgrade haben größere kritische Werte – so wird nie zu
  // großzügig gerundet (Review-4-Fund). Unter 10 Freiheitsgraden (n < 12) gilt ohnehin MIN_INSIGHT_N.
  const crit = [...T_CRIT].reverse().find(([d]) => d <= df)?.[1] ?? 2.23;
  return t >= crit;
}

const fmt1 = (n: number | null) => formatDecimal(n, 1);
const fmtR = (r: number) => r.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function correlationInsight(
  id: string,
  title: string,
  pairs: [number, number][],
  wording: { up: string; down: string },
  comparison?: string,
): Insight {
  const n = pairs.length;
  const r = pearson(pairs);
  const enough = n >= MIN_INSIGHT_N && r !== null && Math.abs(r) >= MIN_INSIGHT_R && significant(r, n);
  let text: string;
  if (n < MIN_INSIGHT_N)
    text = `Noch kein belastbarer Zusammenhang – erst ${n} von mindestens ${MIN_INSIGHT_N} Datenpunkten.`;
  else if (r === null) text = `Noch kein belastbarer Zusammenhang – die Werte schwanken kaum (n = ${n}).`;
  else if (!enough)
    text = `Noch kein belastbarer Zusammenhang: ${describeCorrelation(r, n)} (r = ${fmtR(r)}, n = ${n})${Math.abs(r) >= MIN_INSIGHT_R ? ' – bei so wenigen Punkten noch gut mit Zufall erklärbar' : ''}.`;
  else
    text = `${describeCorrelation(r, n).replace(/^./, (c) => c.toUpperCase())} (r = ${fmtR(r)}, n = ${n}): ${r > 0 ? wording.up : wording.down}`;
  return { id, title, n, r, enough, text, ...(comparison ? { detail: comparison } : {}) };
}

/**
 * Zusammenhänge über die letzten `days` Tage mit Pearson-r, Anzahl und Klartext. Unter 14 Punkten oder
 * bei |r| < 0,3 steht ausdrücklich „noch kein belastbarer Zusammenhang“. Keine Kausalaussagen.
 */
export function buildInsights(data: ReviewData, today: ISODate, days = 90): Insight[] {
  const from = addDays(today, -days + 1);
  const series = dailySeries(data, from, today);
  const out: Insight[] = [];

  // 1) Schlaf (Nacht vor dem Tag) ↔ Stimmung am selben Tag
  const sleepMood = series
    .filter((d) => d.sleepMin !== null && d.mood !== null)
    .map((d) => [(d.sleepMin ?? 0) / 60, d.mood ?? 0] as [number, number]);
  const c1 = compareByThreshold(sleepMood, 7.5);
  out.push(
    correlationInsight(
      'schlaf-stimmung',
      'Schlaf und Stimmung',
      sleepMood,
      {
        up: 'Nach mehr Schlaf war deine Stimmung eher besser.',
        down: 'Nach mehr Schlaf war deine Stimmung eher schlechter.',
      },
      c1.enough
        ? `Nach mehr als 7,5 h Schlaf lag deine Stimmung im Schnitt bei ${fmt1(c1.meanHigh)}, nach 7,5 h oder weniger bei ${fmt1(c1.meanLow)}.`
        : undefined,
    ),
  );

  // 2) Lernzeit in den 14 Tagen vor einer Klausur ↔ Punkte (alle bewerteten Klausuren)
  const examPairs = data.exams
    .filter((e) => e.points !== undefined)
    .map((e) => [studyBefore(data.study, e.subjectId, e.date, 14) / 60, e.points ?? 0] as [number, number]);
  const studyThreshold = median(examPairs.map(([h]) => h)) ?? 0;
  const c2 = compareByThreshold(examPairs, studyThreshold);
  out.push(
    correlationInsight(
      'lernen-note',
      'Lernzeit vor Klausuren und Punkte (alle Klausuren)',
      examPairs,
      {
        up: 'Mehr Lernzeit vorher ging mit mehr Punkten einher.',
        down: 'Mehr Lernzeit vorher ging mit weniger Punkten einher.',
      },
      c2.enough
        ? `Bei mehr als ${fmt1(studyThreshold)} h Lernzeit in den 14 Tagen davor lagen deine Klausuren im Schnitt bei ${fmt1(c2.meanHigh)} Punkten, sonst bei ${fmt1(c2.meanLow)}.`
        : undefined,
    ),
  );

  // 3) Trainingslast ↔ Energie am Folgetag
  const loadEnergy: [number, number][] = [];
  series.forEach((d, i) => {
    const next = series[i + 1];
    if (next && next.energy !== null) loadEnergy.push([d.load, next.energy]);
  });
  const threshold = median(loadEnergy.map(([l]) => l).filter((l) => l > 0)) ?? 0;
  const c3 = compareByThreshold(loadEnergy, threshold);
  out.push(
    correlationInsight(
      'last-energie',
      'Trainingslast und Energie am Folgetag',
      loadEnergy,
      {
        up: 'Nach härteren Tagen war deine Energie am Folgetag eher höher.',
        down: 'Nach härteren Tagen war deine Energie am Folgetag eher niedriger.',
      },
      c3.enough
        ? `Am Tag nach mehr als ${Math.round(threshold)} Load lag deine Energie im Schnitt bei ${fmt1(c3.meanHigh)}, sonst bei ${fmt1(c3.meanLow)}.`
        : undefined,
    ),
  );

  // 4) Schritte ↔ Schlaf in der Nacht danach (Schlaf zählt zum Aufwachtag = Folgetag)
  const stepsSleep: [number, number][] = [];
  series.forEach((d, i) => {
    const next = series[i + 1];
    if (d.steps !== null && next && next.sleepMin !== null)
      stepsSleep.push([d.steps / 1000, next.sleepMin / 60]);
  });
  out.push(
    correlationInsight('schritte-schlaf', 'Schritte und Schlaf danach', stepsSleep, {
      up: 'An bewegten Tagen hast du danach eher länger geschlafen.',
      down: 'An bewegten Tagen hast du danach eher kürzer geschlafen.',
    }),
  );

  return out;
}

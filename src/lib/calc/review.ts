import type {
  Day,
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
import {
  compareByThreshold,
  describeCorrelation,
  formatDecimal,
  median,
  MIN_PER_GROUP,
  pearson,
} from './insights';
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
  /** Ehrlich formulierte Aussage oder Hinweis auf zu wenig Daten. */
  text: string;
  enough: boolean;
  n: number;
  detail?: string;
}

const fmt1 = (n: number | null) => formatDecimal(n, 1);

/** Einfache Gegenüberstellungen über die letzten `days` Tage. Keine Kausalaussagen. */
export function buildInsights(data: ReviewData, today: ISODate, days = 90): Insight[] {
  const from = addDays(today, -days + 1);
  const series = dailySeries(data, from, today);
  const out: Insight[] = [];

  // 1) Schlaf (Nacht vor dem Tag) ↔ Stimmung am selben Tag
  const sleepMood = series
    .filter((d) => d.sleepMin !== null && d.mood !== null)
    .map((d) => [(d.sleepMin ?? 0) / 60, d.mood ?? 0] as [number, number]);
  const c1 = compareByThreshold(sleepMood, 7.5);
  out.push({
    id: 'schlaf-stimmung',
    title: 'Schlaf und Stimmung',
    n: sleepMood.length,
    enough: c1.enough,
    text: c1.enough
      ? `Nach mehr als 7,5 h Schlaf lag deine Stimmung im Schnitt bei ${fmt1(c1.meanHigh)}, nach 7,5 h oder weniger bei ${fmt1(c1.meanLow)}.`
      : `Zu wenig Datenpunkte: ${c1.nHigh} Tage über und ${c1.nLow} Tage bis 7,5 h Schlaf mit Stimmung. Nötig sind je ${MIN_PER_GROUP}.`,
    detail: `${describeCorrelation(pearson(sleepMood), sleepMood.length)} · n = ${sleepMood.length}`,
  });

  // 2) Trainingslast ↔ Energie am Folgetag
  const loadEnergy: [number, number][] = [];
  series.forEach((d, i) => {
    const next = series[i + 1];
    if (next && next.energy !== null) loadEnergy.push([d.load, next.energy]);
  });
  const trainedLoads = loadEnergy.map(([l]) => l).filter((l) => l > 0);
  const threshold = median(trainedLoads) ?? 0;
  const c2 = compareByThreshold(loadEnergy, threshold);
  out.push({
    id: 'last-energie',
    title: 'Trainingslast und Energie',
    n: loadEnergy.length,
    enough: c2.enough && trainedLoads.length >= MIN_PER_GROUP,
    text:
      c2.enough && trainedLoads.length >= MIN_PER_GROUP
        ? `Am Tag nach mehr als ${Math.round(threshold)} Load lag deine Energie im Schnitt bei ${fmt1(c2.meanHigh)}, sonst bei ${fmt1(c2.meanLow)}.`
        : `Zu wenig Datenpunkte: ${loadEnergy.length} Tage mit Energie-Eintrag am Folgetag, davon ${trainedLoads.length} nach Training.`,
    detail: `${describeCorrelation(pearson(loadEnergy), loadEnergy.length)} · n = ${loadEnergy.length}`,
  });

  // 3) Lernzeit in den 14 Tagen vor einer Klausur ↔ Punkte (alle bewerteten Klausuren)
  const examPairs = data.exams
    .filter((e) => e.points !== undefined)
    .map((e) => [studyBefore(data.study, e.subjectId, e.date, 14) / 60, e.points ?? 0] as [number, number]);
  const studyThreshold = median(examPairs.map(([h]) => h)) ?? 0;
  const c3 = compareByThreshold(examPairs, studyThreshold);
  out.push({
    id: 'lernen-note',
    title: 'Lernzeit vor Klausuren und Punkte',
    n: examPairs.length,
    enough: c3.enough,
    text: c3.enough
      ? `Bei mehr als ${fmt1(studyThreshold)} h Lernzeit in den 14 Tagen davor lagen deine Klausuren im Schnitt bei ${fmt1(c3.meanHigh)} Punkten, sonst bei ${fmt1(c3.meanLow)}.`
      : `Zu wenig bewertete Klausuren mit erfasster Lernzeit (${examPairs.length}). Nötig sind mindestens ${MIN_PER_GROUP * 2}.`,
    detail: `${describeCorrelation(pearson(examPairs), examPairs.length)} · n = ${examPairs.length}`,
  });

  return out;
}

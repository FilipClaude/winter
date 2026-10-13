import { addDays, dateRange, diffDays, startOfWeek, type ISODate } from '../date';
import type { DayPoint } from './review';

export type TrendMetric = 'studyMin' | 'load' | 'sleepMin' | 'mood' | 'energy' | 'steps';

export const TREND_LABEL: Record<
  TrendMetric,
  { label: string; unit: string; scale: (v: number) => number; digits: number }
> = {
  studyMin: { label: 'Lernzeit', unit: 'h', scale: (v) => v / 60, digits: 1 },
  load: { label: 'Trainingslast', unit: 'Load', scale: (v) => v, digits: 0 },
  sleepMin: { label: 'Schlaf', unit: 'h', scale: (v) => v / 60, digits: 1 },
  mood: { label: 'Stimmung', unit: '', scale: (v) => v, digits: 1 },
  energy: { label: 'Energie', unit: '', scale: (v) => v, digits: 1 },
  steps: { label: 'Schritte', unit: '', scale: (v) => v, digits: 0 },
};

/** Summen-Kennzahlen: ein Tag ohne Eintrag zählt als 0; bei den übrigen fehlt der Wert dann (null). */
const SUM_METRICS = new Set<TrendMetric>(['studyMin', 'load']);

export function metricValue(d: DayPoint, m: TrendMetric): number | null {
  const v = d[m];
  if (v === null) return SUM_METRICS.has(m) ? 0 : null;
  return v;
}

/**
 * Gleitender Durchschnitt über `window` Tage (inklusive des Tages selbst). Nur Tage mit Wert zählen;
 * es braucht mindestens die Hälfte des Fensters, sonst null (keine Scheingenauigkeit am Anfang).
 */
export function movingAverage(values: (number | null)[], window: number): (number | null)[] {
  const need = Math.ceil(window / 2);
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v !== null);
    if (slice.length < need) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/**
 * Jahres-Heatmap: 53 Wochenspalten (Mo oben) bis zur aktuellen Woche. Stufen 1–4 nach Quartilen der
 * vorhandenen Werte > 0, 0 = Tag ohne Wert/0, null = Zukunft.
 */
export function yearHeatmap(
  series: DayPoint[],
  metric: TrendMetric,
  today: ISODate,
): { date: ISODate; level: 0 | 1 | 2 | 3 | 4 | null; value: number | null }[][] {
  const byDate = new Map(series.map((d) => [d.date, metricValue(d, metric)]));
  const start = addDays(startOfWeek(today), -52 * 7);
  const days = dateRange(start, addDays(startOfWeek(today), 6));
  const positives = [...byDate.values()]
    .filter((v): v is number => v !== null && v > 0)
    .sort((a, b) => a - b);
  const q = (p: number) => positives[Math.floor(p * (positives.length - 1))] ?? 0;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (v: number | null): 0 | 1 | 2 | 3 | 4 => {
    if (v === null || v <= 0) return 0;
    if (v <= (cuts[0] ?? 0)) return 1;
    if (v <= (cuts[1] ?? 0)) return 2;
    if (v <= (cuts[2] ?? 0)) return 3;
    return 4;
  };
  const weeks: { date: ISODate; level: 0 | 1 | 2 | 3 | 4 | null; value: number | null }[][] = [];
  for (let w = 0; w < days.length / 7; w++) {
    weeks.push(
      days.slice(w * 7, w * 7 + 7).map((date) => {
        const value = byDate.get(date) ?? null;
        return { date, value, level: date > today ? null : level(value) };
      }),
    );
  }
  return weeks;
}

/** Vorheriger Zeitraum gleicher Länge (für freie Vergleiche). */
export function previousRange(from: ISODate, to: ISODate): { from: ISODate; to: ISODate } {
  const len = diffDays(from, to) + 1;
  return { from: addDays(from, -len), to: addDays(from, -1) };
}

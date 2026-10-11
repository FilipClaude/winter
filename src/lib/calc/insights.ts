/** Mindestanzahl Datenpunkte je Gruppe, bevor ein Vergleich formuliert wird. */
export const MIN_PER_GROUP = 4;

export interface GroupComparison {
  nHigh: number;
  nLow: number;
  meanHigh: number | null;
  meanLow: number | null;
  /** true, wenn beide Gruppen genug Punkte haben. */
  enough: boolean;
}

const mean = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

/**
 * Teilt Paare (x, y) an einer Schwelle von x und vergleicht die Mittelwerte von y.
 * Beispiel: x = Schlafstunden, y = Stimmung, Schwelle 7,5 h.
 */
export function compareByThreshold(pairs: [number, number][], threshold: number): GroupComparison {
  const high = pairs.filter(([x]) => x > threshold).map(([, y]) => y);
  const low = pairs.filter(([x]) => x <= threshold).map(([, y]) => y);
  return {
    nHigh: high.length,
    nLow: low.length,
    meanHigh: mean(high),
    meanLow: mean(low),
    enough: high.length >= MIN_PER_GROUP && low.length >= MIN_PER_GROUP,
  };
}

/** Median (für eine neutrale Schwelle, wenn keine sinnvolle feste existiert). */
export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2 : (s[mid] ?? 0);
}

/** Pearson-Korrelation; null bei weniger als 3 Punkten oder ohne Streuung. */
export function pearson(pairs: [number, number][]): number | null {
  if (pairs.length < 3) return null;
  const mx = mean(pairs.map(([x]) => x)) ?? 0;
  const my = mean(pairs.map(([, y]) => y)) ?? 0;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (const [x, y] of pairs) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

/** Ehrliche Einordnung der Stärke eines Zusammenhangs. */
export function describeCorrelation(r: number | null, n: number): string {
  if (r === null || n < 8) return 'zu wenig Daten für eine Aussage';
  const a = Math.abs(r);
  if (a < 0.2) return 'kein erkennbarer Zusammenhang';
  const strength = a < 0.4 ? 'schwacher' : a < 0.6 ? 'mäßiger' : 'deutlicher';
  return `${strength} ${r > 0 ? 'positiver' : 'negativer'} Zusammenhang`;
}

export function formatDecimal(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return '–';
  return n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

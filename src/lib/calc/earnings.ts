import type { Earning } from '../../db/schemas';
import { addDays, isoWeekNumber, startOfWeek, type ISODate } from '../date';

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const EUR_SHORT = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Cent → „47,50 €“ (de-DE). */
export function formatEuro(cents: number): string {
  return EUR.format(cents / 100);
}

/** Cent → „47,5 €“ bzw. „30 €“ – für Achsen und Zielwerte ohne unnötige Nullen. */
export function formatEuroShort(cents: number): string {
  return EUR_SHORT.format(cents / 100);
}

/**
 * Betrag in Euro (deutsche Eingabe) → Cent als Ganzzahl, ohne Gleitkomma-Fehler: „12,5“ → 1250,
 * „12,50 €“ → 1250, „1.234,56“ → 123456, „7“ → 700. Mehr als zwei Nachkommastellen werden kaufmännisch
 * gerundet („2,345“ → 235). Ein Punkt mit genau drei Ziffern danach gilt als Tausendertrennzeichen,
 * sonst als Komma („12.5“ → 1250). Ungültig oder negativ → null.
 */
export function parseEuroToCents(raw: string): number | null {
  let s = raw.trim().replace(/\s|€/g, '');
  if (s === '' || s.startsWith('-')) return null;
  if (s.includes(',')) s = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const euros = Number(m[1]);
  const frac = (m[2] ?? '').padEnd(3, '0');
  const cents = euros * 100 + Number(frac.slice(0, 2)) + (Number(frac[2]) >= 5 ? 1 : 0);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Montag–Sonntag der Woche, in der `date` liegt (Berliner Kalendertage). */
export function weekOf(date: ISODate): { from: ISODate; to: ISODate } {
  const from = startOfWeek(date);
  return { from, to: addDays(from, 6) };
}

/** Summe in Cent im Zeitraum (inklusive). */
export function sumCents(rows: Pick<Earning, 'date' | 'amountCents'>[], from: ISODate, to: ISODate): number {
  return rows.filter((r) => r.date >= from && r.date <= to).reduce((a, r) => a + r.amountCents, 0);
}

/** Wochensummen der letzten `n` Wochen bis einschließlich der Woche von `today` (älteste zuerst). */
export function weeklyTotals(
  rows: Pick<Earning, 'date' | 'amountCents'>[],
  today: ISODate,
  n = 8,
): { weekStart: ISODate; kw: number; cents: number }[] {
  const current = startOfWeek(today);
  return Array.from({ length: n }, (_, i) => {
    const weekStart = addDays(current, -7 * (n - 1 - i));
    return {
      weekStart,
      kw: isoWeekNumber(weekStart),
      cents: sumCents(rows, weekStart, addDays(weekStart, 6)),
    };
  });
}

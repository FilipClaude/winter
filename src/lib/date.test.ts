import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  diffDays,
  endOfMonth,
  formatHM,
  formatLong,
  formatMinutes,
  isISODate,
  isoWeekNumber,
  isoWeekday,
  splitAtMidnight,
  startOfWeek,
  toISODate,
  toTimeHM,
  zonedToInstant,
} from './date';

describe('Kalendertage in Europe/Berlin', () => {
  it('ordnet Zeitpunkte kurz nach Mitternacht dem neuen Berliner Tag zu', () => {
    // 22:30 UTC = 00:30 Sommerzeit am Folgetag
    expect(toISODate('2026-10-10T22:30:00Z')).toBe('2026-10-11');
    // 23:30 UTC im Winter = 00:30 MEZ
    expect(toISODate('2026-12-31T23:30:00Z')).toBe('2027-01-01');
    expect(toISODate('2026-10-10T21:59:00Z')).toBe('2026-10-10');
  });

  it('addDays überspringt Zeitumstellungen korrekt', () => {
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('diffDays und dateRange', () => {
    expect(diffDays('2026-10-01', '2026-10-31')).toBe(30);
    expect(diffDays('2026-10-31', '2026-10-01')).toBe(-30);
    expect(dateRange('2026-10-24', '2026-10-27')).toEqual(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
  });

  it('Wochentage, Wochenstart und KW', () => {
    expect(isoWeekday('2026-10-11')).toBe(7); // Sonntag
    expect(isoWeekday('2026-10-12')).toBe(1);
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05');
    expect(isoWeekNumber('2026-10-11')).toBe(41);
    expect(isoWeekNumber('2027-01-01')).toBe(53);
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28');
  });

  it('validiert Datumsstrings', () => {
    expect(isISODate('2026-10-11')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('11.10.2026')).toBe(false);
  });

  it('formatiert deutsch', () => {
    expect(formatLong('2026-10-11')).toBe('Sonntag, 11. Oktober');
    expect(formatMinutes(85)).toBe('1 h 25 min');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatHM(465)).toBe('7:45');
  });
});

describe('Wandzeit ↔ Zeitpunkt', () => {
  it('Sommer- und Winterzeit', () => {
    expect(zonedToInstant('2026-07-01', '08:00')).toBe('2026-07-01T06:00:00.000Z');
    expect(zonedToInstant('2026-12-01', '08:00')).toBe('2026-12-01T07:00:00.000Z');
    expect(toTimeHM('2026-12-01T07:00:00.000Z')).toBe('08:00');
  });

  it('nicht existierende Zeit im März wird nach vorn verschoben', () => {
    // 29.03.2026 02:30 gibt es nicht → 03:30 MESZ = 01:30 UTC
    expect(zonedToInstant('2026-03-29', '02:30')).toBe('2026-03-29T01:30:00.000Z');
  });

  it('doppelte Zeit im Oktober nimmt die erste (Sommerzeit)', () => {
    // 25.10.2026 02:30 existiert zweimal → zuerst MESZ = 00:30 UTC
    expect(zonedToInstant('2026-10-25', '02:30')).toBe('2026-10-25T00:30:00.000Z');
  });
});

describe('splitAtMidnight', () => {
  it('teilt Lernzeit über Mitternacht auf zwei Tage', () => {
    // 23:30 → 00:45 Berliner Zeit (Winter, UTC+1)
    const parts = splitAtMidnight('2026-12-01T22:30:00Z', '2026-12-01T23:45:00Z');
    expect(parts.map((p) => [p.date, p.minutes])).toEqual([
      ['2026-12-01', 30],
      ['2026-12-02', 45],
    ]);
  });

  it('bleibt bei einem Tag ohne Grenze unverändert', () => {
    const parts = splitAtMidnight('2026-10-11T08:00:00Z', '2026-10-11T09:30:00Z');
    expect(parts).toHaveLength(1);
    expect(parts[0]?.minutes).toBe(90);
  });

  it('ignoriert leere und umgekehrte Spannen', () => {
    expect(splitAtMidnight('2026-10-11T09:00:00Z', '2026-10-11T08:00:00Z')).toEqual([]);
  });
});

import { addDays, dateRange, diffDays, isoWeekday, startOfWeek, type ISODate } from '../date';

/**
 * Schulfreie Zeiten Bayern 2026/27 (offline hinterlegt).
 * Quelle: Bayerisches Kultusministerium, Ferienordnung 2024/25–2029/30 (BayMBl. 2022 Nr. 747),
 * km.bayern.de/termine/ferien-und-feiertage; bestätigt durch die KMK-Ferienübersicht 2026/27.
 * Buß- und Bettag ist in Bayern unterrichtsfrei (kein gesetzlicher Feiertag).
 */
export const SCHOOL_BREAKS_2026_27: { name: string; from: ISODate; to: ISODate }[] = [
  { name: 'Allerheiligen', from: '2026-11-02', to: '2026-11-06' },
  { name: 'Buß- und Bettag', from: '2026-11-18', to: '2026-11-18' },
  { name: 'Weihnachtsferien', from: '2026-12-24', to: '2027-01-08' },
  { name: 'Frühjahrsferien', from: '2027-02-08', to: '2027-02-12' },
  { name: 'Osterferien', from: '2027-03-22', to: '2027-04-02' },
  { name: 'Pfingstferien', from: '2027-05-18', to: '2027-05-28' },
  { name: 'Sommerferien', from: '2027-08-02', to: '2027-09-13' },
];

export const SCHOOL_BREAKS_SOURCE =
  'Kultusministerium Bayern, Ferienordnung 2024/25–2029/30 (BayMBl. 2022 Nr. 747); KMK-Ferienkalender 2026/27';

/** Ostersonntag (gregorianisch, Algorithmus nach Meeus/Jones/Butcher). */
export function easterSunday(year: number): ISODate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Gesetzliche Feiertage in Bayern (München: inkl. Mariä Himmelfahrt). */
export function publicHolidaysBY(year: number): { date: ISODate; name: string }[] {
  const easter = easterSunday(year);
  const y = String(year);
  return [
    { date: `${y}-01-01`, name: 'Neujahr' },
    { date: `${y}-01-06`, name: 'Heilige Drei Könige' },
    { date: addDays(easter, -2), name: 'Karfreitag' },
    { date: addDays(easter, 1), name: 'Ostermontag' },
    { date: `${y}-05-01`, name: 'Tag der Arbeit' },
    { date: addDays(easter, 39), name: 'Christi Himmelfahrt' },
    { date: addDays(easter, 50), name: 'Pfingstmontag' },
    { date: addDays(easter, 60), name: 'Fronleichnam' },
    { date: `${y}-08-15`, name: 'Mariä Himmelfahrt' },
    { date: `${y}-10-03`, name: 'Tag der Deutschen Einheit' },
    { date: `${y}-11-01`, name: 'Allerheiligen' },
    { date: `${y}-12-25`, name: '1. Weihnachtstag' },
    { date: `${y}-12-26`, name: '2. Weihnachtstag' },
  ].sort((a, b) => a.date.localeCompare(b.date));
}

/** Warum ist dieser Tag schulfrei? null = Schultag. */
export function schoolFreeReason(date: ISODate): string | null {
  const wd = isoWeekday(date);
  if (wd >= 6) return 'Wochenende';
  const brk = SCHOOL_BREAKS_2026_27.find((b) => date >= b.from && date <= b.to);
  if (brk) return brk.name;
  const hol = publicHolidaysBY(Number(date.slice(0, 4))).find((h) => h.date === date);
  return hol ? hol.name : null;
}

export function isSchoolDay(date: ISODate): boolean {
  return schoolFreeReason(date) === null;
}

/** Nächste Ferien (ab heute laufend oder kommend). */
export function nextBreak(
  today: ISODate,
): { name: string; from: ISODate; to: ISODate; inDays: number } | null {
  const b = SCHOOL_BREAKS_2026_27.find((x) => x.to >= today);
  return b ? { ...b, inDays: Math.max(0, diffDays(today, b.from)) } : null;
}

/** A- oder B-Woche: `weekARef` ist ein Montag einer A-Woche. Ferienwochen zählen mit (wie üblich). */
export function weekType(date: ISODate, weekARef: ISODate): 'A' | 'B' {
  const weeks = Math.round(diffDays(startOfWeek(weekARef), startOfWeek(date)) / 7);
  return ((weeks % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

/**
 * Halbjahr der Qualifikationsphase zu einem Datum (Filip: Q12 im Schuljahr 2026/27, Q13 in 2027/28).
 * Halbjahreswechsel vereinfacht Mitte Februar (Zwischenzeugnis).
 */
export function semesterForDate(date: ISODate): '12/1' | '12/2' | '13/1' | '13/2' {
  const y = Number(date.slice(0, 4));
  const md = date.slice(5);
  const schoolYearStart = md >= '08-01' ? y : y - 1;
  const firstHalf = md >= '08-01' || md < '02-15';
  const q12 = schoolYearStart <= 2026;
  return q12 ? (firstHalf ? '12/1' : '12/2') : firstHalf ? '13/1' : '13/2';
}

/** Schultage in einem Zeitraum (für Lernpläne). */
export function schoolDaysBetween(from: ISODate, to: ISODate): ISODate[] {
  return dateRange(from, to).filter(isSchoolDay);
}

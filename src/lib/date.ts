/**
 * Datumslogik für Winter.
 *
 * Zwei Arten von Zeitangaben:
 *  - Kalendertag (`ISODate`, "2026-10-11"): immer der Tag in Europe/Berlin. Rechnen erfolgt über
 *    UTC-Mittag, damit Zeitumstellungen nie einen Tag verschieben.
 *  - Zeitpunkt (ISO-Instant, "2026-10-11T05:30:00.000Z"): absolute Zeit. Dauern = Differenz der Instants,
 *    dadurch sind Nächte mit Zeitumstellung automatisch korrekt (z. B. 9 h statt 8 h am 25.10.).
 */

export const TZ = 'Europe/Berlin';

export type ISODate = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function isISODate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = parseUTCNoon(value);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isTimeHM(value: string): boolean {
  return TIME_RE.test(value);
}

/** Kalendertag (Berlin) eines Zeitpunkts. */
export function toISODate(instant: Date | string | number): ISODate {
  return dayFmt.format(new Date(instant));
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function nowISO(now: Date = new Date()): string {
  return now.toISOString();
}

function parseUTCNoon(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseUTCNoon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Anzahl Kalendertage von `from` bis `to` (positiv, wenn `to` später liegt). */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((parseUTCNoon(to).getTime() - parseUTCNoon(from).getTime()) / 86_400_000);
}

/** Wochentag nach ISO: 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: ISODate): number {
  const wd = parseUTCNoon(date).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function startOfWeek(date: ISODate): ISODate {
  return addDays(date, 1 - isoWeekday(date));
}

export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: ISODate): ISODate {
  return addDays(startOfMonth(addDays(startOfMonth(date), 32)), -1);
}

/** Alle Tage von `from` bis einschließlich `to`. */
export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n; i++) out.push(addDays(from, i));
  return out;
}

export function isoWeekNumber(date: ISODate): number {
  const thursday = addDays(date, 4 - isoWeekday(date));
  const yearStart = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor(diffDays(yearStart, thursday) / 7) + 1;
}

/** Offset der Zeitzone (ms) zu einem Zeitpunkt: Wandzeit Berlin − UTC. */
function tzOffsetMs(ms: number): number {
  const parts = Object.fromEntries(partsFmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wall - (ms - (ms % 1000));
}

/**
 * Wandzeit in Berlin → Zeitpunkt. Bei nicht existierender Zeit (Sprung vorwärts, 02:30 am letzten
 * Sonntag im März) wird die Zeit nach dem Sprung verwendet; bei doppelter Zeit (Oktober) die erste.
 */
export function zonedToInstant(date: ISODate, time: string): string {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, mi] = time.split(':').map(Number) as [number, number];
  const wallAsUTC = Date.UTC(y, mo - 1, d, h, mi);
  // Offsets kurz vor und nach einer möglichen Umstellung in der Nähe.
  const offBefore = tzOffsetMs(wallAsUTC - 12 * 3_600_000);
  const offAfter = tzOffsetMs(wallAsUTC + 12 * 3_600_000);
  const valid = [offBefore, offAfter]
    .map((off) => wallAsUTC - off)
    .filter((ms) => tzOffsetMs(ms) === wallAsUTC - ms)
    .sort((a, b) => a - b);
  // Doppelte Stunde: früheste Variante. Lücke: Offset vor dem Sprung → Zeit nach dem Sprung.
  const ms = valid[0] ?? wallAsUTC - offBefore;
  return new Date(ms).toISOString();
}

/** Uhrzeit "HH:MM" eines Zeitpunkts in Berlin. */
export function toTimeHM(instant: string | Date): string {
  const parts = Object.fromEntries(partsFmt.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  return `${parts.hour}:${parts.minute}`;
}

/** Berlin-Mitternacht (Beginn) eines Kalendertags als Zeitpunkt. */
export function startOfDayInstant(date: ISODate): string {
  return zonedToInstant(date, '00:00');
}

/**
 * Teilt eine Zeitspanne an Berliner Mitternachtsgrenzen, z. B. Lernzeit 23:30–00:45
 * → [{date: Tag 1, 30 min}, {date: Tag 2, 45 min}].
 */
export function splitAtMidnight(
  startISO: string,
  endISO: string,
): { date: ISODate; start: string; end: string; minutes: number }[] {
  const start = new Date(startISO).getTime();
  const end = new Date(endISO).getTime();
  if (!(end > start)) return [];
  const out: { date: ISODate; start: string; end: string; minutes: number }[] = [];
  let cursor = start;
  while (cursor < end) {
    const day = toISODate(cursor);
    const nextMidnight = new Date(startOfDayInstant(addDays(day, 1))).getTime();
    const segEnd = Math.min(end, nextMidnight);
    out.push({
      date: day,
      start: new Date(cursor).toISOString(),
      end: new Date(segEnd).toISOString(),
      minutes: Math.round((segEnd - cursor) / 60_000),
    });
    cursor = segEnd;
  }
  return out.filter((s) => s.minutes > 0);
}

export function minutesBetween(startISO: string, endISO: string): number {
  return Math.round((new Date(endISO).getTime() - new Date(startISO).getTime()) / 60_000);
}

// ---------- Formatierung (deutsch) ----------

const longFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const shortFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const weekdayShortFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'short' });
const monthFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', month: 'long', year: 'numeric' });

export function formatLong(date: ISODate): string {
  return longFmt.format(parseUTCNoon(date));
}

export function formatShort(date: ISODate): string {
  return shortFmt.format(parseUTCNoon(date));
}

/** "11.10." */
export function formatDayMonth(date: ISODate): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
}

/** "11.10.2026" */
export function formatDE(date: ISODate): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
}

export function formatWeekdayShort(date: ISODate): string {
  return weekdayShortFmt.format(parseUTCNoon(date)).replace('.', '');
}

export function formatMonth(date: ISODate): string {
  return monthFmt.format(parseUTCNoon(date));
}

/** "heute", "gestern", "morgen" oder null. */
export function relativeDayName(date: ISODate, today: ISODate): string | null {
  const d = diffDays(today, date);
  if (d === 0) return 'heute';
  if (d === -1) return 'gestern';
  if (d === 1) return 'morgen';
  return null;
}

/** Minuten als "1 h 25 min" bzw. "45 min". */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** Minuten als "7:45" (h:mm). */
export function formatHM(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

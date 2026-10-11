import { z } from 'zod';
import { addDays, diffDays, isISODate, todayISO, toISODate, zonedToInstant, type ISODate } from '../date';

/**
 * Health-JSON, Schema-Version 1 (vom iOS-Kurzbefehl „Winter Health“):
 *
 * {
 *   "v": 1,
 *   "date": "2026-10-11",
 *   "steps": 8423,
 *   "distanceKm": 6.1,
 *   "flights": 12,
 *   "sleep": { "start": "2026-10-10T23:12:00+02:00", "end": "2026-10-11T06:58:00+02:00" }
 * }
 *
 * Alle Werte außer "v" sind optional. Tolerant gegenüber dem, was Kurzbefehle typischerweise erzeugen:
 * Zahlen als Text, deutsches Komma ("6,1"), Tausenderpunkte ("8.423"), deutsches Datumsformat
 * ("11.10.2026, 06:58"), Distanz in Metern (distanceM), Schlaf als sleepStart/sleepEnd.
 * Ein Array importiert mehrere Tage auf einmal.
 */
export const HEALTH_SCHEMA_VERSION = 1;

export interface HealthPayload {
  date: ISODate;
  steps?: number;
  distanceKm?: number;
  flights?: number;
  sleepStart?: string;
  sleepEnd?: string;
}

export type HealthParseResult =
  { ok: true; days: HealthPayload[]; warnings: string[] } | { ok: false; error: string };

/** "8.423" → 8423 · "6,1" → 6.1 · "1.234,5" → 1234.5 · " 12 " → 12 */
export function parseLooseNumber(value: unknown, integer: boolean): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let s = value.replace(/[\s\u00a0\u202f]/g, '').replace(/[^\d.,-]/g, '');
  if (s === '') return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) s = s.replace(/\./g, '').replace(',', '.');
  else if (hasComma) s = s.replace(',', '.');
  else if (hasDot && integer && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const DE_DATETIME = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4}),?\s+(\d{1,2}):(\d{2})/;
const DE_DATE = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/;

function fullYear(y: string): number {
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

/** Zeitpunkt aus ISO 8601 oder deutschem Kurzbefehl-Format ("11.10.2026, 06:58" = Berliner Zeit). */
export function parseInstant(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const v = value.trim();
  const de = DE_DATETIME.exec(v);
  if (de) {
    const [, d, m, y, h, mi] = de;
    const date = `${fullYear(y ?? '')}-${(m ?? '').padStart(2, '0')}-${(d ?? '').padStart(2, '0')}`;
    if (!isISODate(date)) return null;
    return zonedToInstant(date, `${(h ?? '').padStart(2, '0')}:${mi ?? ''}`);
  }
  if (
    z.iso.datetime({ offset: true, local: false }).safeParse(v).success ||
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)
  ) {
    const t = new Date(v);
    return Number.isNaN(t.getTime()) ? null : t.toISOString();
  }
  return null;
}

function parseDate(value: unknown): ISODate | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (isISODate(v)) return v;
  const de = DE_DATE.exec(v);
  if (de) {
    const date = `${fullYear(de[3] ?? '')}-${(de[2] ?? '').padStart(2, '0')}-${(de[1] ?? '').padStart(2, '0')}`;
    return isISODate(date) ? date : null;
  }
  const instant = parseInstant(v);
  return instant ? toISODate(instant) : null;
}

const zRaw = z
  .object({
    v: z.unknown().optional(),
    date: z.unknown().optional(),
    steps: z.unknown().optional(),
    distanceKm: z.unknown().optional(),
    distanceM: z.unknown().optional(),
    flights: z.unknown().optional(),
    sleep: z.unknown().optional(),
    sleepStart: z.unknown().optional(),
    sleepEnd: z.unknown().optional(),
  })
  .loose();

const zSleepObj = z.object({ start: z.unknown(), end: z.unknown() }).loose();

function parseOne(
  raw: unknown,
  today: ISODate,
  idx: string,
): { day: HealthPayload; warnings: string[] } | string {
  const r = zRaw.safeParse(raw);
  if (!r.success) return `${idx}Erwartet wird ein JSON-Objekt wie {"v":1,"date":"2026-10-11","steps":8423}.`;
  const o = r.data;
  const warnings: string[] = [];

  if (o.v !== undefined) {
    const v = parseLooseNumber(o.v, true);
    if (v !== HEALTH_SCHEMA_VERSION)
      return `${idx}Unbekannte Schema-Version "${String(o.v)}". Unterstützt: ${HEALTH_SCHEMA_VERSION}.`;
  }

  let date: ISODate;
  if (o.date === undefined || o.date === '') {
    date = today;
    warnings.push(`${idx}Kein Datum angegeben – heute (${today}) verwendet.`);
  } else {
    const d = parseDate(o.date);
    if (!d) return `${idx}Datum "${String(o.date)}" nicht lesbar. Erwartet: JJJJ-MM-TT.`;
    date = d;
  }
  if (diffDays(today, date) > 1) return `${idx}Datum ${date} liegt in der Zukunft.`;

  const day: HealthPayload = { date };

  const num = (key: string, value: unknown, integer: boolean, max: number): number | undefined | string => {
    const n = parseLooseNumber(value, integer);
    if (n === undefined) return undefined;
    if (n === null) return `${idx}"${key}" ist keine Zahl ("${String(value)}").`;
    if (n < 0 || n > max) return `${idx}"${key}" = ${n} ist unplausibel (0–${max}).`;
    return integer ? Math.round(n) : Math.round(n * 100) / 100;
  };

  const steps = num('steps', o.steps, true, 200_000);
  if (typeof steps === 'string') return steps;
  if (steps !== undefined) day.steps = steps;

  const km = num('distanceKm', o.distanceKm, false, 300);
  if (typeof km === 'string') return km;
  const m = num('distanceM', o.distanceM, false, 300_000);
  if (typeof m === 'string') return m;
  if (km !== undefined) day.distanceKm = km;
  else if (m !== undefined) day.distanceKm = Math.round(m / 10) / 100;

  const flights = num('flights', o.flights, true, 2000);
  if (typeof flights === 'string') return flights;
  if (flights !== undefined) day.flights = flights;

  let sStart: unknown = o.sleepStart;
  let sEnd: unknown = o.sleepEnd;
  if (o.sleep !== undefined && o.sleep !== null && o.sleep !== '') {
    const s = zSleepObj.safeParse(o.sleep);
    if (!s.success) return `${idx}"sleep" muss {"start": …, "end": …} sein.`;
    sStart = s.data.start;
    sEnd = s.data.end;
  }
  const hasStart = sStart !== undefined && sStart !== null && sStart !== '';
  const hasEnd = sEnd !== undefined && sEnd !== null && sEnd !== '';
  if (hasStart || hasEnd) {
    const start = parseInstant(sStart);
    const end = parseInstant(sEnd);
    if (!start || !end) {
      warnings.push(`${idx}Schlafzeiten nicht lesbar – Schlaf übersprungen.`);
    } else {
      const ms = new Date(end).getTime() - new Date(start).getTime();
      if (ms <= 0) warnings.push(`${idx}Schlaf-Ende liegt vor dem Start – Schlaf übersprungen.`);
      else if (ms > 20 * 3_600_000) warnings.push(`${idx}Schlaf über 20 h – Schlaf übersprungen.`);
      else {
        day.sleepStart = start;
        day.sleepEnd = end;
        const endDay = toISODate(end);
        if (endDay !== date && endDay !== addDays(date, 1)) {
          warnings.push(`${idx}Schlaf endet am ${endDay}, nicht am ${date}.`);
        }
      }
    }
  }

  if (Object.keys(day).length === 1) warnings.push(`${idx}Keine Werte enthalten.`);
  return { day, warnings };
}

/** Parst Text aus Zwischenablage, Textfeld oder Datei. Wirft nie. */
export function parseHealthText(text: string, today: ISODate = todayISO()): HealthParseResult {
  const trimmed = text.trim().replace(/^\uFEFF/, '');
  if (trimmed === '')
    return { ok: false, error: 'Die Zwischenablage ist leer. Wurde der Kurzbefehl ausgeführt?' };
  let json: unknown;
  try {
    // iOS ersetzt in manchen Feldern gerade Anführungszeichen durch typografische.
    json = JSON.parse(trimmed.replace(/[\u201c\u201d\u201e]/g, '"'));
  } catch {
    return {
      ok: false,
      error: 'Kein gültiges JSON. Inhalt beginnt mit: ' + JSON.stringify(trimmed.slice(0, 40)),
    };
  }
  const items = Array.isArray(json) ? json : [json];
  if (items.length === 0) return { ok: false, error: 'Die Liste ist leer.' };
  if (items.length > 400) return { ok: false, error: 'Zu viele Tage auf einmal (max. 400).' };
  const days: HealthPayload[] = [];
  const warnings: string[] = [];
  for (const [i, item] of items.entries()) {
    const r = parseOne(item, today, items.length > 1 ? `Eintrag ${i + 1}: ` : '');
    if (typeof r === 'string') return { ok: false, error: r };
    days.push(r.day);
    warnings.push(...r.warnings);
  }
  return { ok: true, days, warnings };
}

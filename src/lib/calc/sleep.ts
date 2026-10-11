import { addDays, minutesBetween, zonedToInstant, type ISODate } from '../date';
import type { HealthDay, Sleep } from '../../db/schemas';

/** Schlafdauer in Minuten aus zwei Zeitpunkten. Ungültig (Ende ≤ Start) → 0. */
export function sleepMinutes(startISO: string, endISO: string): number {
  return Math.max(0, minutesBetween(startISO, endISO));
}

/**
 * Bett- und Aufwachzeit (Wandzeit Berlin) → Zeitpunkte. `wakeDate` ist der Aufwachtag.
 * Liegt die Bettzeit nach der Aufwachzeit (23:30 → 07:00), war das Zubettgehen am Vortag.
 * Liegt sie davor (00:30 → 08:00 oder Mittagsschlaf 14:00 → 15:00), am selben Tag.
 */
export function sleepFromWallTimes(wakeDate: ISODate, bed: string, wake: string): { start: string; end: string } {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const bedDate = toMin(bed) >= toMin(wake) ? addDays(wakeDate, -1) : wakeDate;
  return { start: zonedToInstant(bedDate, bed), end: zonedToInstant(wakeDate, wake) };
}

export interface EffectiveSleep {
  start: string;
  end: string;
  minutes: number;
  quality?: number;
  source: 'manuell' | 'health';
}

/** Manueller Eintrag hat immer Vorrang vor Health-Werten. */
export function effectiveSleep(manual: Sleep | undefined, health: HealthDay | undefined): EffectiveSleep | null {
  if (manual) {
    return {
      start: manual.start,
      end: manual.end,
      minutes: sleepMinutes(manual.start, manual.end),
      ...(manual.quality !== undefined ? { quality: manual.quality } : {}),
      source: 'manuell',
    };
  }
  if (health?.sleepStart && health.sleepEnd) {
    const minutes = sleepMinutes(health.sleepStart, health.sleepEnd);
    if (minutes > 0) return { start: health.sleepStart, end: health.sleepEnd, minutes, source: 'health' };
  }
  return null;
}

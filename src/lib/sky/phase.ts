import type { SkyPhase } from '../../db/schemas';
import { moonPhase, sunPosition } from './astro';

export type SkyWeights = Record<SkyPhase, number>;

export interface SkyState {
  /** Vorherrschende Phase (größtes Gewicht). */
  phase: SkyPhase;
  /** Mischgewichte der vier Paletten, Summe 1 – für weiche Übergänge. */
  weights: SkyWeights;
  sun: { altitude: number; azimuth: number };
  moon: { phase: number; illumination: number; waxing: boolean };
  /** Sternendichte 0–1 (nur nachts und in der späten Dämmerung). */
  stars: number;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Linear von 0 (bei a) nach 1 (bei b). */
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));

/**
 * Himmelsphase aus der Sonnenhöhe:
 *  - Tag ab +6°, Dämmerung um den Horizont (−10° … +2°), Nacht unter −16°.
 *  - Vormittags heißt die Dämmerung „dawn“ (Blaue Stunde/Morgendämmerung), nachmittags „dusk“.
 * Dazwischen wird linear gemischt, damit Übergänge über ~30–60 min weich laufen.
 */
export function skyWeights(altitude: number, morning: boolean): SkyWeights {
  const day = ramp(altitude, 0, 6);
  const night = 1 - ramp(altitude, -16, -10);
  const twilight = Math.max(0, 1 - day - night);
  return {
    day,
    night,
    dawn: morning ? twilight : 0,
    dusk: morning ? 0 : twilight,
  };
}

export function skyState(date: Date, simulate: SkyPhase | 'auto' = 'auto'): SkyState {
  const sun = sunPosition(date);
  // Azimut < 0 = Sonne im Osten (vor dem Höchststand) → Vormittag.
  const morning = sun.azimuth < 0;
  const weights: SkyWeights =
    simulate === 'auto'
      ? skyWeights(sun.altitude, morning)
      : { night: 0, dawn: 0, day: 0, dusk: 0, [simulate]: 1 };
  const phase = (Object.entries(weights) as [SkyPhase, number][]).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return {
    phase,
    weights,
    sun,
    moon: moonPhase(date),
    stars: clamp01(weights.night + 0.35 * (weights.dawn + weights.dusk)),
  };
}

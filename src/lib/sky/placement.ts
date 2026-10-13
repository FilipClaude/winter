/**
 * Wo Sonne und Mond auf dem Bildschirm stehen – aus Höhe und Azimut (München).
 *
 * - Waagerecht: Osten links, Süden Mitte, Westen rechts (Blick nach Süden). Azimut ±135° füllt die Breite.
 * - Senkrecht: Höhe 0° liegt genau auf dem Grat der fernen Bergkette an dieser Stelle – Sonne und Mond
 *   gehen also hinter den Alpen auf und unter. Schon ab ~10° stehen sie in der oberen Bildschirmhälfte
 *   (Wurzel-Kurve), ganz oben (Höchststand im Sommer) bei 18 % der Höhe, unter dem Kopfbereich.
 */

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Ab dieser Höhe (Grad) steht ein Gestirn ganz oben. Höchststand in München: ~65° (Juni), ~19° (Dezember). */
export const TOP_ALTITUDE = 60;
/** Oberste Position (Anteil der Bildschirmhöhe) – unter dem Kopfbereich (Datum auf „Heute“ endet bei ~17 %). */
export const TOP_Y = 0.18;
/** Azimut, der genau den Bildschirmrand erreicht. */
const AZ_EDGE = 135;

/**
 * @param ridgeTop Grat der fernen Kette an Position x (0–1) als Anteil der Bildschirmhöhe von oben.
 * @returns Mittelpunkt in Pixeln. Unter dem Horizont sinkt der Punkt unter den Grat (dort verdecken ihn die Berge).
 */
export function celestialToScreen(
  altitude: number,
  azimuth: number,
  w: number,
  h: number,
  ridgeTop: (x01: number) => number,
): ScreenPoint {
  const az = Math.max(-AZ_EDGE, Math.min(AZ_EDGE, azimuth));
  const x01 = 0.5 + az / (2 * AZ_EDGE);
  const horizonY = ridgeTop(x01) * h;
  const topY = TOP_Y * h;
  let y: number;
  if (altitude >= 0) {
    const t = Math.min(1, altitude / TOP_ALTITUDE) ** 0.5;
    y = horizonY + (topY - horizonY) * t;
  } else {
    // Unter dem Horizont: pro Grad 1,2 % der Höhe tiefer – verschwindet hinter dem Grat
    y = horizonY - altitude * 0.012 * h;
  }
  return { x: x01 * w, y };
}

/** Grathöhe aus einem Bergkamm (Punkte x 0–1, y 0–1 als Anteil der Ebenenhöhe), linear interpoliert. */
export function ridgeHeightAt(points: readonly (readonly [number, number])[], x01: number): number {
  if (points.length === 0) return 0;
  let prev = points[0];
  for (const p of points) {
    if (p[0] >= x01 && prev) {
      const span = p[0] - prev[0];
      const t = span > 0 ? (x01 - prev[0]) / span : 0;
      return prev[1] + (p[1] - prev[1]) * t;
    }
    prev = p;
  }
  return points[points.length - 1]?.[1] ?? 0;
}

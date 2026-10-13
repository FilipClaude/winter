/**
 * Kleine Himmels-Effekte als reine Funktionen (testbar, ohne Canvas): Alpenglühen, Nebelmenge,
 * Sternschnuppen, funkelnde Sterne und Lichter am Hang. Gezeichnet wird in `src/shell/Sky.tsx`.
 */

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const RAD = Math.PI / 180;

/**
 * Alpenglühen 0–1 aus der Sonnenhöhe (Grad): setzt ab −4° ein, am stärksten um +1° (kurz nach Aufgang
 * bzw. vor Untergang), ab +8° vorbei.
 */
export function alpenglow(sunAltitude: number): number {
  const rising = clamp01((sunAltitude + 4) / 5);
  const fading = clamp01((8 - sunAltitude) / 7);
  return Math.min(rising, fading);
}

/**
 * Nebel/Wolken zwischen den Bergketten, 0–1. Im Wettermodus nach echter Bewölkung (unter 20 % keiner,
 * ab 80 % voll; unbekannt → mittel), sonst immer dezent.
 */
export function fogAmount(snowMode: 'off' | 'subtle' | 'weather', clouds: number | null): number {
  if (snowMode !== 'weather') return 0.7;
  if (clouds === null) return 0.5;
  return clamp01((clouds - 20) / 60);
}

/** Alle 7 Sekunden eine Sternschnuppe (Filips Wunsch), nur nachts. */
export const METEOR_INTERVAL_MS = 7000;

export interface Meteor {
  x0: number;
  y0: number;
  /** Flugrichtung (Einheitsvektor), immer schräg nach unten. */
  dx: number;
  dy: number;
  speed: number;
  length: number;
  start: number;
  duration: number;
}

/**
 * Neue Sternschnuppe an zufälliger Stelle im oberen Himmel. Bahn und Länge sind so begrenzt, dass sie
 * oberhalb der Berge bleibt (Start ≤ 22 % der Höhe, Weg ≤ ~280 px bei ≤ 30° Neigung).
 */
export function spawnMeteor(rnd: () => number, w: number, h: number, now: number): Meteor {
  const dir = rnd() < 0.5 ? -1 : 1;
  const angle = (12 + rnd() * 18) * RAD;
  return {
    x0: w * (0.12 + rnd() * 0.76),
    y0: h * (0.04 + rnd() * 0.18),
    dx: dir * Math.cos(angle),
    dy: Math.sin(angle),
    speed: 300 + rnd() * 100,
    length: 60 + rnd() * 40,
    start: now,
    duration: 500 + rnd() * 200,
  };
}

/** Kopf, Schweifende und Deckkraft zum Zeitpunkt `now`, null außerhalb der Lebensdauer. */
export function meteorAt(
  m: Meteor,
  now: number,
): { hx: number; hy: number; tx: number; ty: number; alpha: number } | null {
  const t = (now - m.start) / m.duration;
  if (t < 0 || t > 1) return null;
  const dist = (m.speed * (now - m.start)) / 1000;
  const hx = m.x0 + m.dx * dist;
  const hy = m.y0 + m.dy * dist;
  const tail = Math.min(m.length, dist);
  return { hx, hy, tx: hx - m.dx * tail, ty: hy - m.dy * tail, alpha: Math.sin(Math.PI * t) };
}

export interface Twinkler {
  x: number;
  y: number;
  r: number;
  base: number;
  speed: number;
  phase: number;
}

/** Einige wenige funkelnde Sterne im oberen Himmel (über den Bergen). */
export function makeTwinklers(rnd: () => number, w: number, h: number, count = 14): Twinkler[] {
  return Array.from({ length: count }, () => ({
    x: rnd() * w,
    y: h * (0.03 + rnd() * 0.36),
    r: 0.8 + rnd() * 0.6,
    base: 0.5 + rnd() * 0.35,
    speed: 1.2 + rnd() * 2.2,
    phase: rnd() * Math.PI * 2,
  }));
}

/** Deckkraft eines funkelnden Sterns nach `seconds` – sanft zwischen 35 % und 100 % der Grundhelligkeit. */
export function twinkleAlpha(t: Twinkler, seconds: number): number {
  return t.base * (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(seconds * t.speed + t.phase)));
}

export interface Light {
  /** x als Anteil der Breite (0–1) */
  x: number;
  /** Abstand unter dem Grat in px */
  below: number;
  r: number;
  alpha: number;
}

/**
 * Lichter am Hang der mittleren Kette, in 3 kleinen Gruppen. Nur dort, wo der Grat hoch genug ist
 * (≥ 75 % der Ebenenhöhe), damit sie über der vorderen Kette und der Tab-Leiste sichtbar bleiben.
 * `heightAt(x)` = Grathöhe (0–1) an Bildschirmposition x.
 */
export function villageLights(rnd: () => number, heightAt: (x01: number) => number): Light[] {
  const spots: number[] = [];
  for (let i = 0; i <= 200; i++) {
    const x = 0.04 + (i / 200) * 0.92;
    if (heightAt(x) >= 0.75) spots.push(x);
  }
  if (spots.length === 0) return [];
  const lights: Light[] = [];
  for (let g = 0; g < 3; g++) {
    const cx = spots[Math.floor(rnd() * spots.length)] ?? 0.5;
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      lights.push({
        x: cx + (rnd() - 0.5) * 0.06,
        below: 12 + rnd() * 22,
        r: 0.9 + rnd() * 0.7,
        alpha: 0.55 + rnd() * 0.4,
      });
    }
  }
  return lights;
}

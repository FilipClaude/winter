import { SKY_PHASES, type SkyPhase } from '../../db/schemas';
import type { SkyWeights } from './phase';

export type RGB = [number, number, number];

export const SKY_STOPS = ['top', 'mid', 'horizon', 'glow', 'alp-1', 'alp-2', 'alp-3'] as const;
export type SkyStop = (typeof SKY_STOPS)[number];

export interface SkyPalette {
  colors: Record<SkyStop, RGB>;
  veil: number;
  glass: number;
}

export function parseHex(hex: string): RGB {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  // Fehlendes Token → Schwarz statt NaN (der Himmel bleibt dann dunkel, nie kaputt).
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as RGB;
}

export function rgbString([r, g, b]: RGB, alpha = 1): string {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;
}

/** Liest die Himmels-Tokens aus tokens.css (über berechnete CSS-Variablen). */
export function readPalettes(get: (name: string) => string): Record<SkyPhase, SkyPalette> {
  const out = {} as Record<SkyPhase, SkyPalette>;
  for (const p of SKY_PHASES) {
    const colors = {} as Record<SkyStop, RGB>;
    for (const s of SKY_STOPS) colors[s] = parseHex(get(`--sky-${p}-${s}`));
    out[p] = {
      colors,
      veil: Number(get(`--sky-${p}-veil`)) || 0,
      glass: Number(get(`--sky-${p}-glass`)) || 0.8,
    };
  }
  return out;
}

/** Mischt die Paletten nach Gewichten (Summe 1) – weiche Übergänge zwischen den Phasen. */
export function blendPalette(palettes: Record<SkyPhase, SkyPalette>, w: SkyWeights): SkyPalette {
  const colors = {} as Record<SkyStop, RGB>;
  for (const s of SKY_STOPS) {
    const c: RGB = [0, 0, 0];
    for (const p of SKY_PHASES) {
      const pc = palettes[p].colors[s];
      for (let i = 0; i < 3; i++) c[i] = (c[i] ?? 0) + (pc[i] ?? 0) * w[p];
    }
    colors[s] = c;
  }
  let veil = 0;
  let glass = 0;
  for (const p of SKY_PHASES) {
    veil += palettes[p].veil * w[p];
    glass += palettes[p].glass * w[p];
  }
  return { colors, veil, glass };
}

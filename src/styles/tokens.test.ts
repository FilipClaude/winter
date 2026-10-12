import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m?.[1]) throw new Error(`Token --${name} fehlt oder ist kein Hex-Wert`);
  return m[1];
}

function numberToken(name: string): number {
  const m = new RegExp(`--${name}:\\s*([0-9.]+)`).exec(css);
  if (!m?.[1]) throw new Error(`Token --${name} fehlt oder ist keine Zahl`);
  return Number(m[1]);
}

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const hex = (c: RGB) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** Deckende Farbe `top` mit Deckkraft `alpha` über `bottom` (Mischung im sRGB-Raum wie im Browser). */
const over = (top: string, alpha: number, bottom: string) =>
  hex(rgb(top).map((v, i) => v * alpha + (rgb(bottom)[i] ?? 0) * (1 - alpha)) as RGB);

function luminance(h: string): number {
  const [r, g, b] = rgb(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXTS = ['color-text', 'color-text-2', 'color-text-3', 'color-accent', 'color-warn'];

describe('Design-Tokens: Kontrast nach WCAG AA', () => {
  const backgrounds = ['color-bg', 'color-surface', 'color-surface-2', 'color-surface-3'];

  for (const bg of backgrounds) {
    for (const fg of TEXTS) {
      it(`${fg} auf ${bg} ≥ 4.5`, () => {
        expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('Text auf Akzentfläche ≥ 4.5', () => {
    expect(contrast(token('color-accent-ink'), token('color-accent'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Winterhimmel: Lesbarkeit in jeder Phase (WCAG AA)', () => {
  // Jede Stelle des Himmels kann hinter Text liegen – also jede Farbe der Palette prüfen,
  // auch das hellste Horizontlicht und die Alpen.
  const STOPS = ['top', 'mid', 'horizon', 'glow', 'alp-1', 'alp-2', 'alp-3'];
  for (const phase of ['night', 'dawn', 'day', 'dusk']) {
    const veil = numberToken(`sky-${phase}-veil`);
    const glass = numberToken(`sky-${phase}-glass`);
    for (const stop of STOPS) {
      const sky = over(token('color-bg'), veil, token(`sky-${phase}-${stop}`));
      for (const fg of TEXTS) {
        it(`${phase}/${stop}: ${fg} direkt auf dem Himmel ≥ 4.5`, () => {
          expect(contrast(token(fg), sky)).toBeGreaterThanOrEqual(4.5);
        });
        for (const surface of ['color-surface', 'color-surface-2', 'color-surface-3']) {
          it(`${phase}/${stop}: ${fg} auf Glas (${surface}) ≥ 4.5`, () => {
            expect(contrast(token(fg), over(token(surface), glass, sky))).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
    }
  }

  it('Tag ist heller als Nacht (der Himmel ist sichtbar, nicht nur schwarz)', () => {
    const veiled = (p: string) =>
      over(token('color-bg'), numberToken(`sky-${p}-veil`), token(`sky-${p}-mid`));
    expect(luminance(veiled('day'))).toBeGreaterThan(luminance(veiled('night')) * 1.5);
  });
});

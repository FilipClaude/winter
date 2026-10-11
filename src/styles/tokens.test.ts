import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m?.[1]) throw new Error(`Token --${name} fehlt oder ist kein Hex-Wert`);
  return m[1];
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('Design-Tokens: Kontrast nach WCAG AA', () => {
  const backgrounds = ['color-bg', 'color-surface', 'color-surface-2', 'color-surface-3'];
  const texts = ['color-text', 'color-text-2', 'color-text-3', 'color-accent', 'color-warn'];

  for (const bg of backgrounds) {
    for (const fg of texts) {
      it(`${fg} auf ${bg} ≥ 4.5`, () => {
        expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it('Text auf Akzentfläche ≥ 4.5', () => {
    expect(contrast(token('color-accent-ink'), token('color-accent'))).toBeGreaterThanOrEqual(4.5);
  });
});

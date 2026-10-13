import { describe, expect, it } from 'vitest';
import {
  alpenglow,
  fogAmount,
  makeTwinklers,
  meteorAt,
  METEOR_INTERVAL_MS,
  spawnMeteor,
  twinkleAlpha,
  villageLights,
} from './effects';

/** Einfacher deterministischer Zufall für Tests. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Alpenglühen', () => {
  it('nur um Sonnenauf- und -untergang, am stärksten knapp über dem Horizont', () => {
    expect(alpenglow(-10)).toBe(0);
    expect(alpenglow(30)).toBe(0);
    expect(alpenglow(1)).toBe(1);
    expect(alpenglow(-2)).toBeGreaterThan(0);
    expect(alpenglow(5)).toBeGreaterThan(0);
    expect(alpenglow(5)).toBeLessThan(1);
  });
});

describe('Nebel zwischen den Bergen', () => {
  it('ohne Wettermodus immer dezent, im Wettermodus nach Bewölkung', () => {
    expect(fogAmount('subtle', null)).toBeCloseTo(0.7);
    expect(fogAmount('off', 90)).toBeCloseTo(0.7);
    expect(fogAmount('weather', 10)).toBe(0);
    expect(fogAmount('weather', 50)).toBeCloseTo(0.5);
    expect(fogAmount('weather', 95)).toBe(1);
    expect(fogAmount('weather', null)).toBeCloseTo(0.5);
  });
});

describe('Sternschnuppen', () => {
  it('alle 7 Sekunden', () => expect(METEOR_INTERVAL_MS).toBe(7000));

  it('bleiben immer im oberen Himmel über den Bergen (1000 zufällige Bahnen)', () => {
    const rnd = rng(1);
    const W = 390;
    const H = 844;
    for (let i = 0; i < 1000; i++) {
      const m = spawnMeteor(rnd, W, H, 0);
      for (let t = 0; t <= m.duration; t += 20) {
        const p = meteorAt(m, t);
        if (!p) continue;
        expect(p.hy).toBeLessThan(H * 0.4);
        expect(p.hy).toBeGreaterThanOrEqual(p.ty); // fällt nach unten
      }
    }
  });

  it('blendet weich ein und aus und ist danach weg', () => {
    const m = spawnMeteor(rng(2), 390, 844, 1000);
    expect(meteorAt(m, 1000)?.alpha).toBeCloseTo(0, 5);
    expect(meteorAt(m, 1000 + m.duration / 2)?.alpha).toBeCloseTo(1, 5);
    expect(meteorAt(m, 1000 + m.duration + 1)).toBeNull();
    expect(meteorAt(m, 999)).toBeNull();
  });
});

describe('Funkelnde Sterne und Lichter', () => {
  it('Sterne liegen über den Bergen und funkeln zwischen 35 % und 100 % ihrer Helligkeit', () => {
    const ts = makeTwinklers(rng(3), 390, 844);
    expect(ts).toHaveLength(14);
    for (const t of ts) {
      expect(t.y).toBeLessThan(844 * 0.4);
      for (let s = 0; s < 10; s += 0.37) {
        const a = twinkleAlpha(t, s);
        expect(a).toBeGreaterThanOrEqual(t.base * 0.35 - 1e-9);
        expect(a).toBeLessThanOrEqual(t.base + 1e-9);
      }
    }
  });

  it('Lichter nur an hohen Hängen, in drei kleinen Gruppen', () => {
    const height = (x: number) => (x > 0.3 && x < 0.5 ? 0.9 : 0.4);
    const lights = villageLights(rng(4), height);
    expect(lights.length).toBeGreaterThanOrEqual(9);
    expect(lights.length).toBeLessThanOrEqual(15);
    for (const l of lights) expect(l.x).toBeGreaterThan(0.26);
    expect(villageLights(rng(5), () => 0.3)).toEqual([]);
  });
});

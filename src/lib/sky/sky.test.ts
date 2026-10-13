import { describe, expect, it } from 'vitest';
import { moonPhase, moonPosition, sunPosition, sunTimes } from './astro';
import { celestialToScreen, ridgeHeightAt } from './placement';
import { skyState, skyWeights } from './phase';

/** Uhrzeit in Berlin (HH:MM) eines Zeitpunkts. */
const berlin = (d: Date) =>
  new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(
    d,
  );
const minutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number) as [number, number];
  return h * 60 + m;
};

describe('Sonnenauf- und -untergang München', () => {
  // Vergleichswerte: timeanddate.de / Deutscher Wetterdienst für München (±3 min Toleranz).
  const cases: [string, string, string][] = [
    ['2026-12-21', '08:02', '16:22'],
    ['2026-06-21', '05:13', '21:17'],
    ['2026-03-20', '06:15', '18:24'],
  ];

  it('Zeitumstellung 25.10.2026: Aufgang in Wandzeit eine Stunde früher als am Vortag (± 3 min)', () => {
    const before = sunTimes(new Date('2026-10-24T12:00:00Z'));
    const after = sunTimes(new Date('2026-10-25T12:00:00Z'));
    if (!before || !after) throw new Error('keine Zeiten');
    const delta = minutes(berlin(before.rise)) - minutes(berlin(after.rise));
    expect(delta).toBeGreaterThanOrEqual(57);
    expect(delta).toBeLessThanOrEqual(61);
  });
  for (const [day, rise, set] of cases) {
    it(`${day}: Aufgang ${rise}, Untergang ${set}`, () => {
      const t = sunTimes(new Date(`${day}T12:00:00Z`));
      expect(t).not.toBeNull();
      if (!t) return;
      expect(Math.abs(minutes(berlin(t.rise)) - minutes(rise))).toBeLessThanOrEqual(3);
      expect(Math.abs(minutes(berlin(t.set)) - minutes(set))).toBeLessThanOrEqual(3);
    });
  }

  it('Mittagshöhe im Winter niedrig, im Sommer hoch', () => {
    const winter = sunPosition(new Date('2026-12-21T11:15:00Z')).altitude;
    const summer = sunPosition(new Date('2026-06-21T11:15:00Z')).altitude;
    expect(winter).toBeGreaterThan(17);
    expect(winter).toBeLessThan(20);
    expect(summer).toBeGreaterThan(64);
    expect(summer).toBeLessThan(66);
  });
});

describe('Mondphase', () => {
  it('Vollmond 25.01.2024 und Neumond 11.01.2024 (bekannte Termine)', () => {
    const full = moonPhase(new Date('2024-01-25T17:54:00Z'));
    expect(full.illumination).toBeGreaterThan(0.97);
    const fresh = moonPhase(new Date('2024-01-11T11:57:00Z'));
    expect(fresh.illumination).toBeLessThan(0.03);
  });

  it('zunehmend vor, abnehmend nach Vollmond', () => {
    expect(moonPhase(new Date('2024-01-20T12:00:00Z')).waxing).toBe(true);
    expect(moonPhase(new Date('2024-01-30T12:00:00Z')).waxing).toBe(false);
  });
});

describe('Himmelsphasen', () => {
  it('Gewichte summieren sich immer zu 1', () => {
    for (let alt = -30; alt <= 40; alt += 0.5) {
      for (const morning of [true, false]) {
        const w = skyWeights(alt, morning);
        expect(w.day + w.night + w.dawn + w.dusk).toBeCloseTo(1, 9);
      }
    }
  });

  it('Mitternacht = Nacht, Mittag = Tag, Morgendämmerung vormittags, Abenddämmerung nachmittags', () => {
    expect(skyState(new Date('2026-12-15T23:00:00Z')).phase).toBe('night');
    expect(skyState(new Date('2026-12-15T11:00:00Z')).phase).toBe('day');
    // 15.12.: Aufgang ~07:58 MEZ (06:58 UTC) → 07:15 UTC kurz nach Aufgang noch Dämmerung
    expect(skyState(new Date('2026-12-15T06:45:00Z')).phase).toBe('dawn');
    expect(skyState(new Date('2026-12-15T15:45:00Z')).phase).toBe('dusk');
  });

  it('Simulation erzwingt eine Phase', () => {
    const s = skyState(new Date('2026-12-15T23:00:00Z'), 'day');
    expect(s.phase).toBe('day');
    expect(s.weights.day).toBe(1);
    expect(s.stars).toBe(0);
  });

  it('Übergang Tag → Dämmerung ist stetig (keine Sprünge > 5 % pro Minute)', () => {
    let prev = skyState(new Date('2026-12-15T14:30:00Z')).weights;
    for (let m = 1; m <= 150; m++) {
      const w = skyState(new Date(Date.parse('2026-12-15T14:30:00Z') + m * 60_000)).weights;
      for (const k of ['day', 'dusk', 'night'] as const) expect(Math.abs(w[k] - prev[k])).toBeLessThan(0.05);
      prev = w;
    }
  });
});

describe('Mondstand', () => {
  const sep = (a: { altitude: number; azimuth: number }, b: { altitude: number; azimuth: number }) => {
    const r = Math.PI / 180;
    const c =
      Math.sin(a.altitude * r) * Math.sin(b.altitude * r) +
      Math.cos(a.altitude * r) * Math.cos(b.altitude * r) * Math.cos((a.azimuth - b.azimuth) * r);
    return Math.acos(Math.min(1, Math.max(-1, c))) / r;
  };
  const findPhase = (target: number) => {
    let best = new Date('2026-10-01T00:00:00Z');
    for (let hh = 0; hh < 24 * 40; hh++) {
      const d = new Date(Date.UTC(2026, 9, 1, hh));
      const diff = (p: Date) => Math.abs(((moonPhase(p).phase - target + 1.5) % 1) - 0.5);
      if (diff(d) < diff(best)) best = d;
    }
    return best;
  };

  it('Vollmond steht der Sonne gegenüber, Neumond neben ihr', () => {
    const full = findPhase(0.5);
    expect(sep(moonPosition(full), sunPosition(full))).toBeGreaterThan(165);
    const nw = findPhase(0);
    expect(sep(moonPosition(nw), sunPosition(nw))).toBeLessThan(15);
  });

  it('geht im Osten auf und im Westen unter', () => {
    let prev = moonPosition(new Date('2026-10-14T00:00:00Z'));
    let rises = 0;
    let sets = 0;
    for (let m = 10; m <= 48 * 60; m += 10) {
      const p = moonPosition(new Date(Date.parse('2026-10-14T00:00:00Z') + m * 60_000));
      if (prev.altitude < 0 && p.altitude >= 0) {
        rises++;
        expect(p.azimuth).toBeLessThan(-45);
      }
      if (prev.altitude >= 0 && p.altitude < 0) {
        sets++;
        expect(p.azimuth).toBeGreaterThan(45);
      }
      prev = p;
    }
    expect(rises).toBeGreaterThanOrEqual(1);
    expect(sets).toBeGreaterThanOrEqual(1);
  });
});

describe('Sonne und Mond auf dem Bildschirm', () => {
  const ridge = () => 0.6; // Grat bei 60 % von oben
  const W = 390;
  const H = 844;

  it('Höhe 0° liegt auf dem Grat, darunter verschwindet das Gestirn hinter den Bergen', () => {
    expect(celestialToScreen(0, 0, W, H, ridge).y).toBeCloseTo(0.6 * H, 5);
    expect(celestialToScreen(-2, 0, W, H, ridge).y).toBeGreaterThan(0.6 * H);
  });

  it('ab ~10° in der oberen Hälfte, ganz oben bei 18 % der Höhe (unter dem Kopfbereich)', () => {
    expect(celestialToScreen(10, 0, W, H, ridge).y).toBeLessThan(0.5 * H);
    expect(celestialToScreen(60, 0, W, H, ridge).y).toBeCloseTo(0.18 * H, 5);
    expect(celestialToScreen(80, 0, W, H, ridge).y).toBeCloseTo(0.18 * H, 5);
  });

  it('Osten links, Süden Mitte, Westen rechts', () => {
    expect(celestialToScreen(20, -90, W, H, ridge).x).toBeCloseTo(W / 6, 5);
    expect(celestialToScreen(20, 0, W, H, ridge).x).toBeCloseTo(W / 2, 5);
    expect(celestialToScreen(20, 90, W, H, ridge).x).toBeCloseTo((W * 5) / 6, 5);
  });

  it('Grathöhe wird zwischen Kammpunkten interpoliert', () => {
    const pts: [number, number][] = [
      [0, 0.2],
      [0.5, 0.8],
      [1, 0.4],
    ];
    expect(ridgeHeightAt(pts, 0.25)).toBeCloseTo(0.5, 5);
    expect(ridgeHeightAt(pts, 0.75)).toBeCloseTo(0.6, 5);
  });
});

import { describe, expect, it } from 'vitest';
import { moonPhase, sunPosition, sunTimes } from './astro';
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

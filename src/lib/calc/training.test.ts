import { describe, expect, it } from 'vitest';
import { addDays } from '../date';
import type { Match, Session } from '../../db/schemas';
import {
  detectPRs,
  estimated1RM,
  exerciseBests,
  loadRatio,
  seasonOf,
  seasonStats,
  sessionLoad,
} from './training';

const T = '2026-10-11';

function s(date: string, durationMin: number, rpe: number): Pick<Session, 'date' | 'durationMin' | 'rpe'> {
  return { date, durationMin, rpe };
}

describe('Session-Load', () => {
  it('Dauer × RPE', () => {
    expect(sessionLoad(90, 7)).toBe(630);
    expect(sessionLoad(0, 7)).toBe(0);
    expect(sessionLoad(60, 0)).toBe(0);
    expect(sessionLoad(Number.NaN, 5)).toBe(0);
  });
});

describe('akute/chronische Belastung', () => {
  it('meldet zu wenig Daten bei kurzer Historie', () => {
    const r = loadRatio([s(addDays(T, -3), 60, 6)], T);
    expect(r.status).toBe('zu-wenig-daten');
    expect(r.ratio).toBeNull();
    expect(r.acute).toBe(360);
  });

  it('gleichmäßige Belastung ergibt ≈ 1', () => {
    const sessions = Array.from({ length: 28 }, (_, i) => s(addDays(T, -i), 60, 5));
    const r = loadRatio(sessions, T);
    expect(r.acute).toBe(7 * 300);
    expect(r.chronic).toBe(7 * 300);
    expect(r.ratio).toBe(1);
    expect(r.status).toBe('ok');
  });

  it('starker Sprung in der letzten Woche wird als hoch erkannt', () => {
    const base = Array.from({ length: 21 }, (_, i) => s(addDays(T, -7 - i), 45, 4));
    const spike = Array.from({ length: 7 }, (_, i) => s(addDays(T, -i), 120, 8));
    const r = loadRatio([...base, ...spike], T);
    expect(r.ratio).toBeGreaterThan(1.5);
    expect(r.status).toBe('hoch');
  });

  it('zukünftige Einheiten zählen nicht', () => {
    const sessions = [s(addDays(T, -25), 60, 5), s(addDays(T, 2), 600, 10)];
    expect(loadRatio(sessions, T).acute).toBe(0);
  });

  it('Pause ergibt niedrig', () => {
    const sessions = Array.from({ length: 20 }, (_, i) => s(addDays(T, -8 - i), 60, 6));
    expect(loadRatio(sessions, T).status).toBe('niedrig');
  });
});

describe('Gym: Bestleistungen', () => {
  const gym = (id: string, date: string, sets: [number, number][], name = 'Kniebeuge') => ({
    id,
    date,
    createdAt: `${date}T10:00:00.000Z`,
    gym: { exercises: [{ name, sets: sets.map(([reps, weightKg]) => ({ reps, weightKg })) }] },
  });

  it('Epley-1RM', () => {
    expect(estimated1RM(100, 1)).toBe(100);
    expect(estimated1RM(100, 5)).toBe(116.7);
    expect(estimated1RM(0, 5)).toBe(0);
    expect(estimated1RM(80, 0)).toBe(0);
  });

  it('erste Einheit ist Basis, Steigerung wird markiert', () => {
    const marks = detectPRs([
      gym('a', '2026-10-01', [
        [5, 80],
        [5, 80],
      ]),
      gym('b', '2026-10-04', [
        [5, 85],
        [3, 90],
      ]),
    ]);
    expect(marks.filter((m) => m.sessionId === 'a')).toHaveLength(0);
    const kinds = marks
      .filter((m) => m.sessionId === 'b')
      .flatMap((m) => m.kinds.map((k) => `${m.setIndex}:${k}`));
    expect(kinds).toContain('1:gewicht'); // 90 kg
    expect(kinds).toContain('0:1rm'); // 85×5 = 99,2 > 90×3 = 99,0
  });

  it('gleiche Leistung ist kein PR, Groß-/Kleinschreibung egal', () => {
    const marks = detectPRs([
      gym('a', '2026-10-01', [[5, 80]]),
      gym('b', '2026-10-02', [[5, 80]], ' kniebeuge '),
    ]);
    expect(marks).toHaveLength(0);
  });

  it('Körpergewichtsübungen: mehr Wiederholungen = PR, Bestwert in Wdh.', () => {
    const marks = detectPRs([
      gym('a', '2026-10-01', [[6, 0]], 'Nordic Curls'),
      gym(
        'b',
        '2026-10-05',
        [
          [8, 0],
          [7, 0],
        ],
        'Nordic Curls',
      ),
    ]);
    expect(marks).toEqual([{ sessionId: 'b', exerciseIndex: 0, setIndex: 0, kinds: ['wdh'] }]);
    const best = exerciseBests([
      {
        date: '2026-10-01',
        gym: { exercises: [{ name: 'Nordic Curls', sets: [{ reps: 6, weightKg: 0 }] }] },
      },
      {
        date: '2026-10-05',
        gym: { exercises: [{ name: 'Nordic Curls', sets: [{ reps: 8, weightKg: 0 }] }] },
      },
    ]);
    expect(best[0]).toMatchObject({ e1rm: 0, reps: 8, date: '2026-10-05' });
  });

  it('chronologisch, nicht nach Eingabereihenfolge', () => {
    const marks = detectPRs([gym('spaet', '2026-10-05', [[5, 100]]), gym('frueh', '2026-10-01', [[5, 80]])]);
    expect(marks.map((m) => m.sessionId)).toEqual(['spaet']);
  });
});

describe('Saisonstatistik', () => {
  const m = (p: Partial<Match>): { match: Match } => ({
    match: {
      opponent: 'X',
      goalsFor: 1,
      goalsAgainst: 1,
      minutes: 90,
      goals: 0,
      assists: 0,
      shots: 0,
      rating: 6,
      reflection: '',
      ...p,
    },
  });

  it('Saison läuft Juli bis Juni', () => {
    expect(seasonOf('2026-10-11')).toBe('2026/27');
    expect(seasonOf('2027-06-30')).toBe('2026/27');
    expect(seasonOf('2027-07-01')).toBe('2027/28');
  });

  it('berechnet Tore pro 90 und Bilanz', () => {
    const st = seasonStats([
      m({ goals: 2, shots: 4, goalsFor: 3, goalsAgainst: 1, rating: 8 }),
      m({ minutes: 45, goals: 1, assists: 1, shots: 2, goalsFor: 0, goalsAgainst: 2, rating: 6 }),
      m({ minutes: 0, rating: 5 }),
    ]);
    expect(st.games).toBe(3);
    expect(st.minutes).toBe(135);
    expect(st.goalsPer90).toBe(2);
    expect(st.conversion).toBe(50);
    expect([st.wins, st.draws, st.losses]).toEqual([1, 1, 1]);
    expect(st.avgRating).toBe(6.3);
  });

  it('leere Saison ohne Division durch null', () => {
    const st = seasonStats([]);
    expect(st.goalsPer90).toBeNull();
    expect(st.avgRating).toBeNull();
    expect(st.conversion).toBeNull();
  });
});

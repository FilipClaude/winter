import { describe, expect, it } from 'vitest';
import type { Day, Exam, Session, Sleep, StudySession } from '../../db/schemas';
import { addDays } from '../date';
import { buildInsights, dailySeries, periodSummary, significant, type ReviewData } from './review';

const T = '2026-10-11';
const meta = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };

function empty(): ReviewData {
  return {
    sessions: [],
    meals: [],
    days: [],
    sleep: [],
    health: [],
    study: [],
    exams: [],
    habits: [],
    checks: [],
  };
}

const day = (date: string, mood?: number, energy?: number): Day => ({
  ...meta,
  id: date,
  date,
  water: 0,
  note: '',
  good: '',
  better: '',
  tomorrow: '',
  ...(mood ? { mood } : {}),
  ...(energy ? { energy } : {}),
});

const sleep = (date: string, hours: number): Sleep => {
  const end = new Date(`${date}T05:00:00Z`);
  return {
    ...meta,
    id: `s${date}`,
    date,
    start: new Date(end.getTime() - hours * 3_600_000).toISOString(),
    end: end.toISOString(),
  };
};

describe('Rückblick', () => {
  it('fehlende Werte bleiben null statt 0', () => {
    const s = dailySeries(empty(), T, T)[0];
    expect(s?.sleepMin).toBeNull();
    expect(s?.proteinG).toBeNull();
    expect(s?.studyMin).toBe(0);
    const p = periodSummary(empty(), addDays(T, -6), T);
    expect(p.sleepAvgMin).toBeNull();
    expect(p.habitRate).toBeNull();
  });

  it('summiert Lernzeit und Load, mittelt Schlaf nur über erfasste Nächte', () => {
    const d = empty();
    d.study = [
      { ...meta, id: 'a', date: T, subjectId: 'm', start: '', end: '', minutes: 45 } as StudySession,
    ];
    d.sessions = [{ ...meta, id: 'x', date: T, type: 'gym', durationMin: 60, rpe: 7, note: '' } as Session];
    d.sleep = [sleep(T, 8), sleep(addDays(T, -1), 6)];
    const p = periodSummary(d, addDays(T, -6), T);
    expect(p.studyMin).toBe(45);
    expect(p.load).toBe(420);
    expect(p.sleepAvgMin).toBe(420);
  });
});

describe('Zusammenhänge', () => {
  it('meldet ehrlich „noch kein belastbarer Zusammenhang“ ohne Daten', () => {
    const ins = buildInsights(empty(), T);
    expect(ins.map((i) => i.id)).toEqual([
      'schlaf-stimmung',
      'lernen-note',
      'last-energie',
      'schritte-schlaf',
    ]);
    expect(ins.every((i) => !i.enough)).toBe(true);
    expect(ins[0]?.text).toBe('Noch kein belastbarer Zusammenhang – erst 0 von mindestens 14 Datenpunkten.');
  });

  it('unter 14 Punkten keine Aussage, auch wenn der Zusammenhang perfekt wäre', () => {
    const d = empty();
    for (let i = 0; i < 10; i++) {
      const date = addDays(T, -i);
      const long = i % 2 === 0;
      d.sleep.push(sleep(date, long ? 8.5 : 6));
      d.days.push(day(date, long ? 4 : 3));
    }
    const ins = buildInsights(d, T).find((i) => i.id === 'schlaf-stimmung');
    expect(ins?.enough).toBe(false);
    expect(ins?.n).toBe(10);
    expect(ins?.text).toContain('erst 10 von mindestens 14');
  });

  it('ab 14 Punkten: r, n und Klartext plus anschauliche Mittelwerte', () => {
    const d = empty();
    for (let i = 0; i < 16; i++) {
      const date = addDays(T, -i);
      const long = i % 2 === 0;
      d.sleep.push(sleep(date, long ? 8.5 : 6));
      d.days.push(day(date, long ? 4 : 3));
    }
    const ins = buildInsights(d, T).find((i) => i.id === 'schlaf-stimmung');
    expect(ins?.enough).toBe(true);
    expect(ins?.r).toBeCloseTo(1, 9);
    expect(ins?.text).toBe(
      'Deutlicher positiver Zusammenhang (r = 1,00, n = 16): Nach mehr Schlaf war deine Stimmung eher besser.',
    );
    expect(ins?.detail).toBe(
      'Nach mehr als 7,5 h Schlaf lag deine Stimmung im Schnitt bei 4,0, nach 7,5 h oder weniger bei 3,0.',
    );
  });

  it('schwacher Zusammenhang trotz vieler Punkte: ausdrücklich nicht belastbar', () => {
    const d = empty();
    const moods = [3, 4, 3, 3, 4, 3, 4, 4, 3, 3, 4, 3, 3, 4, 4, 3, 3, 4, 3, 4];
    moods.forEach((m, i) => {
      const date = addDays(T, -i);
      d.sleep.push(sleep(date, 6 + (i % 5) * 0.5));
      d.days.push(day(date, m));
    });
    const ins = buildInsights(d, T).find((i) => i.id === 'schlaf-stimmung');
    expect(ins?.n).toBe(20);
    expect(Math.abs(ins?.r ?? 1)).toBeLessThan(0.3);
    expect(ins?.enough).toBe(false);
    expect(ins?.text).toMatch(/^Noch kein belastbarer Zusammenhang: /);
  });

  it('Lernzeit vor Klausuren gegen Punkte (16 Klausuren)', () => {
    const d = empty();
    for (let i = 0; i < 16; i++) {
      const date = addDays(T, -20 * i);
      const lots = i < 8;
      d.exams.push({
        ...meta,
        id: `e${i}`,
        date,
        subjectId: 'm',
        kind: 'klausur',
        topics: '',
        progress: 100,
        points: lots ? 12 : 7,
      } as Exam);
      d.study.push({
        ...meta,
        id: `s${i}`,
        date: addDays(date, -3),
        subjectId: 'm',
        start: '',
        end: '',
        minutes: lots ? 600 : 60,
      } as StudySession);
    }
    const ins = buildInsights(d, T, 400).find((i) => i.id === 'lernen-note');
    expect(ins?.enough).toBe(true);
    expect(ins?.n).toBe(16);
    expect(ins?.text).toContain('Mehr Lernzeit vorher ging mit mehr Punkten einher.');
    expect(ins?.detail).toContain('12,0 Punkten');
    expect(ins?.detail).toContain('sonst bei 7,0');
  });
});

describe('Signifikanz (Review-Fund)', () => {
  it('kritische Werte: n = 14 braucht |r| ≥ ~0,53, n = 30 ~0,36', () => {
    expect(significant(0.3, 14)).toBe(false);
    expect(significant(0.5, 14)).toBe(false);
    expect(significant(0.55, 14)).toBe(true);
    expect(significant(0.35, 30)).toBe(false);
    expect(significant(0.38, 30)).toBe(true);
    expect(significant(-0.6, 20)).toBe(true);
  });
});

describe('Review 4: kritischer t-Wert nie zu großzügig', () => {
  it('df = 13 nutzt den Wert für 12 Freiheitsgrade (2,18), nicht den für 15', () => {
    // t bei r = 0,51, n = 15 (df 13): 0,51 · √(13 / (1 − 0,2601)) ≈ 2,138 → zwischen 2,13 und 2,18
    expect(significant(0.51, 15)).toBe(false);
    expect(significant(0.53, 15)).toBe(true);
  });
});

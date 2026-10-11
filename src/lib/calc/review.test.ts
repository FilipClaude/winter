import { describe, expect, it } from 'vitest';
import type { Day, Exam, Session, Sleep, StudySession } from '../../db/schemas';
import { addDays } from '../date';
import { buildInsights, dailySeries, periodSummary, type ReviewData } from './review';

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
  it('meldet ehrlich zu wenig Daten', () => {
    const ins = buildInsights(empty(), T);
    expect(ins).toHaveLength(3);
    expect(ins.every((i) => !i.enough)).toBe(true);
    expect(ins[0]?.text).toContain('Zu wenig Datenpunkte');
  });

  it('formuliert den Schlaf-Stimmungs-Vergleich mit echten Mittelwerten', () => {
    const d = empty();
    for (let i = 0; i < 10; i++) {
      const date = addDays(T, -i);
      const long = i % 2 === 0;
      d.sleep.push(sleep(date, long ? 8.5 : 6));
      d.days.push(day(date, long ? 4 : 3));
    }
    const ins = buildInsights(d, T).find((i) => i.id === 'schlaf-stimmung');
    expect(ins?.enough).toBe(true);
    expect(ins?.text).toBe(
      'Nach mehr als 7,5 h Schlaf lag deine Stimmung im Schnitt bei 4,0, nach 7,5 h oder weniger bei 3,0.',
    );
  });

  it('Lernzeit vor Klausuren gegen Punkte', () => {
    const d = empty();
    for (let i = 0; i < 8; i++) {
      const date = addDays(T, -20 * i);
      const lots = i < 4;
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
    expect(ins?.text).toContain('12,0 Punkten');
    expect(ins?.text).toContain('sonst bei 7,0');
  });
});

import { describe, expect, it } from 'vitest';
import {
  easterSunday,
  isSchoolDay,
  nextBreak,
  publicHolidaysBY,
  schoolFreeReason,
  weekType,
} from './calendar-by';
import { buildStudyPlan } from './studyplan';

describe('Kalender Bayern', () => {
  it('Ostersonntag (bekannte Termine)', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(easterSunday(2024)).toBe('2024-03-31');
  });

  it('bewegliche Feiertage 2027', () => {
    const h = publicHolidaysBY(2027);
    const date = (name: string) => h.find((x) => x.name === name)?.date;
    expect(date('Karfreitag')).toBe('2027-03-26');
    expect(date('Christi Himmelfahrt')).toBe('2027-05-06');
    expect(date('Pfingstmontag')).toBe('2027-05-17');
    expect(date('Fronleichnam')).toBe('2027-05-27');
  });

  it('schulfreie Tage: Ferien, Feiertage, Wochenende, Buß- und Bettag', () => {
    expect(schoolFreeReason('2026-11-04')).toBe('Allerheiligen');
    expect(schoolFreeReason('2026-11-18')).toBe('Buß- und Bettag');
    expect(schoolFreeReason('2027-01-06')).toBe('Weihnachtsferien');
    expect(schoolFreeReason('2026-10-17')).toBe('Wochenende');
    expect(schoolFreeReason('2027-05-17')).toBe('Pfingstmontag'); // Ferien erst ab 18.05.
    expect(schoolFreeReason('2027-05-18')).toBe('Pfingstferien');
    expect(isSchoolDay('2026-10-13')).toBe(true);
    expect(isSchoolDay('2027-01-11')).toBe(true);
  });

  it('nächste Ferien', () => {
    expect(nextBreak('2026-10-12')).toMatchObject({ name: 'Allerheiligen', inDays: 21 });
    expect(nextBreak('2026-11-04')).toMatchObject({ name: 'Allerheiligen', inDays: 0 });
  });

  it('A/B-Wochen wechseln wöchentlich, auch über den Jahreswechsel', () => {
    const ref = '2026-09-14';
    expect(weekType('2026-09-16', ref)).toBe('A');
    expect(weekType('2026-09-21', ref)).toBe('B');
    expect(weekType('2026-09-28', ref)).toBe('A');
    expect(weekType('2026-09-13', ref)).toBe('B'); // Sonntag davor = Vorwoche
    // 2026-12-28 liegt 15 Wochen nach dem 14.09. → B; 2027-01-04 → A
    expect(weekType('2026-12-28', ref)).toBe('B');
    expect(weekType('2027-01-04', ref)).toBe('A');
  });
});

describe('Lernplan (Spaced Repetition)', () => {
  const topics = [
    { title: 'Kurvendiskussion', level: 0 },
    { title: 'Integrale', level: 1 },
    { title: 'Stochastik', level: 2 },
  ];

  it('nichts am oder nach dem Klausurtag, Abschlusswiederholung am Vortag', () => {
    const p = buildStudyPlan('2026-10-23', '2026-10-13', topics);
    expect(p.blocks.every((b) => b.date < '2026-10-23' && b.date >= '2026-10-13')).toBe(true);
    const final = p.blocks.find((b) => b.topic.startsWith('Abschlusswiederholung'));
    expect(final?.date).toBe('2026-10-22');
    expect(final?.topic).toContain('Stochastik');
  });

  it('schwächstes Thema zuerst, Wiederholungen nach 1, 3, 7 Tagen', () => {
    const p = buildStudyPlan('2026-10-23', '2026-10-13', topics);
    const k = p.blocks.filter((b) => b.topic === 'Kurvendiskussion');
    expect(k[0]).toMatchObject({ date: '2026-10-13', kind: 'lernen', minutes: 30 });
    expect(k.filter((b) => b.kind === 'wiederholen').map((b) => b.date)).toEqual([
      '2026-10-14',
      '2026-10-16',
      '2026-10-20',
    ]);
    // „sitzt“ (Stufe 2): kein Neulernen, nur Wiederholungen
    expect(p.blocks.some((b) => b.topic === 'Stochastik' && b.kind === 'lernen')).toBe(false);
  });

  it('Klausur morgen: nur ein Tag, alles kompakt, Warnung bei Überbuchung', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ title: `Thema ${i + 1}`, level: 0 }));
    const p = buildStudyPlan('2026-10-14', '2026-10-13', many);
    expect(new Set(p.blocks.map((b) => b.date))).toEqual(new Set(['2026-10-13']));
    expect(p.warning).toContain('mehr als geplant');
  });

  it('Klausur heute oder vorbei: kein Plan', () => {
    expect(buildStudyPlan('2026-10-13', '2026-10-13', topics).blocks).toEqual([]);
    expect(buildStudyPlan('2026-10-10', '2026-10-13', topics).warning).toContain('vorbei');
  });

  it('schulfreie Tage haben mehr Platz (Wochenende)', () => {
    const many = Array.from({ length: 4 }, (_, i) => ({ title: `T${i}`, level: 0 }));
    const p = buildStudyPlan('2026-10-20', '2026-10-16', many, { minutesPerSchoolDay: 30 });
    const sat = p.blocks.filter((b) => b.date === '2026-10-17').reduce((a, b) => a + b.minutes, 0);
    expect(sat).toBeLessThanOrEqual(60);
    expect(sat).toBeGreaterThan(30);
  });
});

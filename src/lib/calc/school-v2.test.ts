import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/db';
import { saveTodo, startTimer, stopTimer, toggleTodo } from '../../db/repo';
import { eaPassed, moduleEligibility } from './fernuni';
import { pomodoroState } from './school';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Pomodoro', () => {
  it('Phasen 25/5: Fokus, Pause, nächste Runde; nur Fokuszeit zählt', () => {
    expect(pomodoroState(0, 25, 5)).toMatchObject({
      phase: 'fokus',
      round: 1,
      remainingSec: 1500,
      focusSec: 0,
    });
    expect(pomodoroState(26 * 60, 25, 5)).toMatchObject({
      phase: 'pause',
      round: 1,
      remainingSec: 240,
      focusSec: 1500,
    });
    expect(pomodoroState(31 * 60, 25, 5)).toMatchObject({ phase: 'fokus', round: 2, focusSec: 1560 });
  });

  it('Timer im Pomodoro-Modus bucht nur die Fokuszeit (60 min → 50 min)', async () => {
    const start = new Date('2026-10-13T14:00:00Z');
    await startTimer('fach', start, { workMin: 25, breakMin: 5 });
    const min = await stopTimer(new Date('2026-10-13T15:00:00Z'));
    expect(min).toBe(50);
    expect((await db.studySessions.toArray()).reduce((a, s) => a + s.minutes, 0)).toBe(50);
  });
});

describe('Aufgaben mit Wiederholung', () => {
  it('wöchentlich: Abhaken legt genau eine Folgeaufgabe 7 Tage nach der Fälligkeit an', async () => {
    const t = await saveTodo({
      date: '2026-10-12',
      title: 'Vokabeln',
      due: '2026-10-14',
      done: false,
      repeat: 'weekly',
      priority: 'hoch',
    });
    await toggleTodo(t.id);
    await toggleTodo(t.id); // wieder öffnen
    await toggleTodo(t.id); // erneut abhaken: keine zweite Folgeaufgabe
    const all = await db.todos.toArray();
    const next = all.filter((x) => x.due === '2026-10-21');
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ title: 'Vokabeln', done: false, repeat: 'weekly', priority: 'hoch' });
  });
});

describe('FernUni: Prüfungsberechtigung', () => {
  it('EA bestanden ab Schwelle (Rand genau 50 %)', () => {
    expect(eaPassed({ points: 50, maxPoints: 100 }, 50)).toBe(true);
    expect(eaPassed({ points: 49, maxPoints: 100 }, 50)).toBe(false);
    expect(eaPassed({ maxPoints: 100 }, 50)).toBeNull();
  });

  it('„mindestens eine EA mit 50 %“: offen → bestanden; nicht mehr erreichbar wird erkannt', () => {
    const rule = { rule: { minPassed: 1, passPercent: 50 } };
    const ea = (points?: number) => ({
      kind: 'einsendearbeit' as const,
      maxPoints: 100,
      ...(points !== undefined ? { points } : {}),
    });
    expect(moduleEligibility(rule, [ea(), ea()])).toMatchObject({
      eligible: false,
      open: 2,
      unreachable: false,
    });
    expect(moduleEligibility(rule, [ea(30), ea(62)])).toMatchObject({ eligible: true, passed: 1 });
    expect(moduleEligibility({ rule: { minPassed: 2, passPercent: 50 } }, [ea(30), ea(62)])).toMatchObject({
      eligible: false,
      unreachable: true,
    });
    expect(moduleEligibility({}, [ea(80)]).eligible).toBeNull();
  });
});
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

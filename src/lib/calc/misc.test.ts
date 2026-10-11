import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Habit, type HealthDay, type Sleep } from '../../db/schemas';
import { addDays } from '../date';
import { dailyCompletion, habitRate, habitStreak, heatLevel } from './habits';
import { compareByThreshold, describeCorrelation, median, pearson } from './insights';
import { dayRing } from './ring';
import {
  countdownLabel,
  deadlineLevel,
  pointsAverage,
  pointsToDecimalGrade,
  pointsToGrade,
  studyBefore,
} from './school';
import { effectiveSleep, sleepFromWallTimes, sleepMinutes } from './sleep';

describe('Schlaf', () => {
  it('über Mitternacht', () => {
    const { start, end } = sleepFromWallTimes('2026-10-12', '23:30', '07:00');
    expect(sleepMinutes(start, end)).toBe(450);
  });

  it('Einschlafen nach Mitternacht', () => {
    const { start, end } = sleepFromWallTimes('2026-10-12', '00:45', '08:15');
    expect(sleepMinutes(start, end)).toBe(450);
  });

  it('Nacht der Zeitumstellung im Oktober hat eine Stunde mehr', () => {
    const { start, end } = sleepFromWallTimes('2026-10-25', '23:00', '07:00');
    expect(sleepMinutes(start, end)).toBe(9 * 60);
  });

  it('Nacht der Zeitumstellung im März hat eine Stunde weniger', () => {
    const { start, end } = sleepFromWallTimes('2026-03-29', '23:00', '07:00');
    expect(sleepMinutes(start, end)).toBe(7 * 60);
  });

  it('Ende vor Start ergibt 0', () => {
    expect(sleepMinutes('2026-10-12T07:00:00Z', '2026-10-11T23:00:00Z')).toBe(0);
  });

  it('manueller Eintrag schlägt Health', () => {
    const manual = { start: '2026-10-11T21:00:00Z', end: '2026-10-12T05:00:00Z', quality: 4 } as Sleep;
    const health = { sleepStart: '2026-10-11T22:00:00Z', sleepEnd: '2026-10-12T05:00:00Z' } as HealthDay;
    expect(effectiveSleep(manual, health)?.source).toBe('manuell');
    expect(effectiveSleep(manual, health)?.minutes).toBe(480);
    expect(effectiveSleep(undefined, health)?.minutes).toBe(420);
    expect(effectiveSleep(undefined, undefined)).toBeNull();
  });
});

describe('Noten', () => {
  it('Punkteschnitt', () => {
    expect(pointsAverage([11, 13, 8])).toBe(10.7);
    expect(pointsAverage([])).toBeNull();
    expect(pointsAverage([16, -1, 12.5])).toBeNull();
  });

  it('Punkte → Note', () => {
    expect([15, 14, 13, 12, 10, 7, 5, 4, 1, 0].map(pointsToGrade)).toEqual([
      '1+', '1', '1−', '2+', '2−', '3−', '4', '4−', '5−', '6',
    ]);
    expect(pointsToDecimalGrade(11)).toBe(2);
    expect(pointsToDecimalGrade(15)).toBe(0.7);
  });
});

describe('Fristen', () => {
  const T = '2026-10-11';
  it('Warnstufen 14 / 7 / 2 Tage', () => {
    expect(deadlineLevel(addDays(T, 20), T)).toBe('spaeter');
    expect(deadlineLevel(addDays(T, 14), T)).toBe('bald');
    expect(deadlineLevel(addDays(T, 7), T)).toBe('nah');
    expect(deadlineLevel(addDays(T, 2), T)).toBe('kritisch');
    expect(deadlineLevel(T, T)).toBe('kritisch');
    expect(deadlineLevel(addDays(T, -1), T)).toBe('ueberfaellig');
  });

  it('Countdown-Texte', () => {
    expect(countdownLabel(T, T)).toBe('heute');
    expect(countdownLabel(addDays(T, 1), T)).toBe('morgen');
    expect(countdownLabel(addDays(T, 9), T)).toBe('in 9 Tagen');
    expect(countdownLabel(addDays(T, -3), T)).toBe('seit 3 Tagen überfällig');
  });

  it('Lernzeit vor einem Termin', () => {
    const sessions = [
      { subjectId: 'm', date: '2026-10-01', minutes: 30 },
      { subjectId: 'm', date: '2026-10-10', minutes: 60 },
      { subjectId: 'm', date: '2026-10-11', minutes: 99 }, // Termintag zählt nicht
      { subjectId: 'd', date: '2026-10-09', minutes: 45 },
      { subjectId: 'm', date: '2026-09-20', minutes: 500 }, // zu früh
    ];
    expect(studyBefore(sessions, 'm', '2026-10-11')).toBe(90);
  });
});

describe('Habits und Streaks', () => {
  const T = '2026-10-11'; // Sonntag
  const daily: Pick<Habit, 'schedule' | 'startDate'> = { schedule: { kind: 'daily' }, startDate: '2026-09-01' };

  it('zählt aufeinanderfolgende Tage, offener heutiger Tag bricht nicht', () => {
    const checked = new Set([addDays(T, -1), addDays(T, -2), addDays(T, -3)]);
    expect(habitStreak(daily, checked, T)).toEqual({ current: 3, longest: 3 });
    checked.add(T);
    expect(habitStreak(daily, checked, T).current).toBe(4);
  });

  it('Lücke beendet den Streak, längster bleibt erhalten', () => {
    const checked = new Set(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', addDays(T, -1)]);
    expect(habitStreak(daily, checked, T)).toEqual({ current: 1, longest: 4 });
  });

  it('Wochentags-Habits überspringen freie Tage', () => {
    const monWedFri: Pick<Habit, 'schedule' | 'startDate'> = {
      schedule: { kind: 'weekdays', days: [1, 3, 5] },
      startDate: '2026-09-01',
    };
    // Fr 09.10., Mi 07.10., Mo 05.10. erledigt; heute So nicht geplant
    const checked = new Set(['2026-10-09', '2026-10-07', '2026-10-05']);
    expect(habitStreak(monWedFri, checked, T).current).toBe(3);
  });

  it('vor dem Starttag zählt nichts', () => {
    const fresh = { schedule: { kind: 'daily' as const }, startDate: T };
    expect(habitStreak(fresh, new Set(), T)).toEqual({ current: 0, longest: 0 });
  });

  it('Quote und Heatmap', () => {
    const habits = [{ id: 'a', ...daily }, { id: 'b', schedule: { kind: 'weekdays' as const, days: [7] }, startDate: '2026-09-01' }];
    const checks = [
      { habitId: 'a', date: T },
      { habitId: 'b', date: T },
      { habitId: 'a', date: addDays(T, -1) },
    ];
    expect(habitRate(habits, checks, addDays(T, -1), T)).toBe(1);
    const c = dailyCompletion(habits, checks, [addDays(T, -2), T]);
    expect(c.get(addDays(T, -2))).toBe(0);
    expect(c.get(T)).toBe(1);
    expect(habitRate([], [], T, T)).toBeNull();
    expect([null, 0, 0.2, 0.5, 0.8, 1].map(heatLevel)).toEqual([0, 0, 1, 2, 3, 4]);
  });
});

describe('Tagesring', () => {
  it('Durchschnitt gedeckelter Teilziele', () => {
    const r = dayRing(
      { habitsDone: 1, habitsPlanned: 2, proteinG: 280, waterGlasses: 5, studyMin: 0, sleepMin: 480 },
      DEFAULT_SETTINGS.goals,
      DEFAULT_SETTINGS.ring,
    );
    // Habits 0,5 · Protein 1 (gedeckelt) · Wasser 0,5 · Lernen 0 · Schlaf 1
    expect(r.parts).toHaveLength(5);
    expect(r.total).toBeCloseTo(0.6);
  });

  it('ohne geplante Habits und mit deaktivierten Zielen', () => {
    const r = dayRing(
      { habitsDone: 0, habitsPlanned: 0, proteinG: 70, waterGlasses: 0, studyMin: 0, sleepMin: null },
      { ...DEFAULT_SETTINGS.goals, proteinG: 140 },
      { habits: true, protein: true, water: false, study: false, sleep: false },
    );
    expect(r.parts.map((p) => p.key)).toEqual(['protein']);
    expect(r.total).toBe(0.5);
  });
});

describe('Zusammenhänge', () => {
  it('Gruppenvergleich mit Mindestanzahl', () => {
    const pairs: [number, number][] = [
      [8, 4], [8.5, 5], [7.8, 4], [9, 4],
      [6, 3], [6.5, 2], [7, 3], [5.5, 3],
    ];
    const c = compareByThreshold(pairs, 7.5);
    expect(c.enough).toBe(true);
    expect(c.meanHigh).toBe(4.25);
    expect(c.meanLow).toBe(2.75);
    expect(compareByThreshold(pairs.slice(0, 5), 7.5).enough).toBe(false);
  });

  it('Korrelation ehrlich beschrieben', () => {
    expect(pearson([[1, 1], [2, 2], [3, 3]])).toBeCloseTo(1);
    expect(pearson([[1, 1], [1, 2], [1, 3]])).toBeNull();
    expect(describeCorrelation(0.9, 5)).toBe('zu wenig Daten für eine Aussage');
    expect(describeCorrelation(0.1, 20)).toBe('kein erkennbarer Zusammenhang');
    expect(describeCorrelation(-0.5, 20)).toBe('mäßiger negativer Zusammenhang');
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBeNull();
  });
});

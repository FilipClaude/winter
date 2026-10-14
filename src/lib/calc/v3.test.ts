import { describe, expect, it } from 'vitest';
import { DEFAULT_NP_SCALE } from '../../db/schemas';
import { todayISO } from '../date';
import { formatEuro, parseEuroToCents, sumCents, weekOf, weeklyTotals } from './earnings';
import {
  examCountdown,
  formatExamDay,
  lastMock,
  mockPercent,
  mockResults,
  mockTrend,
  percentToPoints,
  pickNextExams,
  upcomingExams,
} from './exams';
import { sessionTitle, splitCounts, splitSummary } from './training';

const at = '2026-10-01T00:00:00.000Z';

describe('Nächste Klausur', () => {
  const exam = (id: string, date: string, points?: number, createdAt = at) => ({
    id,
    date,
    createdAt,
    ...(points !== undefined ? { points } : {}),
  });

  it('nur anstehende, unbewertete Klausuren, chronologisch; gleicher Tag: zuerst angelegt', () => {
    const list = upcomingExams(
      [
        exam('alt', '2026-10-12'),
        exam('b', '2026-10-20', undefined, '2026-10-02T00:00:00.000Z'),
        exam('bewertet', '2026-10-15', 11),
        exam('a', '2026-10-20'),
        exam('heute', '2026-10-13'),
      ],
      '2026-10-13',
    );
    expect(list.map((e) => e.id)).toEqual(['heute', 'a', 'b']);
  });

  it('übernächste nur, wenn am selben Tag oder höchstens 7 Tage dahinter', () => {
    expect(pickNextExams([])).toEqual({ next: null, also: null });
    const same = pickNextExams([exam('a', '2026-10-20'), exam('b', '2026-10-20')]);
    expect([same.next?.id, same.also?.id]).toEqual(['a', 'b']);
    expect(pickNextExams([exam('a', '2026-10-20'), exam('b', '2026-10-27')]).also?.id).toBe('b');
    expect(pickNextExams([exam('a', '2026-10-20'), exam('b', '2026-10-28')]).also).toBeNull();
  });

  it('Countdown und Datum mit Wochentag', () => {
    expect(examCountdown('2026-10-13', '2026-10-13')).toBe('heute');
    expect(examCountdown('2026-10-14', '2026-10-13')).toBe('morgen');
    expect(examCountdown('2026-10-18', '2026-10-13')).toBe('in 5 Tagen');
    expect(formatExamDay('2026-10-16')).toBe('Fr, 16.10.');
  });

  it('Mitternacht in Berlin: 23:59 noch „morgen“, 00:00 „heute“', () => {
    const exam = '2026-10-16';
    expect(examCountdown(exam, todayISO(new Date('2026-10-15T21:59:00Z')))).toBe('morgen'); // 23:59 MESZ
    expect(examCountdown(exam, todayISO(new Date('2026-10-15T22:00:00Z')))).toBe('heute'); // 00:00 MESZ
  });

  it('Zeitumstellung am 25.10.2026: der 25. hat 25 Stunden, der Countdown springt trotzdem genau um Mitternacht', () => {
    const exam = '2026-10-26';
    // 25.10. 00:30 MESZ (= 24.10. 22:30 UTC) → schon der 25.
    expect(todayISO(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
    expect(examCountdown(exam, todayISO(new Date('2026-10-24T22:30:00Z')))).toBe('morgen');
    // 02:30 kommt zweimal vor (MESZ und MEZ) – beides ist der 25.
    expect(todayISO(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25');
    expect(todayISO(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-25');
    // 23:59 MEZ (= 22:59 UTC) noch „morgen“, 00:00 MEZ (= 23:00 UTC) „heute“
    expect(examCountdown(exam, todayISO(new Date('2026-10-25T22:59:00Z')))).toBe('morgen');
    expect(examCountdown(exam, todayISO(new Date('2026-10-25T23:00:00Z')))).toBe('heute');
    // über die Umstellung hinweg zählen Kalendertage, nicht 24-h-Schritte
    expect(examCountdown('2026-10-30', '2026-10-24')).toBe('in 6 Tagen');
  });
});

describe('Probe-Klausuren', () => {
  it('Prüfwerte aus dem Auftrag: 13/25 BE ≈ 6 NP, 15,5/22 BE ≈ 10 NP', () => {
    expect(mockPercent({ points: 13, maxPoints: 25 })).toBe(52);
    expect(percentToPoints(52)).toBe(6);
    expect(mockPercent({ points: 15.5, maxPoints: 22 })).toBe(70.5);
    expect(percentToPoints(mockPercent({ points: 15.5, maxPoints: 22 }))).toBe(10);
  });

  it('Standardtabelle (EPA): Schwellen, Grenzen und Ränder', () => {
    expect(DEFAULT_NP_SCALE).toHaveLength(15);
    expect(percentToPoints(100)).toBe(15);
    expect(percentToPoints(95)).toBe(15);
    expect(percentToPoints(94.9)).toBe(14);
    expect(percentToPoints(45)).toBe(5);
    expect(percentToPoints(44.9)).toBe(4);
    expect(percentToPoints(33)).toBe(3);
    expect(percentToPoints(20)).toBe(1);
    expect(percentToPoints(19.9)).toBe(0);
    expect(percentToPoints(0)).toBe(0);
  });

  it('eigene Tabelle der Schule', () => {
    const strict = [96, 91, 86, 81, 76, 71, 66, 61, 56, 51, 46, 41, 34, 27, 20];
    expect(percentToPoints(70.5, strict)).toBe(9);
    expect(percentToPoints(52, strict)).toBe(6);
  });

  it('Verlauf, letzter Durchgang und Trend', () => {
    const m = (id: string, date: string, points: number, examId = 'e1') => ({
      id,
      date,
      createdAt: at,
      examId,
      subjectId: 'mathe',
      points,
      maxPoints: 20,
    });
    const r = mockResults([
      m('c', '2026-10-12', 15),
      m('a', '2026-10-05', 10),
      m('b', '2026-10-08', 12, 'e2'),
    ]);
    expect(r.map((x) => [x.id, x.percent, x.points])).toEqual([
      ['a', 50, 6],
      ['b', 60, 8],
      ['c', 75, 11],
    ]);
    expect(lastMock(r, 'e1')?.id).toBe('c');
    expect(lastMock(r, 'nix')).toBeUndefined();
    expect(mockTrend(r.filter((x) => x.examId === 'e1'))).toBe(5);
    expect(mockTrend(r.slice(0, 1))).toBeNull();
    // mehr erreicht als möglich wird gedeckelt (Validierung verhindert es ohnehin)
    expect(mockPercent({ points: 25, maxPoints: 20 })).toBe(100);
  });
});

describe('Verdienst', () => {
  it('Komma-Eingabe → Cent als Ganzzahl', () => {
    expect(parseEuroToCents('12,5')).toBe(1250);
    expect(parseEuroToCents('12,50')).toBe(1250);
    expect(parseEuroToCents('12,50 €')).toBe(1250);
    expect(parseEuroToCents(' 7 ')).toBe(700);
    expect(parseEuroToCents('0,05')).toBe(5);
    expect(parseEuroToCents('1.234,56')).toBe(123456);
    expect(parseEuroToCents('1.234')).toBe(123400);
    expect(parseEuroToCents('12.5')).toBe(1250);
    expect(parseEuroToCents(',5')).toBeNull();
    expect(parseEuroToCents('')).toBeNull();
    expect(parseEuroToCents('-3')).toBeNull();
    expect(parseEuroToCents('abc')).toBeNull();
    expect(parseEuroToCents('12,5,1')).toBeNull();
  });

  it('Rundung ohne Gleitkomma-Fehler', () => {
    expect(parseEuroToCents('2,345')).toBe(235);
    expect(parseEuroToCents('2,344')).toBe(234);
    expect(parseEuroToCents('0,1')).toBe(10);
    expect(parseEuroToCents('19,99')).toBe(1999);
    expect(parseEuroToCents('1,005')).toBe(101);
    expect(0.1 + 0.2).not.toBe(0.3); // deshalb Cent
  });

  it('Anzeige in Euro (de-DE)', () => {
    expect(formatEuro(4750)).toBe('47,50 €');
    expect(formatEuro(0)).toBe('0,00 €');
    expect(formatEuro(123456)).toBe('1.234,56 €');
  });

  it('Wochengrenzen: Sonntag 23:59 gehört zur alten, Montag 00:00 zur neuen Woche', () => {
    // So 18.10.2026 23:59 MESZ = 21:59 UTC; Mo 19.10. 00:00 MESZ = 22:00 UTC
    expect(weekOf(todayISO(new Date('2026-10-18T21:59:00Z')))).toEqual({
      from: '2026-10-12',
      to: '2026-10-18',
    });
    expect(weekOf(todayISO(new Date('2026-10-18T22:00:00Z')))).toEqual({
      from: '2026-10-19',
      to: '2026-10-25',
    });
    const rows = [
      { date: '2026-10-18', amountCents: 1000 },
      { date: '2026-10-19', amountCents: 250 },
    ];
    expect(sumCents(rows, '2026-10-12', '2026-10-18')).toBe(1000);
    expect(sumCents(rows, '2026-10-19', '2026-10-25')).toBe(250);
  });

  it('Woche mit der Zeitumstellung (19.–25.10.2026) und KW 1 über den Jahreswechsel', () => {
    expect(weekOf('2026-10-25')).toEqual({ from: '2026-10-19', to: '2026-10-25' });
    expect(weekOf('2026-10-26')).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    // KW 1/2027 beginnt am Montag, 4.1.2027; der 1.1.2027 (Fr) gehört noch zur KW 53/2026
    expect(weekOf('2027-01-01')).toEqual({ from: '2026-12-28', to: '2027-01-03' });
    expect(weekOf('2027-01-04')).toEqual({ from: '2027-01-04', to: '2027-01-10' });
    const totals = weeklyTotals(
      [
        { date: '2027-01-01', amountCents: 900 },
        { date: '2027-01-04', amountCents: 100 },
      ],
      '2027-01-05',
      3,
    );
    expect(totals.map((t) => [t.kw, t.cents])).toEqual([
      [52, 0],
      [53, 900],
      [1, 100],
    ]);
  });
});

describe('Gym-Split', () => {
  it('Titel mit Split, alte Einheiten bleiben „Gym“', () => {
    expect(sessionTitle({ type: 'gym', split: 'push' })).toBe('Gym · Push');
    expect(sessionTitle({ type: 'gym' })).toBe('Gym');
    expect(sessionTitle({ type: 'football' })).toBe('Fußball-Training');
  });

  it('Verteilung pro Zeitraum', () => {
    const c = splitCounts([
      { type: 'gym', split: 'push' },
      { type: 'gym', split: 'push' },
      { type: 'gym', split: 'pull' },
      { type: 'gym', split: 'legs' },
      { type: 'gym' },
      { type: 'football' },
    ]);
    expect(c).toEqual({ push: 2, pull: 1, legs: 1, none: 1 });
    expect(splitSummary(c)).toBe('2× Push, 1× Pull, 1× Legs, 1× Gym');
    expect(splitSummary(splitCounts([{ type: 'run' }]))).toBe('');
  });
});

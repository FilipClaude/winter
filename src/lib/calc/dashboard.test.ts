import { describe, expect, it } from 'vitest';
import type { Session } from '../../db/schemas';
import { DEFAULT_DASHBOARD } from '../../db/schemas';
import { buildBriefing, type BriefingInput } from './briefing';
import { moveWidget, normalizeDashboard, orderForDisplay } from './dashboard-layout';
import { goalProgress } from './goals';
import type { ReviewData } from './review';

const base: BriefingInput = {
  today: '2026-10-13',
  deadlines: [],
  exams: [],
  training: { planned: [], done: 0 },
  studyBlocks: { open: 0, minutes: 0, subjects: [] },
  schoolFree: null,
  nextBreak: null,
  habitsOpen: 0,
};

describe('Tagesbriefing', () => {
  it('Beispiel aus dem Auftrag: Klausur + Training + Lerneinheiten', () => {
    const b = buildBriefing({
      ...base,
      exams: [{ subject: 'Mathe', kind: 'Klausur', date: '2026-10-16', progress: 60 }],
      training: { planned: ['Fußball-Training'], done: 0 },
      studyBlocks: { open: 2, minutes: 45, subjects: ['Mathe', 'Mathe'] },
    });
    expect(b).toEqual([
      'Mathe-Klausur in 3 Tagen, Lernstand 60 %.',
      'Heute Fußball-Training, danach 2 Lerneinheiten Mathe (45 min).',
    ]);
  });

  it('überfällige Frist steht vorne, höchstens zwei Sätze', () => {
    const b = buildBriefing({
      ...base,
      deadlines: [{ title: 'EA 2', module: 'BWL', date: '2026-10-11' }],
      exams: [{ subject: 'Mathe', kind: 'Klausur', date: '2026-10-14', progress: 20 }],
      training: { planned: ['Gym'], done: 0 },
    });
    expect(b[0]).toBe('EA 2 (BWL) ist seit 2 Tagen überfällig.');
    expect(b[1]).toBe('Mathe-Klausur morgen, Lernstand 20 %.');
    expect(b).toHaveLength(2);
  });

  it('Spiel hat Vorrang vor dem Wochenplan; erledigtes Training wird nicht angekündigt', () => {
    expect(
      buildBriefing({
        ...base,
        match: { opponent: 'FC Puchheim', time: '14:00', home: false },
        training: { planned: ['Spiel'], done: 0 },
      }),
    ).toEqual(['Heute Spiel 14:00 bei FC Puchheim.']);
    expect(buildBriefing({ ...base, training: { planned: ['Gym'], done: 1 }, habitsOpen: 1 })).toEqual([
      'Heute nichts Dringendes – 1 Habit ist noch offen.',
    ]);
  });

  it('schulfrei und Ferien-Vorschau', () => {
    expect(buildBriefing({ ...base, schoolFree: 'Allerheiligen' })).toEqual(['Schulfrei: Allerheiligen.']);
    expect(buildBriefing({ ...base, nextBreak: { name: 'Allerheiligen', inDays: 5 } })).toEqual([
      'Allerheiligen in 5 Tagen.',
    ]);
  });
});

const empty: ReviewData = {
  sessions: [],
  meals: [],
  days: [],
  sleep: [],
  health: [],
  study: [],
  exams: [],
  habits: [],
  checks: [],
  earnings: [],
};
const session = (date: string, type: Session['type']): Session => ({
  id: `${date}-${type}`,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  date,
  type,
  durationMin: 60,
  rpe: 6,
  note: '',
});

describe('Ziele', () => {
  it('3× Gym pro Woche: zählt nur die laufende Woche (Mo–So)', () => {
    const data = {
      ...empty,
      sessions: [
        session('2026-10-11', 'gym'),
        session('2026-10-12', 'gym'),
        session('2026-10-14', 'gym'),
        session('2026-10-14', 'football'),
      ],
    };
    const p = goalProgress({ metric: 'gymSessions', period: 'week', target: 3 }, data, '2026-10-15', null);
    expect(p.value).toBe(2);
    expect(p.ratio).toBeCloseTo(2 / 3, 9);
    expect(p.reached).toBe(false);
  });

  it('10 h Lernen: in Minuten gespeichert, in Stunden angezeigt', () => {
    const study = [600, 30].map((minutes, i) => ({
      id: `s${i}`,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      date: '2026-10-13',
      subjectId: 'm',
      start: '2026-10-13T10:00:00.000Z',
      end: '2026-10-13T11:00:00.000Z',
      minutes,
    }));
    const p = goalProgress(
      { metric: 'studyMin', period: 'week', target: 600 },
      { ...empty, study },
      '2026-10-13',
      null,
    );
    expect(p.reached).toBe(true);
    expect(p.targetShown).toBe(10);
    expect(p.valueShown).toBe(10.5);
    expect(p.ratio).toBe(1);
  });

  it('Abi-Schnitt ≤ 1,5: niedriger ist besser', () => {
    expect(
      goalProgress({ metric: 'abiAverage', period: 'month', target: 1.5 }, empty, '2026-10-13', 1.4).reached,
    ).toBe(true);
    const p = goalProgress({ metric: 'abiAverage', period: 'month', target: 1.5 }, empty, '2026-10-13', 2.0);
    expect(p.reached).toBe(false);
    expect(p.ratio).toBeCloseTo(0.75, 9);
  });

  it('ohne Daten: kein Wert, 0 % Fortschritt', () => {
    const p = goalProgress({ metric: 'avgProtein', period: 'week', target: 130 }, empty, '2026-10-13', null);
    expect(p.value).toBeNull();
    expect(p.ratio).toBe(0);
  });
});

describe('Dashboard-Anordnung', () => {
  it('bereinigt Duplikate/Unbekanntes und hängt fehlende Widgets an', () => {
    const stored = [
      { id: 'habits' as const, size: 's' as const, hidden: false },
      { id: 'habits' as const, size: 'l' as const, hidden: true },
      { id: 'gibtsnicht' as never, size: 'l' as const, hidden: false },
    ];
    const n = normalizeDashboard(stored);
    expect(n[0]).toEqual({ id: 'habits', size: 's', hidden: false });
    expect(n.filter((w) => w.id === 'habits')).toHaveLength(1);
    expect(n).toHaveLength(DEFAULT_DASHBOARD.length);
  });

  it('kritische Fristen: Hinweise ganz oben, auch wenn ausgeblendet oder weit unten', () => {
    const list = normalizeDashboard(
      DEFAULT_DASHBOARD.map((w) => (w.id === 'alerts' ? { ...w, hidden: true } : w)),
    );
    const moved = moveWidget(list, 'alerts', 10);
    expect(orderForDisplay(moved, false).some((w) => w.id === 'alerts')).toBe(false);
    const shown = orderForDisplay(moved, true);
    expect(shown[0]?.id).toBe('alerts');
    expect(shown.filter((w) => w.id === 'alerts')).toHaveLength(1);
  });

  it('Verschieben per Pfeil bleibt in den Grenzen', () => {
    const list = normalizeDashboard(DEFAULT_DASHBOARD);
    const first = list[0]?.id;
    expect(moveWidget(list, first ?? 'ring', -1)).toBe(list);
    expect(moveWidget(list, first ?? 'ring', 1)[1]?.id).toBe(first);
  });
});

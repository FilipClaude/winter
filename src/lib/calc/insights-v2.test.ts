import { describe, expect, it } from 'vitest';
import type { Day, Session, Sleep } from '../../db/schemas';
import { dailySeries, type ReviewData } from './review';
import { movingAverage, previousRange, yearHeatmap } from './trends';
import { weeklyFileName, weeklyMarkdown, weeklyReport } from './weekly';

const meta = { createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' };
const empty = (): ReviewData => ({
  sessions: [],
  meals: [],
  days: [],
  sleep: [],
  health: [],
  study: [],
  exams: [],
  habits: [],
  checks: [],
});
const sleepOn = (date: string, h: number): Sleep => ({
  ...meta,
  id: `sl-${date}`,
  date,
  start: new Date(Date.parse(`${date}T06:00:00Z`) - h * 3_600_000).toISOString(),
  end: `${date}T06:00:00.000Z`,
});
const dayMood = (date: string, mood: number): Day => ({
  ...meta,
  id: date,
  date,
  water: 0,
  mood,
  note: '',
  good: '',
  better: '',
  tomorrow: '',
});

describe('Gleitende Durchschnitte', () => {
  it('7-Tage-Schnitt erst ab halbem Fenster, Lücken werden übersprungen', () => {
    const v = [1, null, 3, 5, null, 7, 9, 11];
    const ma = movingAverage(v, 7);
    expect(ma.slice(0, 3)).toEqual([null, null, null]); // < 4 Werte
    expect(ma[5]).toBe((1 + 3 + 5 + 7) / 4);
    expect(ma[7]).toBe((3 + 5 + 7 + 9 + 11) / 5); // Fenster Index 1–7
  });
});

describe('Jahres-Heatmap', () => {
  it('53 Wochen × 7 Tage, Zukunft = null, Stufen nach Quartilen', () => {
    const d = empty();
    d.study = [30, 60, 90, 120].map((minutes, i) => ({
      ...meta,
      id: `s${i}`,
      date: `2026-10-0${i + 5}`,
      subjectId: 'm',
      start: '',
      end: '',
      minutes,
    }));
    const series = dailySeries(d, '2025-10-01', '2026-10-13');
    const hm = yearHeatmap(series, 'studyMin', '2026-10-13');
    expect(hm).toHaveLength(53);
    expect(hm.every((w) => w.length === 7)).toBe(true);
    const flat = hm.flat();
    expect(flat.find((c) => c.date === '2026-10-14')?.level).toBeNull();
    expect(flat.find((c) => c.date === '2026-10-05')?.level).toBe(1);
    expect(flat.find((c) => c.date === '2026-10-08')?.level).toBe(4);
    expect(flat.find((c) => c.date === '2026-10-10')?.level).toBe(0);
  });

  it('Vergleichszeitraum gleicher Länge direkt davor', () => {
    expect(previousRange('2026-10-05', '2026-10-11')).toEqual({ from: '2026-09-28', to: '2026-10-04' });
    expect(previousRange('2026-09-01', '2026-09-30')).toEqual({ from: '2026-08-02', to: '2026-08-31' });
  });
});

describe('Wochenbericht', () => {
  const d = empty();
  // Vorwoche: 2 Einheiten, 7 h Schlaf; Woche: 3 Einheiten, 8 h Schlaf, ein Spiel mit Tor, eine kurze Nacht
  const sess = (date: string, type: Session['type'], extra: Partial<Session> = {}): Session => ({
    ...meta,
    id: `${date}-${type}`,
    date,
    type,
    durationMin: 60,
    rpe: 6,
    note: '',
    ...extra,
  });
  d.sessions = [
    sess('2026-09-29', 'gym'),
    sess('2026-10-01', 'football'),
    sess('2026-10-06', 'gym'),
    sess('2026-10-08', 'football'),
    sess('2026-10-10', 'match', {
      match: {
        opponent: 'FC Puchheim',
        goalsFor: 3,
        goalsAgainst: 1,
        minutes: 72,
        goals: 1,
        assists: 0,
        shots: 3,
        rating: 8,
        reflection: '',
      },
    }),
  ];
  for (const date of ['2026-09-29', '2026-09-30', '2026-10-01']) d.sleep.push(sleepOn(date, 7));
  for (const date of ['2026-10-05', '2026-10-06', '2026-10-07']) d.sleep.push(sleepOn(date, 8));
  d.sleep.push(sleepOn('2026-10-09', 5.5));
  d.days = [dayMood('2026-10-10', 5)];

  it('Kennzahlen gegen die Vorwoche, Highlights, Ausreißer, fertig ab Sonntag', () => {
    const r = weeklyReport(d, '2026-10-07', '2026-10-13');
    expect(r.kw).toBe(41);
    expect(r.complete).toBe(true);
    const k = (key: string) => r.kpis.find((x) => x.key === key);
    expect(k('sessions')).toMatchObject({ value: 3, prev: 2, delta: 1 });
    expect(k('sleep')?.prev).toBe(7);
    expect(k('sleep')?.value).toBe(r1((8 * 3 + 5.5) / 4));
    expect(r.highlights).toContain('Spiel gegen FC Puchheim 3:1, 1 Tor.');
    expect(r.highlights).toContain('Beste Stimmung am Sa (5/5).');
    expect(r.outliers).toContain('Wenig Schlaf vor Fr: 5,5 h.');
    expect(weeklyReport(d, '2026-10-12', '2026-10-13').complete).toBe(false);
  });

  it('laufende Woche: nur bis heute, Vergleich mit denselben Wochentagen der Vorwoche', () => {
    // Mittwoch 07.10.: Woche Mo–Mi (1 Einheit) gegen Mo–Mi der Vorwoche (1 Einheit am 29.09.;
    // der Do 01.10. zählt nicht mit, obwohl die ganze Vorwoche 2 Einheiten hat)
    const r = weeklyReport(d, '2026-10-07', '2026-10-07');
    const k = (key: string) => r.kpis.find((x) => x.key === key);
    expect(r.complete).toBe(false);
    expect(k('sessions')).toMatchObject({ value: 1, prev: 1, delta: 0 });
    // Spiel am Samstag liegt in der Zukunft → kein Einfluss auf Kennzahlen
    expect(k('load')?.value).toBe(360);
  });

  it('Markdown mit Frontmatter für Obsidian, Dateiname mit ISO-Wochenjahr', () => {
    const r = weeklyReport(d, '2026-10-07', '2026-10-13');
    const md = weeklyMarkdown(r);
    expect(
      md.startsWith('---\ndatum: 2026-10-11\nkw: 41\ntags: [wochenbericht]\n---\n# Wochenbericht KW 41'),
    ).toBe(true);
    expect(md).toContain('| Einheiten | 3 | 2 | ↑ |');
    expect(weeklyFileName(r)).toBe('Wochenbericht-2026-KW41.md');
    // KW 53/1 über den Jahreswechsel: Woche ab Mo 28.12.2026 ist KW 53 von 2026
    expect(weeklyFileName(weeklyReport(empty(), '2026-12-29', '2027-01-10'))).toBe(
      'Wochenbericht-2026-KW53.md',
    );
    expect(weeklyFileName(weeklyReport(empty(), '2027-01-04', '2027-01-10'))).toBe(
      'Wochenbericht-2027-KW01.md',
    );
  });
});

function r1(n: number) {
  return Math.round(n * 10) / 10;
}

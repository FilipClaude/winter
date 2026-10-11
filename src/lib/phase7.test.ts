import { beforeEach, describe, expect, it } from 'vitest';
import { db, DATA_TABLES } from '../db/db';
import { addWater, saveSession, saveTodo, upsertHealthDay } from '../db/repo';
import {
  zDay,
  zDeadline,
  zExam,
  zHabit,
  zHabitCheck,
  zHealthDay,
  zMeal,
  zModule,
  zSession,
  zSleep,
  zStudySession,
  zTodo,
} from '../db/schemas';
import { createBackup, previewBackup, restoreBackup, wipeAll } from './backup';
import { generateDemo, insertDemo, removeDemo } from './demo';
import { parseHealthText, parseInstant, parseLooseNumber } from './health/parse';
import { dayMarkdown, weekFileName, weekMarkdown, type MarkdownData } from './markdown';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Health-JSON (Kurzbefehl)', () => {
  const T = '2026-10-11';

  it('liest das Beispiel aus der Spezifikation', () => {
    const r = parseHealthText(
      '{ "v": 1, "date": "2026-10-11", "steps": 8423, "distanceKm": 6.1, "flights": 12, "sleep": { "start": "2026-10-10T23:12:00+02:00", "end": "2026-10-11T06:58:00+02:00" } }',
      T,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.days[0]).toEqual({
      date: T,
      steps: 8423,
      distanceKm: 6.1,
      flights: 12,
      sleepStart: '2026-10-10T21:12:00.000Z',
      sleepEnd: '2026-10-11T04:58:00.000Z',
    });
    expect(r.warnings).toEqual([]);
  });

  it('toleriert Kurzbefehl-Eigenheiten: Strings, Komma, Tausenderpunkt, deutsches Datum, typografische Anführungszeichen', () => {
    const r = parseHealthText(
      '{“v”:“1”,“date”:“11.10.2026”,“steps”:“8.423”,“distanceKm”:“6,1”,“flights”:“12”,“sleepStart”:“10.10.2026, 23:12”,“sleepEnd”:“11.10.2026, 06:58”}',
      T,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.days[0]?.steps).toBe(8423);
    expect(r.days[0]?.distanceKm).toBe(6.1);
    expect(r.days[0]?.sleepStart).toBe('2026-10-10T21:12:00.000Z');
  });

  it('fehlende Werte sind erlaubt, Meter werden umgerechnet', () => {
    const r = parseHealthText('{"v":1,"date":"2026-10-11","distanceM":6100}', T);
    expect(r.ok && r.days[0]).toEqual({ date: T, distanceKm: 6.1 });
  });

  it('kaputte Daten → klare Fehlermeldung statt Absturz', () => {
    const cases: [string, RegExp][] = [
      ['', /leer/],
      ['Schritte: 8000', /Kein gültiges JSON/],
      ['{"v":2}', /Schema-Version/],
      ['{"v":1,"date":"gestern"}', /nicht lesbar/],
      ['{"v":1,"steps":"viele"}', /keine Zahl/],
      ['{"v":1,"steps":-5}', /unplausibel/],
      ['{"v":1,"date":"2030-01-01"}', /Zukunft/],
      ['[1,2]', /JSON-Objekt/],
    ];
    for (const [text, re] of cases) {
      const r = parseHealthText(text, T);
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.error, text).toMatch(re);
    }
  });

  it('unplausibler Schlaf wird übersprungen, der Rest importiert', () => {
    const r = parseHealthText(
      '{"v":1,"date":"2026-10-11","steps":100,"sleep":{"start":"2026-10-11T07:00:00Z","end":"2026-10-11T06:00:00Z"}}',
      T,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.days[0]?.sleepStart).toBeUndefined();
    expect(r.warnings[0]).toMatch(/vor dem Start/);
  });

  it('mehrere Tage als Liste, ohne Datum → heute mit Warnung', () => {
    const r = parseHealthText('[{"v":1,"date":"2026-10-10","steps":5000},{"v":1,"steps":7000}]', T);
    expect(r.ok && r.days.map((d) => d.date)).toEqual(['2026-10-10', T]);
    expect(r.ok && r.warnings[0]).toMatch(/Kein Datum/);
  });

  it('Hilfsparser', () => {
    expect(parseLooseNumber('1.234,5', false)).toBe(1234.5);
    expect(parseLooseNumber('6.1', false)).toBe(6.1);
    expect(parseLooseNumber(undefined, true)).toBeUndefined();
    expect(parseInstant('31.3.26, 08:00')).toBe('2026-03-31T06:00:00.000Z');
    expect(parseInstant('quatsch')).toBeNull();
  });
});

describe('Backup', () => {
  it('Export → alles löschen → Import → identisch', async () => {
    await addWater('2026-10-11', 3);
    await saveSession({
      date: '2026-10-11',
      type: 'gym',
      durationMin: 60,
      rpe: 7,
      note: 'Beine',
      gym: { exercises: [{ name: 'Kniebeuge', sets: [{ reps: 5, weightKg: 80 }] }] },
    });
    await upsertHealthDay({ date: '2026-10-11', steps: 9000, source: 'test' });
    const before = await createBackup();
    const text = JSON.stringify(before);

    await wipeAll();
    expect(await db.sessions.count()).toBe(0);
    expect(await db.subjects.count()).toBe(12); // Standardfächer wieder da

    const p = previewBackup(text);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.preview.counts.find((c) => c.table === 'sessions')?.count).toBe(1);
    await restoreBackup(p.preview.backup);
    const after = await createBackup();
    for (const t of DATA_TABLES) expect(after.tables[t], t).toEqual(before.tables[t]);
    expect(after.kv.lastHealthImport).toBe(before.kv.lastHealthImport);
    // Nach der Wiederherstellung gilt der Stand als gesichert (keine falsche Backup-Erinnerung).
    expect((await db.kv.get('lastBackupAt'))?.value).toBe(before.exportedAt);
  });

  it('Vorschau lehnt fremde, kaputte und zu neue Dateien ab', () => {
    expect(previewBackup('kein json')).toEqual({ ok: false, error: 'Die Datei ist kein gültiges JSON.' });
    const foreign = previewBackup('{"foo":1}');
    expect(!foreign.ok && foreign.error).toMatch(/keine Winter-Sicherung/);
    const future = previewBackup(
      JSON.stringify({ app: 'winter', format: 1, schemaVersion: 99, exportedAt: '', tables: {} }),
    );
    expect(!future.ok && future.error).toMatch(/neueren App-Version/);
    const broken = previewBackup(
      JSON.stringify({
        app: 'winter',
        format: 1,
        schemaVersion: 1,
        exportedAt: '',
        tables: { sessions: [{ id: 'x' }] },
      }),
    );
    expect(!broken.ok && broken.error).toMatch(/Trainingseinheiten, Eintrag 1/);
  });
});

describe('Demo-Daten', () => {
  it('erzeugt 4 Wochen gültige Daten (jeder Datensatz besteht die Zod-Prüfung)', () => {
    const subjects = [
      { id: 's1', name: 'Mathe' },
      { id: 's2', name: 'FernUni' },
    ];
    const d = generateDemo(subjects, '2026-10-11');
    const check = <T>(rows: T[], schema: { safeParse: (x: unknown) => { success: boolean } }) =>
      rows.forEach((r) => expect(schema.safeParse(r).success, JSON.stringify(r)).toBe(true));
    check(d.sessions, zSession);
    check(d.meals, zMeal);
    check(d.days, zDay);
    check(d.sleep, zSleep);
    check(d.health, zHealthDay);
    check(d.studySessions, zStudySession);
    check(d.todos, zTodo);
    check(d.exams, zExam);
    check(d.modules, zModule);
    check(d.deadlines, zDeadline);
    check(d.habits, zHabit);
    check(d.habitChecks, zHabitCheck);
    expect(d.days).toHaveLength(28);
    expect(d.sessions.length).toBeGreaterThan(18);
    expect(d.sessions.some((s) => s.match)).toBe(true);
    const all = Object.values(d).flat() as { demo?: number }[];
    expect(all.every((x) => x.demo === 1)).toBe(true);
  });

  it('ist deterministisch', () => {
    const a = generateDemo([{ id: 'm', name: 'Mathe' }], '2026-10-11', 7);
    const b = generateDemo([{ id: 'm', name: 'Mathe' }], '2026-10-11', 7);
    expect(a.sessions.map((s) => [s.date, s.type, s.durationMin, s.rpe])).toEqual(
      b.sessions.map((s) => [s.date, s.type, s.durationMin, s.rpe]),
    );
  });

  it('einfügen und vollständig löschen, echte Daten bleiben', async () => {
    await saveTodo({ date: '2026-10-11', title: 'Echte Aufgabe', done: false });
    await addWater('2026-10-11', 2);
    const n = await insertDemo();
    expect(n).toBeGreaterThan(100);
    expect(await insertDemo()).toBe(0); // nicht doppelt
    const removed = await removeDemo();
    expect(removed).toBe(n);
    expect((await db.todos.toArray()).map((t) => t.title)).toEqual(['Echte Aufgabe']);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.subjects.count()).toBe(12);
  });
});

describe('Markdown-Export (Obsidian)', () => {
  const base = (): MarkdownData => ({
    days: [],
    sessions: [],
    todos: [],
    deadlines: [],
    modules: [],
    subjects: [],
    study: [],
    meals: [],
    sleep: [],
    health: [],
  });
  const meta = { id: 'x', createdAt: '2026-10-11T08:00:00.000Z', updatedAt: '2026-10-11T08:00:00.000Z' };

  it('Tagesnotiz mit Frontmatter und Abschnitten wie die Vault-Vorlage', () => {
    const d = base();
    d.subjects = [{ ...meta, id: 'm', name: 'Mathe', short: 'M', order: 0, archived: false }];
    d.todos = [
      {
        ...meta,
        date: '2026-10-10',
        title: 'S. 112',
        subjectId: 'm',
        due: '2026-10-11',
        done: true,
        doneAt: '2026-10-11T15:00:00.000Z',
      },
    ];
    d.days = [
      {
        ...meta,
        id: '2026-10-11',
        date: '2026-10-11',
        water: 8,
        mood: 4,
        energy: 3,
        note: 'Guter Tag.\n# keine Überschrift',
        good: 'Abschluss',
        better: '',
        tomorrow: 'EA 2',
      },
    ];
    d.sessions = [
      {
        ...meta,
        date: '2026-10-11',
        type: 'gym',
        durationMin: 60,
        rpe: 7,
        note: '',
        gym: {
          exercises: [
            {
              name: 'Kniebeuge',
              sets: [
                { reps: 5, weightKg: 80 },
                { reps: 5, weightKg: 82.5 },
              ],
            },
          ],
        },
      },
    ];
    const md = dayMarkdown(d, '2026-10-11');
    expect(
      md.startsWith('---\ndatum: 2026-10-11\ntags: [tagesnotiz, winter]\n---\n# Sonntag, 11.10.2026\n'),
    ).toBe(true);
    expect(md).toContain('## Aufgaben\n- [x] S. 112 (Mathe)');
    expect(md).toContain('## Notizen\nGuter Tag.\n\\# keine Überschrift');
    expect(md).toContain('**Morgen wichtig:** EA 2');
    expect(md).toContain('Stimmung 4/5 · Energie 3/5');
    expect(md).toContain('## Training\n- Gym · 60 min · RPE 7 · Load 420');
    expect(md).toContain('| Kniebeuge | 2 × 5 / 5 | 80 / 82,5 kg |');
  });

  it('leerer Tag bleibt gültig', () => {
    const md = dayMarkdown(base(), '2026-10-11');
    expect(md).toContain('## Aufgaben\n- [ ] ');
    expect(md).toContain('## Training\n- frei');
  });

  it('Woche mit KW und korrektem ISO-Jahr im Dateinamen', () => {
    const md = weekMarkdown(base(), '2026-10-05');
    expect(md).toContain('kw: 41');
    expect(md).toContain('# KW 41 · 05.10.2026 – 11.10.2026');
    expect(weekFileName('2026-10-05')).toBe('2026-KW41.md');
    expect(weekFileName('2024-12-30')).toBe('2025-KW01.md');
  });
});

import { DATA_TABLES, db, type DataTable } from '../db/db';
import type {
  Grade,
  Day,
  Exam,
  GymExercise,
  Habit,
  HabitCheck,
  HealthDay,
  MockExam,
  Session,
  Sleep,
  StudySession,
  Subject,
  Todo,
} from '../db/schemas';
import { semesterForDate } from './calc/calendar-by';
import { isScheduled } from './calc/habits';
import { sleepFromWallTimes } from './calc/sleep';
import { addDays, isoWeekday, splitAtMidnight, todayISO, zonedToInstant, type ISODate } from './date';
import { uid } from './id';

/** Deterministischer Zufall (mulberry32), damit Demo-Daten und Tests reproduzierbar sind. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T,
    chance: (p: number) => next() < p,
  };
}

export interface DemoSet {
  sessions: Session[];
  days: Day[];
  sleep: Sleep[];
  health: HealthDay[];
  studySessions: StudySession[];
  todos: Todo[];
  exams: Exam[];
  mockExams: MockExam[];
  habits: Habit[];
  habitChecks: HabitCheck[];
  grades: Grade[];
}

const OPPONENTS = [
  'TSV Gilching',
  'SV Pullach',
  'FC Starnberg',
  'TSV Gräfelfing',
  'SC Fürstenfeldbruck',
  'FC Puchheim',
];

/** 4 Wochen realistische Daten bis einschließlich `today` (heute nur Vormittag). */
export function generateDemo(
  subjects: Pick<Subject, 'id' | 'name'>[],
  today: ISODate = todayISO(),
  seed = 41,
): DemoSet {
  const r = rng(seed);
  const now = new Date().toISOString();
  const meta = () => ({ id: uid(), createdAt: now, updatedAt: now, demo: 1 as const });
  const subjectId = (name: string) => subjects.find((s) => s.name === name)?.id ?? subjects[0]?.id ?? 'fach';
  const set: DemoSet = {
    sessions: [],
    days: [],
    sleep: [],
    health: [],
    studySessions: [],
    todos: [],
    exams: [],
    mockExams: [],
    grades: [],
    habits: [],
    habitChecks: [],
  };
  const start = addDays(today, -27);

  // Habits
  const habitDefs: { name: string; schedule: Habit['schedule']; p: number }[] = [
    { name: 'Dehnen 10 min', schedule: { kind: 'daily' }, p: 0.8 },
    { name: 'Lesen 20 min', schedule: { kind: 'daily' }, p: 0.6 },
    { name: 'Vokabeln', schedule: { kind: 'weekdays', days: [1, 2, 3, 4, 5] }, p: 0.75 },
  ];
  set.habits = habitDefs.map((h, i) => ({
    ...meta(),
    name: h.name,
    schedule: h.schedule,
    order: 100 + i,
    archived: false,
    startDate: start,
  }));

  let matchNo = 0;
  for (let i = 27; i >= 0; i--) {
    const date = addDays(today, -i);
    const wd = isoWeekday(date);
    const isToday = i === 0;
    const week = Math.floor((27 - i) / 7);

    // Schlaf (Nacht vor `date`)
    const weekend = wd === 6 || wd === 7;
    const bedMin = (22 * 60 + 40 + r.int(0, 70)) % (24 * 60);
    const wakeMin = (weekend ? 8 * 60 + 15 : 6 * 60 + 25) + r.int(0, 35);
    const hm = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const span = sleepFromWallTimes(date, hm(bedMin), hm(wakeMin));
    const sleepH = (new Date(span.end).getTime() - new Date(span.start).getTime()) / 3_600_000;
    if (r.chance(0.6))
      set.sleep.push({
        ...meta(),
        date,
        start: span.start,
        end: span.end,
        quality: Math.max(1, Math.min(5, Math.round(sleepH - 4 + r.next()))),
      });

    // Health
    const trainingDay = wd !== 7;
    const steps = isToday ? r.int(2500, 4500) : r.int(trainingDay ? 9000 : 5500, trainingDay ? 15000 : 9500);
    set.health.push({
      ...meta(),
      id: date,
      date,
      steps,
      distanceKm: Math.round(steps * 0.00074 * 10) / 10,
      flights: r.int(3, 18),
      sleepStart: new Date(new Date(span.start).getTime() + r.int(5, 25) * 60_000).toISOString(),
      sleepEnd: new Date(new Date(span.end).getTime() - r.int(0, 10) * 60_000).toISOString(),
      source: 'demo',
      importedAt: now,
    });

    // Tageswerte: Stimmung hängt leicht vom Schlaf ab
    const mood = Math.max(1, Math.min(5, Math.round(2.2 + (sleepH - 6.5) * 0.7 + (r.next() - 0.5) * 1.6)));
    const energy = Math.max(1, Math.min(5, Math.round(mood + (r.next() - 0.5) * 1.5)));
    set.days.push({
      ...meta(),
      id: date,
      date,
      // Wasser zählt seit v3 nicht mehr (Feld bleibt Pflicht für ältere Backups)
      water: 0,
      ...(isToday && r.chance(0.5) ? {} : { mood, energy }),
      note:
        !isToday && r.chance(0.35)
          ? r.pick([
              'Training war zäh, Beine schwer.',
              'Guter Tag, viel geschafft.',
              'Mathe endlich verstanden.',
              'Früh ins Bett, morgen Spiel.',
              'Zu lange am Handy gewesen.',
            ])
          : '',
      good:
        !isToday && r.chance(0.3)
          ? r.pick([
              'Abschluss im Training sauber',
              'Hausaufgaben direkt nach der Schule',
              'Vokabeln am Stück gelernt',
            ])
          : '',
      better:
        !isToday && r.chance(0.25) ? r.pick(['Früher schlafen', 'Mehr dehnen', 'Handy weg beim Lernen']) : '',
      tomorrow:
        !isToday && r.chance(0.3)
          ? r.pick(['Referat-Gliederung', 'Vokabeltest Englisch', 'Regeneration ernst nehmen'])
          : '',
    });

    // Training laut Wochenplan
    if (!isToday && r.chance(0.92)) {
      const add = (
        s: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'date' | 'note'> & { note?: string },
      ) => set.sessions.push({ ...meta(), date, note: '', ...s });
      if (wd === 1 || wd === 3 || wd === 5)
        add({ type: 'football', durationMin: r.pick([90, 90, 100, 75]), rpe: r.int(5, 8) });
      if (wd === 2 || wd === 4) {
        const ex: GymExercise[] =
          wd === 2
            ? [
                {
                  name: 'Kniebeuge',
                  sets: Array.from({ length: 3 }, () => ({ reps: 5, weightKg: 75 + week * 2.5 })),
                },
                {
                  name: 'Bankdrücken',
                  sets: Array.from({ length: 3 }, () => ({ reps: 6, weightKg: 55 + week * 2.5 })),
                },
                {
                  name: 'Rudern',
                  sets: Array.from({ length: 3 }, () => ({ reps: 8, weightKg: 50 + week * 2.5 })),
                },
              ]
            : [
                {
                  name: 'Kreuzheben',
                  sets: Array.from({ length: 3 }, () => ({ reps: 5, weightKg: 95 + week * 5 })),
                },
                {
                  name: 'Bulgarian Split Squat',
                  sets: Array.from({ length: 3 }, () => ({ reps: 8, weightKg: 16 + week * 2 })),
                },
                { name: 'Nordic Curls', sets: Array.from({ length: 3 }, () => ({ reps: 6, weightKg: 0 })) },
              ];
        // v3: Split – dienstags abwechselnd Push/Pull, donnerstags Legs
        const split = wd === 4 ? 'legs' : week % 2 === 0 ? 'push' : 'pull';
        add({ type: 'gym', durationMin: r.int(55, 75), rpe: r.int(6, 8), gym: { exercises: ex }, split });
      }
      if (wd === 6) {
        const minutes = r.pick([80, 80, 65, 72]);
        const goals = r.pick([0, 0, 1, 1, 2]);
        add({
          type: 'match',
          durationMin: minutes,
          rpe: r.int(7, 9),
          match: {
            opponent: OPPONENTS[matchNo++ % OPPONENTS.length] ?? 'Gegner',
            goalsFor: goals + r.int(0, 2),
            goalsAgainst: r.int(0, 3),
            minutes,
            goals,
            assists: r.pick([0, 0, 1]),
            shots: goals + r.int(1, 4),
            rating: Math.min(10, 5 + goals + r.int(0, 2)),
            reflection: r.pick([
              'Gute Laufwege in die Tiefe, im Abschluss zu hektisch.',
              'Viel gegen den Ball gearbeitet, wenig Bälle bekommen.',
              'Kopfballtor nach Ecke, zweite Halbzeit platt.',
            ]),
          },
        });
      }
      if (wd === 7 && r.chance(0.7)) add({ type: 'recovery', durationMin: r.int(20, 40), rpe: 2 });
    }

    // Lernzeit
    if (!isToday) {
      const studyDefs: [string, number][] = weekend
        ? [[r.pick(['Mathe', 'Geschichte', 'Englisch']), r.int(50, 110)]]
        : [
            [r.pick(['Mathe', 'PuG', 'Englisch', 'Deutsch', 'Geschichte', 'Bio']), r.int(25, 80)],
            ...(r.chance(0.5)
              ? [[r.pick(['WR', 'Biophysik', 'Ethik']), r.int(20, 50)] as [string, number]]
              : []),
          ];
      let cursor = new Date(zonedToInstant(date, weekend ? '10:30' : '16:30')).getTime();
      for (const [name, minutes] of studyDefs) {
        const s = new Date(cursor).toISOString();
        const e = new Date(cursor + minutes * 60_000).toISOString();
        for (const seg of splitAtMidnight(s, e))
          set.studySessions.push({
            ...meta(),
            date: seg.date,
            subjectId: subjectId(name),
            start: seg.start,
            end: seg.end,
            minutes: seg.minutes,
          });
        cursor += (minutes + 20) * 60_000;
      }
    }

    // Habits
    set.habits.forEach((h, k) => {
      if (isScheduled(h, date) && !isToday && r.chance(habitDefs[k]?.p ?? 0.5))
        set.habitChecks.push({ ...meta(), habitId: h.id, date });
    });
  }

  // Schule: Klausuren, Aufgaben
  const exam = (
    name: string,
    offset: number,
    kind: Exam['kind'],
    progress: number,
    points?: number,
    topics = '',
  ) =>
    set.exams.push({
      ...meta(),
      date: addDays(today, offset),
      subjectId: subjectId(name),
      kind,
      topics,
      progress,
      ...(points !== undefined ? { points } : {}),
    });
  exam('Deutsch', -24, 'klausur', 100, 11, 'Erörterung');
  exam('Englisch', -17, 'kurzarbeit', 100, 9, 'Vocabulary, Grammar');
  exam('PuG', -10, 'klausur', 100, 13, 'Demokratietheorien');
  exam('Bio', -5, 'ex', 100, 8, 'Genetik');
  exam('Mathe', 4, 'klausur', 55, undefined, 'Analysis: Kurvendiskussion, Integrale');
  exam('Geschichte', 15, 'klausur', 20, undefined, 'Weimarer Republik');

  // v3: Probe-Klausuren mit Trend (Mathe anstehend, PuG schon bewertet)
  const mock = (name: string, offset: number, points: number, maxPoints: number, durationMin?: number) => {
    const e = set.exams.find(
      (x) => x.subjectId === subjectId(name) && (name !== 'Mathe' || x.points === undefined),
    );
    if (!e) return;
    set.mockExams.push({
      ...meta(),
      date: addDays(today, offset),
      examId: e.id,
      subjectId: e.subjectId,
      points,
      maxPoints,
      ...(durationMin ? { durationMin } : {}),
    });
  };
  mock('Mathe', -10, 12, 25, 60);
  mock('Mathe', -6, 15, 25, 55);
  mock('Mathe', -2, 17.5, 25, 50);
  mock('PuG', -16, 22, 30);
  mock('PuG', -12, 25.5, 30);

  // v2: Noten – bewertete Klausuren als verknüpfte Noten plus kleine Leistungsnachweise
  for (const e of set.exams) {
    if (e.points === undefined) continue;
    set.grades.push({
      ...meta(),
      date: e.date,
      subjectId: e.subjectId,
      semester: semesterForDate(e.date),
      size: e.kind === 'klausur' ? 'gross' : 'klein',
      type: e.kind,
      points: e.points,
      weight: 1,
      note: e.topics,
      examId: e.id,
    });
  }
  const small = (name: string, offset: number, type: Grade['type'], points: number) =>
    set.grades.push({
      ...meta(),
      date: addDays(today, offset),
      subjectId: subjectId(name),
      semester: semesterForDate(addDays(today, offset)),
      size: 'klein',
      type,
      points,
      weight: 1,
      note: '',
    });
  small('Deutsch', -12, 'abfrage', 12);
  small('Mathe', -20, 'ex', 10);
  small('Mathe', -8, 'muendlich', 12);
  small('PuG', -18, 'referat', 14);
  small('Englisch', -6, 'muendlich', 10);
  small('Geschichte', -14, 'abfrage', 11);
  small('Bio', -21, 'abfrage', 9);

  const todo = (title: string, name: string | null, due: number | null, done: boolean) =>
    set.todos.push({
      ...meta(),
      date: addDays(today, -3),
      title,
      done,
      ...(name ? { subjectId: subjectId(name) } : {}),
      ...(due !== null ? { due: addDays(today, due) } : {}),
      ...(done ? { doneAt: zonedToInstant(addDays(today, Math.min(0, due ?? 0)), '18:00') } : {}),
    });
  todo('Mathe S. 112 Nr. 4–7', 'Mathe', 1, false);
  todo('Englisch Essay Entwurf', 'Englisch', 3, false);
  todo('PuG Referat Gliederung', 'PuG', 6, false);
  todo('Bio Arbeitsblatt Genetik', 'Bio', -2, true);
  todo('Sportsachen waschen', null, null, false);

  return set;
}

export async function isDemoActive(): Promise<boolean> {
  return (await db.kv.get('demoActive'))?.value === true;
}

export async function insertDemo(): Promise<number> {
  if (await isDemoActive()) return 0;
  const subjects = await db.subjects.toArray();
  const set = generateDemo(subjects);
  let n = 0;
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.kv], async () => {
    for (const [table, rows] of Object.entries(set) as [DataTable, unknown[]][]) {
      // Echte Health-/Tageswerte nicht überschreiben (gleiche id = Datum).
      const existing = new Set(
        (await db.table(table).bulkGet(rows.map((x) => (x as { id: string }).id)))
          .filter(Boolean)
          .map((x) => (x as { id: string }).id),
      );
      const fresh = rows.filter((x) => !existing.has((x as { id: string }).id));
      await db.table(table).bulkAdd(fresh);
      n += fresh.length;
    }
    await db.kv.put({ key: 'demoActive', value: true });
  });
  return n;
}

/** Entfernt ausschließlich Einträge mit demo = 1. */
export async function removeDemo(): Promise<number> {
  let n = 0;
  await db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.kv], async () => {
    for (const t of DATA_TABLES) {
      const table = db.table(t);
      // Über den demo-Index statt Tabellen-Scan: in WebKit um ein Vielfaches schneller.
      n += table.schema.idxByName.demo
        ? await table.where('demo').equals(1).delete()
        : await table.filter((x: { demo?: number }) => x.demo === 1).delete();
    }
    await db.kv.delete('demoActive');
  });
  return n;
}

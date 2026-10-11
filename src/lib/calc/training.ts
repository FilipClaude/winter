import { addDays, diffDays, type ISODate } from '../date';
import type { GymSet, Session, SessionType } from '../../db/schemas';

export const SESSION_LABEL: Record<SessionType, string> = {
  football: 'Fußball-Training',
  match: 'Spiel',
  gym: 'Gym',
  run: 'Lauf',
  recovery: 'Regeneration',
  other: 'Sonstiges',
};

/** Session-Load nach Foster: Dauer (min) × RPE (1–10), in AU (arbitrary units). */
export function sessionLoad(durationMin: number, rpe: number): number {
  if (!Number.isFinite(durationMin) || !Number.isFinite(rpe) || durationMin <= 0 || rpe <= 0) return 0;
  return Math.round(durationMin * rpe);
}

/** Summe der Load im Zeitraum [from, to] (inklusive). */
export function loadInRange(
  sessions: Pick<Session, 'date' | 'durationMin' | 'rpe'>[],
  from: ISODate,
  to: ISODate,
) {
  return sessions
    .filter((s) => s.date >= from && s.date <= to)
    .reduce((sum, s) => sum + sessionLoad(s.durationMin, s.rpe), 0);
}

export type LoadStatus = 'zu-wenig-daten' | 'niedrig' | 'ok' | 'erhoeht' | 'hoch';

export interface LoadRatio {
  /** Load der letzten 7 Tage (inkl. heute). */
  acute: number;
  /** Durchschnittliche Wochenload der letzten 28 Tage. */
  chronic: number;
  /** acute / chronic, null bei zu wenig Daten. */
  ratio: number | null;
  status: LoadStatus;
}

/** Mindestens so viele Tage Trainingshistorie, bevor ein Verhältnis angezeigt wird. */
export const MIN_HISTORY_DAYS = 21;

/**
 * Verhältnis akute (7 Tage) zu chronischer (28 Tage, als Wochenschnitt) Belastung.
 * Grobe Orientierung, keine medizinische Aussage. Schwellen nach gängiger Sportpraxis:
 * < 0,8 niedrig · 0,8–1,3 im Rahmen · 1,3–1,5 erhöht · > 1,5 starker Sprung.
 */
export function loadRatio(
  sessions: Pick<Session, 'date' | 'durationMin' | 'rpe'>[],
  today: ISODate,
): LoadRatio {
  const acute = loadInRange(sessions, addDays(today, -6), today);
  const chronicTotal = loadInRange(sessions, addDays(today, -27), today);
  const chronic = Math.round(chronicTotal / 4);
  const past = sessions.filter((s) => s.date <= today);
  const earliest = past.reduce<ISODate | null>(
    (min, s) => (min === null || s.date < min ? s.date : min),
    null,
  );
  if (earliest === null || diffDays(earliest, today) < MIN_HISTORY_DAYS || chronic === 0) {
    return { acute, chronic, ratio: null, status: 'zu-wenig-daten' };
  }
  const ratio = Math.round((acute / chronic) * 100) / 100;
  const status: LoadStatus =
    ratio < 0.8 ? 'niedrig' : ratio <= 1.3 ? 'ok' : ratio <= 1.5 ? 'erhoeht' : 'hoch';
  return { acute, chronic, ratio, status };
}

/** Load pro Woche (Montag-Start) für die letzten `weeks` Wochen bis `today`. */
export function weeklyLoads(
  sessions: Pick<Session, 'date' | 'durationMin' | 'rpe'>[],
  weekStarts: ISODate[],
): { week: ISODate; load: number }[] {
  return weekStarts.map((week) => ({ week, load: loadInRange(sessions, week, addDays(week, 6)) }));
}

// ---------- Gym: persönliche Bestleistungen ----------

/** Geschätztes 1RM nach Epley. Bei 1 Wiederholung = Gewicht; 0 Wdh. oder 0 kg = 0. */
export function estimated1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function normalizeExercise(name: string): string {
  return name.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
}

/** gewicht = schwerster Satz, 1rm = bestes geschätztes Maximum, wdh = meiste Wdh. ohne Zusatzgewicht. */
export type PRKind = 'gewicht' | '1rm' | 'wdh';
export interface PRMark {
  sessionId: string;
  exerciseIndex: number;
  setIndex: number;
  kinds: PRKind[];
}

/**
 * Erkennt Bestleistungen chronologisch. Die erste Einheit einer Übung ist die Basis und wird nicht
 * markiert. Pro Einheit und Übung wird höchstens ein Satz je Art markiert (der beste).
 */
export function detectPRs(sessions: Pick<Session, 'id' | 'date' | 'createdAt' | 'gym'>[]): PRMark[] {
  const ordered = sessions
    .filter((s) => s.gym)
    .slice()
    .sort((a, b) =>
      a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date),
    );
  const best = new Map<string, { weight: number; e1rm: number; bodyReps: number }>();
  const marks = new Map<string, PRMark>();

  for (const s of ordered) {
    s.gym?.exercises.forEach((ex, exerciseIndex) => {
      const key = normalizeExercise(ex.name);
      const valid = ex.sets.map((set, setIndex) => ({ set, setIndex })).filter(({ set }) => set.reps > 0);
      if (valid.length === 0) return;
      const top = (score: (set: GymSet) => number) =>
        valid.reduce((a, b) => (score(b.set) > score(a.set) ? b : a));
      const topWeight = top((x) => x.weightKg);
      const topE1 = top((x) => estimated1RM(x.weightKg, x.reps));
      const e1 = estimated1RM(topE1.set.weightKg, topE1.set.reps);
      const body = valid.filter(({ set }) => set.weightKg === 0);
      const topBody = body.length > 0 ? body.reduce((a, b) => (b.set.reps > a.set.reps ? b : a)) : null;
      const prev = best.get(key);
      if (prev) {
        const add = (setIndex: number, kind: PRKind) => {
          const k = `${s.id}:${exerciseIndex}:${setIndex}`;
          const m = marks.get(k) ?? { sessionId: s.id, exerciseIndex, setIndex, kinds: [] };
          m.kinds.push(kind);
          marks.set(k, m);
        };
        if (topWeight.set.weightKg > prev.weight) add(topWeight.setIndex, 'gewicht');
        if (e1 > prev.e1rm) add(topE1.setIndex, '1rm');
        if (topBody && topBody.set.reps > prev.bodyReps) add(topBody.setIndex, 'wdh');
      }
      best.set(key, {
        weight: Math.max(prev?.weight ?? 0, topWeight.set.weightKg),
        e1rm: Math.max(prev?.e1rm ?? 0, e1),
        bodyReps: Math.max(prev?.bodyReps ?? 0, topBody?.set.reps ?? 0),
      });
    });
  }
  return [...marks.values()];
}

/**
 * Bestwerte je Übung (für die Übersicht). Bei Übungen mit Gewicht zählt das geschätzte 1RM,
 * bei reinen Körpergewichtsübungen (0 kg) die meisten Wiederholungen.
 */
export function exerciseBests(sessions: Pick<Session, 'date' | 'gym'>[]) {
  const out = new Map<string, { name: string; weight: number; e1rm: number; reps: number; date: ISODate }>();
  for (const s of sessions) {
    for (const ex of s.gym?.exercises ?? []) {
      const key = normalizeExercise(ex.name);
      for (const set of ex.sets) {
        if (set.reps <= 0) continue;
        const e1 = estimated1RM(set.weightKg, set.reps);
        const cur = out.get(key);
        const better = !cur || e1 > cur.e1rm || (e1 === 0 && cur.e1rm === 0 && set.reps > cur.reps);
        if (better)
          out.set(key, {
            name: ex.name.trim(),
            weight: set.weightKg,
            e1rm: e1,
            reps: set.reps,
            date: s.date,
          });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
}
// ---------- Spiele: Saisonstatistik ----------

/** Fußballsaison: 1. Juli bis 30. Juni. "2026/27". */
export function seasonOf(date: ISODate): string {
  const y = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 7 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

export function seasonRange(season: string): { from: ISODate; to: ISODate } {
  const start = Number(season.slice(0, 4));
  return { from: `${start}-07-01`, to: `${start + 1}-06-30` };
}

export interface SeasonStats {
  games: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  wins: number;
  draws: number;
  losses: number;
  avgRating: number | null;
  goalsPer90: number | null;
  assistsPer90: number | null;
  shotsPer90: number | null;
  /** Tore pro Torschuss in %. */
  conversion: number | null;
  minutesPerGoal: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function seasonStats(sessions: Pick<Session, 'match'>[]): SeasonStats {
  const matches = sessions.map((s) => s.match).filter((m) => m !== undefined);
  const sum = (f: (m: (typeof matches)[number]) => number) => matches.reduce((a, m) => a + f(m), 0);
  const minutes = sum((m) => m.minutes);
  const goals = sum((m) => m.goals);
  const assists = sum((m) => m.assists);
  const shots = sum((m) => m.shots);
  const per90 = (v: number) => (minutes > 0 ? round2((v / minutes) * 90) : null);
  return {
    games: matches.length,
    minutes,
    goals,
    assists,
    shots,
    wins: matches.filter((m) => m.goalsFor > m.goalsAgainst).length,
    draws: matches.filter((m) => m.goalsFor === m.goalsAgainst).length,
    losses: matches.filter((m) => m.goalsFor < m.goalsAgainst).length,
    avgRating: matches.length > 0 ? round1(sum((m) => m.rating) / matches.length) : null,
    goalsPer90: per90(goals),
    assistsPer90: per90(assists),
    shotsPer90: per90(shots),
    conversion: shots > 0 ? Math.round((goals / shots) * 100) : null,
    minutesPerGoal: goals > 0 ? Math.round(minutes / goals) : null,
  };
}

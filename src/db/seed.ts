import type { Transaction } from 'dexie';
import { uid } from '../lib/id';
import type { ExerciseTemplate, Subject } from './schemas';

export const DEFAULT_SUBJECTS: { name: string; short: string; major?: boolean }[] = [
  { name: 'Deutsch', short: 'D' },
  { name: 'Mathe', short: 'M' },
  { name: 'Englisch', short: 'E' },
  { name: 'Geschichte', short: 'G' },
  { name: 'PuG', short: 'PuG', major: true },
  { name: 'VkM', short: 'VkM' },
  { name: 'Kunst', short: 'Ku' },
  { name: 'Biophysik', short: 'BPh' },
  { name: 'Bio', short: 'B' },
  { name: 'Ethik', short: 'Eth' },
  { name: 'WR', short: 'WR' },
];

export const DEFAULT_EXERCISES = [
  'Kniebeuge',
  'Kreuzheben',
  'Bankdrücken',
  'Klimmzüge',
  'Rudern',
  'Schulterdrücken',
  'Bulgarian Split Squat',
  'Hip Thrust',
  'Nordic Curls',
  'Wadenheben',
];

export function buildDefaults(now = new Date().toISOString()) {
  const subjects: Subject[] = DEFAULT_SUBJECTS.map((s, i) => ({
    id: uid(),
    createdAt: now,
    updatedAt: now,
    name: s.name,
    short: s.short,
    order: i,
    archived: false,
    ...(s.major ? { major: true } : {}),
  }));
  const exerciseTemplates: ExerciseTemplate[] = DEFAULT_EXERCISES.map((name, i) => ({
    id: uid(),
    createdAt: now,
    updatedAt: now,
    name,
    lastSets: [],
    order: i,
  }));
  return { subjects, exerciseTemplates };
}

/** Wird von Dexie genau einmal beim Anlegen der Datenbank aufgerufen. */
export function seedDefaults(tx: Transaction): void {
  const d = buildDefaults();
  void tx.table('subjects').bulkAdd(d.subjects);
  void tx.table('exerciseTemplates').bulkAdd(d.exerciseTemplates);
}

import type { Subject } from '../../db/schemas';

/**
 * Das v1/v2-Fach „FernUni“ (Seed) gehört seit v3 nicht mehr zur Oberfläche (DECISIONS #80).
 * Es bleibt mit seinen Lernzeiten in Datenbank und Backup, erscheint aber in keiner Auswahl, Liste
 * oder Summe mehr.
 */
export const isUniSubject = (s: Pick<Subject, 'name'>): boolean =>
  s.name.toLowerCase().replace(/[\s-]/g, '').includes('fernuni');

/** Fächer für Auswahl und Listen: aktiv und keine Uni. */
export function schoolSubjects<T extends Pick<Subject, 'name' | 'archived'>>(list: T[]): T[] {
  return list.filter((s) => !s.archived && !isUniSubject(s));
}

/**
 * Einträge (Lernzeiten, Klausuren, Aufgaben, Stunden, Lerneinheiten) ohne die der ausgeblendeten
 * Uni-Fächer. Einträge ohne Fach (z. B. Aufgaben) bleiben.
 */
export function withoutUni<T extends { subjectId?: string | undefined }>(
  rows: T[],
  subjects: Pick<Subject, 'id' | 'name'>[],
): T[] {
  const hidden = new Set(subjects.filter(isUniSubject).map((s) => s.id));
  return hidden.size === 0 ? rows : rows.filter((r) => r.subjectId === undefined || !hidden.has(r.subjectId));
}

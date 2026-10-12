import type { Settings, Subject } from '../../db/schemas';
import type { AbiSubject, Role } from './abi';

const norm = (s: string) => s.trim().toLowerCase();
const isGerman = (s: Pick<Subject, 'name' | 'short'>) => norm(s.name) === 'deutsch' || norm(s.short) === 'd';
const isMath = (s: Pick<Subject, 'name' | 'short'>) =>
  ['mathe', 'mathematik'].includes(norm(s.name)) || norm(s.short) === 'm';
const isOutside = (s: Pick<Subject, 'name'>) => norm(s.name) === 'fernuni';

/** Standardrolle: Deutsch, Mathe, Leistungsfach und Abiturfächer alle 4; FernUni gar nicht; sonst 3 von 4. */
export function defaultRole(s: Subject, examSubjects: string[]): Role {
  if (isOutside(s)) return 'none';
  if (isGerman(s) || isMath(s) || s.major || examSubjects.includes(s.id)) return 'all';
  return 'three';
}

export function abiSubjects(subjects: Subject[], abi: Settings['abi']): AbiSubject[] {
  return subjects
    .filter((s) => !s.archived)
    .map((s) => ({
      id: s.id,
      name: s.name,
      role: abi.roles[s.id] ?? defaultRole(s, abi.examSubjects),
      core: isGerman(s) || isMath(s) || s.major === true,
      exam: abi.examSubjects.includes(s.id),
    }));
}

import type { Settings, Subject } from '../../db/schemas';
import type { AbiSubject, Role } from './abi';
import { isUniSubject } from './subjects';

const norm = (s: string) => s.trim().toLowerCase();
const isGerman = (s: Pick<Subject, 'name' | 'short'>) => norm(s.name) === 'deutsch' || norm(s.short) === 'd';
const isMath = (s: Pick<Subject, 'name' | 'short'>) =>
  ['mathe', 'mathematik'].includes(norm(s.name)) || norm(s.short) === 'm';

/**
 * Fächer mit Pflichteinbringung „3“ laut GSO Anlage 10 (Fremdsprachen, Religion/Ethik, Geschichte,
 * Kunst/Musik, Naturwissenschaften). Erkennung über den Namen – im Zweifel stellt Filip die Rolle selbst ein.
 */
const THREE_OF_FOUR = [
  'englisch',
  'französisch',
  'latein',
  'spanisch',
  'italienisch',
  'griechisch',
  'russisch',
  'chinesisch',
  'ethik',
  'religion',
  'evangelische religionslehre',
  'katholische religionslehre',
  'geschichte',
  'kunst',
  'musik',
  'bio',
  'biologie',
  'chemie',
  'physik',
];

/**
 * Standardrolle: Deutsch, Mathe, Leistungsfach und Abiturfächer alle 4; Pflichtfächer nach Anlage 10
 * „3 von 4“; FernUni gar nicht; alles andere (z. B. WR, Geographie, Wahlfächer) frei wählbar.
 */
export function defaultRole(s: Subject, examSubjects: string[]): Role {
  if (isUniSubject(s)) return 'none';
  if (isGerman(s) || isMath(s) || s.major || examSubjects.includes(s.id)) return 'all';
  if (THREE_OF_FOUR.includes(norm(s.name))) return 'three';
  return 'free';
}

const NATURAL_SCIENCES = ['bio', 'biologie', 'chemie', 'physik'];
const LANGUAGES = [
  'englisch',
  'französisch',
  'latein',
  'spanisch',
  'italienisch',
  'griechisch',
  'russisch',
  'chinesisch',
];

export function abiSubjects(subjects: Subject[], abi: Settings['abi']): AbiSubject[] {
  const active = subjects.filter((s) => !s.archived);
  // Anlage 10 (Fn. 2, 5): Die einzige Fremdsprache bzw. die einzige Naturwissenschaft geht mit allen
  // vier Halbjahren ein (Review-Fund: Bio war bei Filip fälschlich „3 von 4“).
  const only = (group: string[]) => {
    const members = active.filter((s) => group.includes(norm(s.name)));
    return members.length === 1 ? members[0]?.id : undefined;
  };
  const onlyScience = only(NATURAL_SCIENCES);
  const onlyLanguage = only(LANGUAGES);
  return active.map((s) => {
    const base = defaultRole(s, abi.examSubjects);
    const auto = base === 'three' && (s.id === onlyScience || s.id === onlyLanguage) ? 'all' : base;
    return {
      id: s.id,
      name: s.name,
      role: abi.roles[s.id] ?? auto,
      core: isGerman(s) || isMath(s) || s.major === true,
      exam: abi.examSubjects.includes(s.id),
    };
  });
}

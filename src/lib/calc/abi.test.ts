import { describe, expect, it } from 'vitest';
import type { Semester } from '../../db/schemas';
import {
  ABI_RULES,
  computeAbi,
  knownHalfYears,
  neededExamPoints,
  pointsForGrade,
  pointsToAbiGrade,
  roundPoints,
  semesterAverage,
  type AbiSubject,
  type HalfYear,
} from './abi';

const SEM: Semester[] = ['12/1', '12/2', '13/1', '13/2'];
const hy = (subjectId: string, points: number[]): HalfYear[] =>
  points.map((p, i) => ({ subjectId, semester: SEM[i] ?? '12/1', points: p, kind: 'zeugnis' }));

const subj = (id: string, role: AbiSubject['role'], opts: Partial<AbiSubject> = {}): AbiSubject => ({
  id,
  name: id,
  role,
  core: false,
  exam: false,
  ...opts,
});

/** 5 Abiturfächer (alle 4 HJL) + 4 Fächer „3 von 4“ = 32 Pflicht + Seminar 4 → 4 frei wählbar. */
const SUBJECTS: AbiSubject[] = [
  subj('D', 'all', { core: true, exam: true }),
  subj('M', 'all', { core: true, exam: true }),
  subj('PuG', 'all', { core: true, exam: true }),
  subj('E', 'all', { exam: true }),
  subj('G', 'all', { exam: true }),
  subj('Bio', 'three'),
  subj('Ku', 'three'),
  subj('Eth', 'three'),
  subj('WR', 'three'),
];
const allTen = SUBJECTS.flatMap((s) => hy(s.id, [10, 10, 10, 10]));
const SEMINAR = { s1: 10, s2: 10, paper: 20 };
const EXAMS = { D: 10, M: 10, PuG: 10, E: 10, G: 10 };

describe('Umrechnung Punkte → Durchschnittsnote (KMK, abgeschnitten)', () => {
  it.each([
    [900, 1.0],
    [823, 1.0],
    [822, 1.1],
    [733, 1.5],
    [732, 1.6],
    [643, 2.0],
    [642, 2.1],
    [300, 4.0],
  ])('%i Punkte → %f', (p, g) => expect(pointsToAbiGrade(p)).toBe(g));

  it('unter 300 Punkten: nicht bestanden', () => expect(pointsToAbiGrade(299)).toBeNull());

  it('Mindestpunkte für Wunschnoten', () => {
    expect(pointsForGrade(1.0)).toBe(823);
    expect(pointsForGrade(1.5)).toBe(733);
    expect(pointsForGrade(2.0)).toBe(643);
    expect(pointsForGrade(4.0)).toBe(300);
  });
});

describe('Halbjahresleistung aus Noten', () => {
  it('groß : klein = 1 : 1 (von Hand: Klausur 12, kleine 9 und 11 → (12 + 10) / 2 = 11)', () => {
    const g = [
      { points: 12, weight: 1, size: 'gross' as const },
      { points: 9, weight: 1, size: 'klein' as const },
      { points: 11, weight: 1, size: 'klein' as const },
    ];
    expect(semesterAverage(g)).toBe(11);
    expect(semesterAverage(g, { big: 2, small: 1 })).toBeCloseTo(34 / 3, 9);
  });

  it('nur kleine Leistungsnachweise (z. B. 13/2 ohne Schulaufgabe)', () => {
    expect(
      semesterAverage([
        { points: 7, weight: 2, size: 'klein' },
        { points: 10, weight: 1, size: 'klein' },
      ]),
    ).toBe(8);
  });

  it('Rundung auf ganze Punkte, ,5 aufwärts; Grenzen 0 und 15', () => {
    expect(roundPoints(10.5)).toBe(11);
    expect(roundPoints(10.49)).toBe(10);
    expect(roundPoints(15.4)).toBe(15);
    expect(roundPoints(-1)).toBe(0);
  });

  it('Zeugnis hat Vorrang vor berechneten Noten', () => {
    const k = knownHalfYears(
      [
        { subjectId: 'D', semester: '12/1', points: 5, weight: 1, size: 'gross' },
        { subjectId: 'M', semester: '12/1', points: 13, weight: 1, size: 'gross' },
      ],
      [{ subjectId: 'D', semester: '12/1', points: 9 }],
      { big: 1, small: 1 },
    );
    expect(k).toContainEqual({ subjectId: 'D', semester: '12/1', points: 9, kind: 'zeugnis' });
    expect(k).toContainEqual({ subjectId: 'M', semester: '12/1', points: 13, kind: 'noten' });
    expect(k).toHaveLength(2);
  });
});

describe('Gesamtqualifikation (von Hand nachgerechnet)', () => {
  it('alles 10 Punkte: Block I = 36 × 10 + Seminar 40 = 400, Block II = 5 × 40 = 200, 600 → 2,3', () => {
    const r = computeAbi({ subjects: SUBJECTS, known: allTen, seminar: SEMINAR, examPoints: EXAMS });
    expect(r.included).toHaveLength(36);
    expect(r.block1).toBe(400);
    expect(r.block2).toBe(200);
    expect(r.total).toBe(600);
    expect(r.grade).toBe(2.3);
    expect(r.warnings.filter((w) => w.level === 'kritisch')).toEqual([]);
  });

  it('Einbringungs-Optimierung: frei wählbare Halbjahre nehmen die besten (Sport 15 statt 4. Halbjahr mit 10)', () => {
    const subjects = [...SUBJECTS, subj('Sport', 'free')];
    const known = [...allTen, ...hy('Sport', [15, 15, 15, 15])];
    const r = computeAbi({ subjects, known, seminar: SEMINAR, examPoints: EXAMS });
    expect(r.block1).toBe(32 * 10 + 4 * 15 + 40);
    expect(r.included.filter((h) => h.subjectId === 'Sport')).toHaveLength(4);
  });

  it('bei „3 von 4“ wird das schwächste Halbjahr gestrichen', () => {
    // Mit einem frei wählbaren Fach gibt es mehr Auswahl als freie Plätze (sonst müsste die 3 mit).
    const subjects = [...SUBJECTS, subj('Sport', 'free')];
    const known = [
      ...allTen.filter((h) => h.subjectId !== 'Bio'),
      ...hy('Bio', [12, 3, 12, 12]),
      ...hy('Sport', [10, 10, 10, 10]),
    ];
    const r = computeAbi({ subjects, known, seminar: SEMINAR, examPoints: EXAMS });
    // Bio: 12, 12, 12 Pflicht; die 3 fällt gegen andere Halbjahre mit 10 Punkten raus.
    expect(r.included.some((h) => h.subjectId === 'Bio' && h.points === 3)).toBe(false);
    expect(r.block1).toBe(400 - 30 + 36);
  });

  it('Szenario: nötige Punkte in einer Prüfung für eine Wunschnote', () => {
    const r = computeAbi({ subjects: SUBJECTS, known: allTen, seminar: SEMINAR, examPoints: EXAMS });
    // 2,2 braucht 607 Punkte; ohne PuG: 400 + 4 × 40 = 560 → 47 / 4 → 12 Punkte
    expect(neededExamPoints(r, 'PuG', 2.2)).toBe(12);
    // 2,0 (643) bräuchte 21 Punkte → nicht erreichbar
    expect(neededExamPoints(r, 'PuG', 2.0)).toBeNull();
  });

  it('fehlende Halbjahre und Prüfungen werden prognostiziert (Fachschnitt) und markiert', () => {
    const known = allTen.filter((h) => h.semester === '12/1' || h.semester === '12/2');
    const r = computeAbi({
      subjects: SUBJECTS,
      known,
      seminar: { s1: 10, s2: 10, paper: null },
      examPoints: {},
    });
    expect(r.total).toBe(600 - 20 + 16); // Seminararbeit-Prognose 16 statt 20
    expect(r.examResults.every((e) => e.projected)).toBe(true);
    expect(r.projectedShare).toBeGreaterThan(0.5);
  });
});

describe('Warnungen (Zulassung § 44, Bestehen § 54)', () => {
  it('mehr als 8 Unterkurse → kritisch', () => {
    const weak = SUBJECTS.flatMap((s) => hy(s.id, s.exam ? [10, 10, 10, 10] : [4, 4, 4, 4]));
    const r = computeAbi({ subjects: SUBJECTS, known: weak, seminar: SEMINAR, examPoints: EXAMS });
    expect(r.warnings.some((w) => w.level === 'kritisch' && w.text.includes('Unterkurse'))).toBe(true);
  });

  it('0 Punkte in einem eingebrachten Halbjahr → Kurs nicht belegt', () => {
    const known = [
      ...allTen.filter((h) => !(h.subjectId === 'D' && h.semester === '13/1')),
      ...hy('D', [10, 10, 0, 10]).slice(2, 3),
    ];
    const r = computeAbi({ subjects: SUBJECTS, known, seminar: SEMINAR, examPoints: EXAMS });
    expect(r.warnings.some((w) => w.text.includes('nicht belegt'))).toBe(true);
  });

  it('Prüfung mit 0 Punkten und Block II < 100 → nicht bestanden', () => {
    const r = computeAbi({
      subjects: SUBJECTS,
      known: allTen,
      seminar: SEMINAR,
      examPoints: { D: 0, M: 4, PuG: 4, E: 4, G: 4 },
    });
    expect(r.block2).toBe(64);
    expect(r.warnings.filter((w) => w.level === 'kritisch').length).toBeGreaterThanOrEqual(3);
  });

  it('Pflicht-Halbjahre über 40 → Hinweis auf Optionsregel', () => {
    const many = [...SUBJECTS, subj('Ch', 'all'), subj('Ph', 'all')];
    const known = many.flatMap((s) => hy(s.id, [10, 10, 10, 10]));
    const r = computeAbi({ subjects: many, known, seminar: SEMINAR, examPoints: EXAMS });
    expect(r.warnings.some((w) => w.text.includes('Optionsregel'))).toBe(true);
  });
});

describe('Standardrollen (Anlage 10) mit Filips Fächern', () => {
  it('ohne Optionsregel-Warnung: 5 Abiturfächer + 3 Pflichtfächer „3 von 4“ + Seminar = 33, Rest frei', async () => {
    const { abiSubjects } = await import('./abi-setup');
    const names = [
      'Deutsch',
      'Mathe',
      'Englisch',
      'Geschichte',
      'PuG',
      'VkM',
      'Kunst',
      'Biophysik',
      'Bio',
      'Ethik',
      'WR',
      'FernUni',
    ];
    const subjects = names.map((name, i) => ({
      id: name,
      name,
      short: name.slice(0, 3),
      order: i,
      archived: false,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      ...(name === 'PuG' ? { major: true } : {}),
    }));
    const list = abiSubjects(subjects, {
      examSubjects: ['Deutsch', 'Mathe', 'PuG', 'Englisch', 'Geschichte'],
      examPoints: {},
      bigWeight: 1,
      smallWeight: 1,
      roles: {},
      seminar: { s1: null, s2: null, paper: null },
    });
    const role = (n: string) => list.find((s) => s.id === n)?.role;
    expect(role('Kunst')).toBe('three');
    expect(role('Bio')).toBe('three');
    expect(role('WR')).toBe('free');
    expect(role('FernUni')).toBe('none');
    const known = list.filter((s) => s.role !== 'none').flatMap((s) => hy(s.id, [10, 10, 10, 10]));
    const examPoints = { Deutsch: 10, Mathe: 10, PuG: 10, Englisch: 10, Geschichte: 10 };
    const r = computeAbi({ subjects: list, known, seminar: SEMINAR, examPoints });
    expect(r.mandatoryCount).toBe(29);
    expect(r.warnings.some((w) => w.text.includes('Optionsregel'))).toBe(false);
    expect(r.included).toHaveLength(36);
    expect(r.projectedShare).toBe(0);
  });
});

describe('Regeln sind belegt oder ausdrücklich als unsicher markiert', () => {
  it('jede Regel hat Text, Quelle und Sicherheit', () => {
    for (const rule of Object.values(ABI_RULES)) {
      expect(rule.text.length).toBeGreaterThan(20);
      expect(rule.source.length).toBeGreaterThan(5);
      expect(['sicher', 'gedeutet', 'unsicher']).toContain(rule.certainty);
    }
    expect(ABI_RULES.conversion.certainty).toBe('unsicher');
  });
});

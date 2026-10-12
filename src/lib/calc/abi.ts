import type { Grade, Semester, SemesterResult } from '../../db/schemas';
import { SEMESTERS } from '../../db/schemas';

/**
 * Abi-Rechner für die neue bayerische G9-Oberstufe (Abitur ab 2026, mit Leistungsfach).
 *
 * Alle Regeln stehen als Daten in ABI_RULES – mit Quelle und Sicherheit. Grundlage: GSO in der ab
 * 01.08.2026 geltenden Fassung (Anlage 10, §§ 44, 53, 54) und gymnasiale-oberstufe.bayern.de
 * (Stand 17.11.2025). „sicher“ = wörtlich belegt, „gedeutet“ = belegt, aber eine Auslegung war nötig,
 * „unsicher“ = nicht direkt eingesehen. Nichts davon ersetzt die Oberstufenkoordination.
 */

export type Certainty = 'sicher' | 'gedeutet' | 'unsicher';

export interface AbiRule<T> {
  value: T;
  text: string;
  source: string;
  certainty: Certainty;
}

const GSO = 'GSO (gesetze-bayern.de), Fassung ab 01.08.2026';
const GO = 'gymnasiale-oberstufe.bayern.de, Stand 17.11.2025';

export const ABI_RULES = {
  halfYears: {
    value: 40,
    text: '40 Halbjahresleistungen aus 12/1–13/2 gehen in Block I ein (je max. 15 Punkte, max. 600).',
    source: `${GSO}, Anlage 10 und § 53 Abs. 1`,
    certainty: 'sicher',
  },
  examFactor: {
    value: 4,
    text: 'Fünf Abiturprüfungen, jeweils vierfach gewertet (je max. 60, Block II max. 300).',
    source: `${GSO}, Anlage 10 Nr. 23; ${GO} (Prüfungsergebnis)`,
    certainty: 'sicher',
  },
  semesterWeighting: {
    value: { big: 1, small: 1 },
    text: 'Halbjahresleistung: Schulaufgabe und Durchschnitt der kleinen Leistungsnachweise 1 : 1. In 13/2 nur in Deutsch, Mathematik und Leistungsfach mit Schulaufgabe, sonst nur kleine Leistungsnachweise.',
    source: `${GO} (Halbjahresleistungen)`,
    certainty: 'sicher',
  },
  semesterRounding: {
    value: 'half-up',
    text: 'Die Halbjahresleistung wird hier auf ganze Punkte gerundet (,5 aufwärts). Die genaue Rundungsregel war nicht belegbar – im Zweifel gilt das Zeugnis (Halbjahresleistung von Hand eintragen).',
    source: 'nicht belegt',
    certainty: 'unsicher',
  },
  mandatory: {
    value: null,
    text: 'Alle vier Halbjahre einbringen: Deutsch, Mathematik, die fünf Abiturfächer, die einzige Fremdsprache und die einzige Naturwissenschaft. Übrige Pflichtfächer meist 3 von 4. W-Seminar 12/1 + 12/2 (2 HJL), Seminararbeit zählt wie 2 HJL.',
    source: `${GSO}, Anlage 10 (Nr. 1–16, Fn. 8, 9); ${GO} (Einbringungsverpflichtung)`,
    certainty: 'sicher',
  },
  mandatoryModel: {
    value: null,
    text: 'Die Fächer-Rollen (alle 4 / 3 von 4 / frei) stellst du selbst ein. Sonderfälle (Vertiefungskurs, Politik/Geo/WR-Verteilung, Optionsregel, Substitution) bildet der Rechner nicht automatisch ab.',
    source: `${GSO}, Anlage 10 Fn. 1–7`,
    certainty: 'gedeutet',
  },
  admission: {
    value: {
      minBlock1: 200,
      minHalfYearsAt5: 32,
      minEachIncluded: 1,
      minCoreSum: 48,
      minExamSubjectsSum: 100,
      minPaper: 9,
    },
    text: 'Zulassung: 40 HJL ≥ 200 Punkte, davon mindestens 32 mit ≥ 5 Punkten (also höchstens 8 „Unterkurse“), jede eingebrachte HJL ≥ 1 Punkt, Deutsch + Mathematik + Leistungsfach in der Qualifikationsphase ≥ 48 Punkte, die fünf Abiturfächer ≥ 100 Punkte, Seminararbeit ≥ 9 Punkte (Gesamtleistung, 2 HJL). Ein Halbjahr mit 0 Punkten: Kurs gilt als nicht belegt.',
    source: `${GSO}, § 44 Abs. 2; ${GO} (Halbjahresleistungen)`,
    certainty: 'gedeutet',
  },
  pass: {
    value: { minExamResult: 4, minBlock2: 100, minSubjectsAt20: 3, minTotal: 300 },
    text: 'Bestehen: kein Prüfungsergebnis unter 4 Punkten (vierfach), Block II ≥ 100, mindestens drei Prüfungsfächer mit je ≥ 20 Punkten (darunter Deutsch, Mathematik oder Leistungsfach), Gesamtqualifikation ≥ 300. Weitere Bedingungen (Fächerkonstellationen, Aufgabenfelder) prüft der Rechner nicht.',
    source: `${GSO}, § 54 Abs. 1`,
    certainty: 'gedeutet',
  },
  conversion: {
    value: 'kmk',
    text: 'Umrechnung Punkte → Durchschnittsnote: N = (1020 − P) / 180, auf eine Nachkommastelle abgeschnitten (823 P = 1,0; 643 P = 2,0; 300 P = 4,0). Das ist die bundesweite KMK-Formel. Die GSO verweist auf eine Umrechnungstabelle (Anlage 13), die ich nicht direkt einsehen konnte.',
    source: `${GSO}, § 54 Abs. 2 (Anlage 13 nicht eingesehen); KMK-Vereinbarung`,
    certainty: 'unsicher',
  },
} as const satisfies Record<string, AbiRule<unknown>>;

// ---------- Halbjahresleistung aus Noten ----------

function weightedAvg(items: Pick<Grade, 'points' | 'weight'>[]): number | null {
  const w = items.reduce((a, g) => a + g.weight, 0);
  if (w <= 0) return null;
  return items.reduce((a, g) => a + g.points * g.weight, 0) / w;
}

/**
 * Halbjahresleistung (ungerundet) aus großen und kleinen Leistungsnachweisen: beide Gruppen
 * gewichtet gemittelt, dann im Verhältnis groß : klein (Standard 1 : 1). Fehlt eine Gruppe, zählt die andere.
 */
export function semesterAverage(
  grades: Pick<Grade, 'points' | 'weight' | 'size'>[],
  weights: { big: number; small: number } = ABI_RULES.semesterWeighting.value,
): number | null {
  const big = weightedAvg(grades.filter((g) => g.size === 'gross'));
  const small = weightedAvg(grades.filter((g) => g.size === 'klein'));
  if (big === null && small === null) return null;
  if (big === null) return small;
  if (small === null) return big;
  const total = weights.big + weights.small;
  if (total <= 0) return (big + small) / 2;
  return (big * weights.big + small * weights.small) / total;
}

/** Auf ganze Punkte (,5 aufwärts, siehe ABI_RULES.semesterRounding). */
export function roundPoints(p: number): number {
  return Math.min(15, Math.max(0, Math.floor(p + 0.5 + 1e-9)));
}

// ---------- Gesamtqualifikation ----------

export type Role = 'all' | 'three' | 'free' | 'none';

export interface AbiSubject {
  id: string;
  name: string;
  role: Role;
  /** Deutsch, Mathematik oder Leistungsfach (Zulassung: zusammen ≥ 48). */
  core: boolean;
  exam: boolean;
}

/** Halbjahresleistung je Fach und Halbjahr: Wert und Herkunft. */
export interface HalfYear {
  subjectId: string;
  semester: Semester;
  points: number;
  kind: 'zeugnis' | 'noten' | 'prognose';
}

export interface AbiInput {
  subjects: AbiSubject[];
  /** Bekannte Halbjahresleistungen (Zeugnis oder aus Noten); fehlende werden prognostiziert. */
  known: HalfYear[];
  seminar: { s1: number | null; s2: number | null; paper: number | null };
  /** Prüfungspunkte (0–15, einfach) je Abiturfach-ID; fehlend = Prognose aus dem Fachschnitt. */
  examPoints: Record<string, number | undefined>;
}

export interface AbiWarning {
  level: 'kritisch' | 'warnung';
  text: string;
}

export interface AbiResult {
  included: HalfYear[];
  excluded: HalfYear[];
  block1: number;
  /** Anzahl Pflicht-HJL laut Rollen (ohne Seminar). Mehr als 40 → Optionsregel nötig. */
  mandatoryCount: number;
  seminarPoints: number;
  examResults: { subjectId: string; points: number; projected: boolean }[];
  block2: number;
  total: number;
  /** Durchschnittsnote, null wenn unter 300 Punkten (nicht bestanden). */
  grade: number | null;
  projectedShare: number;
  warnings: AbiWarning[];
}

/** Gesamtpunktzahl → Durchschnittsnote (KMK, abgeschnitten). Ganzzahlig gerechnet, ohne Rundungsfehler. */
export function pointsToAbiGrade(total: number): number | null {
  if (total < 300) return null;
  const tenths = Math.floor((1020 - Math.min(900, total)) / 18);
  return Math.max(10, tenths) / 10;
}

/** Kleinste Gesamtpunktzahl für eine Wunschnote (z. B. 1,5 → 733). */
export function pointsForGrade(target: number): number {
  for (let p = 300; p <= 900; p++) {
    const g = pointsToAbiGrade(p);
    if (g !== null && g <= target + 1e-9) return p;
  }
  return 901;
}

/** Ergänzt fehlende Halbjahre durch eine Prognose (Fachschnitt, sonst Gesamtschnitt, sonst 8). */
export function fillProjection(subjects: AbiSubject[], known: HalfYear[]): HalfYear[] {
  const all = known.map((k) => k.points);
  const overall = all.length > 0 ? all.reduce((a, b) => a + b, 0) / all.length : 8;
  const out: HalfYear[] = [...known];
  for (const s of subjects) {
    if (s.role === 'none') continue;
    const mine = known.filter((k) => k.subjectId === s.id);
    const avg = mine.length > 0 ? mine.reduce((a, k) => a + k.points, 0) / mine.length : overall;
    for (const sem of SEMESTERS) {
      if (!mine.some((k) => k.semester === sem))
        out.push({ subjectId: s.id, semester: sem, points: roundPoints(avg), kind: 'prognose' });
    }
  }
  return out;
}

export function computeAbi(input: AbiInput): AbiResult {
  const N = ABI_RULES.halfYears.value;
  const all = fillProjection(input.subjects, input.known);
  const byId = new Map(input.subjects.map((s) => [s.id, s]));
  const sorted = (xs: HalfYear[]) => [...xs].sort((a, b) => b.points - a.points);

  // Seminar: 2 HJL (12/1, 12/2) + Seminararbeit (zählt wie 2 HJL, Gesamtleistung 0–30)
  const s1 = input.seminar.s1 ?? 8;
  const s2 = input.seminar.s2 ?? 8;
  const paper = input.seminar.paper ?? 16;
  const seminarPoints = s1 + s2 + paper;
  const seminarSlots = 4;
  const seminarProjected =
    (input.seminar.s1 === null ? 1 : 0) +
    (input.seminar.s2 === null ? 1 : 0) +
    (input.seminar.paper === null ? 2 : 0);

  const mandatory: HalfYear[] = [];
  const pool: HalfYear[] = [];
  for (const s of input.subjects) {
    const mine = sorted(all.filter((h) => h.subjectId === s.id));
    if (s.role === 'all') mandatory.push(...mine);
    else if (s.role === 'three') {
      mandatory.push(...mine.slice(0, 3));
      pool.push(...mine.slice(3));
    } else if (s.role === 'free') pool.push(...mine);
  }
  const mandatoryCount = mandatory.length;
  // Nie mehr als 40 Halbjahresleistungen: Ergeben die Pflichtrollen mehr (Optionsregel nötig), zählen
  // nur die besten Pflicht-Halbjahre – die Warnung unten weist darauf hin.
  const mandatoryUsed = sorted(mandatory).slice(0, N - seminarSlots);
  const free = Math.max(0, N - seminarSlots - mandatoryUsed.length);
  const picked = sorted(pool).slice(0, free);
  const included = [...mandatoryUsed, ...picked];
  const excluded = all.filter((h) => byId.get(h.subjectId)?.role !== 'none' && !included.includes(h));
  const block1 = included.reduce((a, h) => a + h.points, 0) + seminarPoints;

  // Block II
  const examSubjects = input.subjects.filter((s) => s.exam);
  const examResults = examSubjects.map((s) => {
    const given = input.examPoints[s.id];
    if (given !== undefined) return { subjectId: s.id, points: given, projected: false };
    const mine = all.filter((h) => h.subjectId === s.id);
    const avg = mine.length > 0 ? mine.reduce((a, h) => a + h.points, 0) / mine.length : 8;
    return { subjectId: s.id, points: roundPoints(avg), projected: true };
  });
  const factor = ABI_RULES.examFactor.value;
  const block2 = examResults.reduce((a, e) => a + e.points * factor, 0);
  const total = block1 + block2;

  // Warnungen nach § 44 / § 54 (soweit modelliert)
  const w: AbiWarning[] = [];
  const adm = ABI_RULES.admission.value;
  const name = (id: string) => byId.get(id)?.name ?? 'Fach';
  const counted = included.length + seminarSlots;
  if (counted < N)
    w.push({
      level: 'warnung',
      text: `Nur ${counted} von ${N} Halbjahresleistungen verfügbar – Fächer-Rollen prüfen.`,
    });
  if (mandatoryCount + seminarSlots > N)
    w.push({
      level: 'warnung',
      text: `${mandatoryCount + seminarSlots} Pflicht-Halbjahresleistungen > ${N}: Optionsregel nötig (Oberstufenkoordination fragen).`,
    });
  // Warnungen über alle eingebrachten UND alle Pflicht-Halbjahre: Bei mehr als 40 Pflicht-HJL fallen die
  // schwächsten aus Block I heraus, ihre Unterkurse/0 Punkte dürfen aber nicht aus den Warnungen verschwinden.
  const warnSet = [...new Set([...included, ...mandatory])];
  const zeros = warnSet.filter((h) => h.points === 0);
  for (const z of zeros)
    w.push({
      level: 'kritisch',
      text: `${name(z.subjectId)} ${z.semester}: 0 Punkte – Kurs gilt als nicht belegt.`,
    });
  const all40 = [...warnSet.map((h) => h.points), s1, s2, paper / 2, paper / 2];
  const under5 = all40.filter((p) => p < 5).length;
  if (under5 > N - adm.minHalfYearsAt5)
    w.push({
      level: 'kritisch',
      text: `${under5} Unterkurse (< 5 Punkte) – erlaubt sind höchstens ${N - adm.minHalfYearsAt5}.`,
    });
  else if (under5 > 0)
    w.push({
      level: 'warnung',
      text: `${under5} von höchstens ${N - adm.minHalfYearsAt5} Unterkursen (< 5 Punkte) verbraucht.`,
    });
  if (block1 < adm.minBlock1)
    w.push({ level: 'kritisch', text: `Block I ${block1} < ${adm.minBlock1} Punkte – keine Zulassung.` });
  const core = all.filter((h) => byId.get(h.subjectId)?.core);
  const coreSum = core.reduce((a, h) => a + h.points, 0);
  if (core.length > 0 && coreSum < adm.minCoreSum)
    w.push({
      level: 'kritisch',
      text: `Deutsch + Mathe + Leistungsfach: ${coreSum} < ${adm.minCoreSum} Punkte.`,
    });
  const examHj = all.filter((h) => byId.get(h.subjectId)?.exam).reduce((a, h) => a + h.points, 0);
  if (examSubjects.length === 5 && examHj < adm.minExamSubjectsSum)
    w.push({
      level: 'kritisch',
      text: `Abiturfächer (Halbjahre): ${examHj} < ${adm.minExamSubjectsSum} Punkte.`,
    });
  if (input.seminar.paper !== null && input.seminar.paper < adm.minPaper)
    w.push({ level: 'kritisch', text: `Seminararbeit ${input.seminar.paper} < ${adm.minPaper} Punkte.` });
  if (examSubjects.length !== 5)
    w.push({ level: 'warnung', text: `${examSubjects.length} von 5 Abiturfächern gewählt.` });
  const pass = ABI_RULES.pass.value;
  for (const e of examResults)
    if (e.points * factor < pass.minExamResult)
      w.push({
        level: 'kritisch',
        text: `${name(e.subjectId)}: Prüfung mit 0 Punkten – Abitur nicht bestanden.`,
      });
  if (examSubjects.length === 5 && block2 < pass.minBlock2)
    w.push({ level: 'kritisch', text: `Block II ${block2} < ${pass.minBlock2} Punkte.` });
  const at20 = examResults.filter((e) => e.points * factor >= 20);
  if (examSubjects.length === 5 && at20.length < pass.minSubjectsAt20)
    w.push({ level: 'kritisch', text: `Nur ${at20.length} Prüfungen mit ≥ 5 Punkten (nötig: 3).` });
  if (examSubjects.length === 5 && !at20.some((e) => byId.get(e.subjectId)?.core))
    w.push({
      level: 'kritisch',
      text: 'Keine Prüfung in Deutsch, Mathe oder Leistungsfach mit ≥ 5 Punkten.',
    });

  // Anteil geschätzter Punkte am Gewicht: 40 Halbjahre (je 1) + 5 Prüfungen (je 4) = 60.
  const projectedCount =
    included.filter((h) => h.kind === 'prognose').length +
    seminarProjected +
    examResults.filter((e) => e.projected).length * factor;
  return {
    included,
    excluded,
    block1,
    mandatoryCount,
    seminarPoints,
    examResults,
    block2,
    total,
    grade: pointsToAbiGrade(total),
    projectedShare: Math.min(1, projectedCount / (N + 5 * factor)),
    warnings: w,
  };
}

/**
 * Szenario: Welche Punktzahl braucht es in einem Prüfungsfach für eine Wunschnote, wenn alles andere
 * so bleibt? null = auch mit 15 Punkten nicht erreichbar.
 */
export function neededExamPoints(result: AbiResult, subjectId: string, target: number): number | null {
  const factor = ABI_RULES.examFactor.value;
  const others = result.examResults
    .filter((e) => e.subjectId !== subjectId)
    .reduce((a, e) => a + e.points * factor, 0);
  const need = pointsForGrade(target) - result.block1 - others;
  const p = Math.max(0, Math.ceil(need / factor));
  return p > 15 ? null : p;
}

/** Halbjahresleistungen aus Zeugnis (Vorrang) bzw. Noten je Fach und Halbjahr. */
export function knownHalfYears(
  grades: Pick<Grade, 'subjectId' | 'semester' | 'points' | 'weight' | 'size'>[],
  results: Pick<SemesterResult, 'subjectId' | 'semester' | 'points'>[],
  weights: { big: number; small: number },
): HalfYear[] {
  const out: HalfYear[] = results.map((r) => ({ ...r, kind: 'zeugnis' as const }));
  const has = new Set(results.map((r) => `${r.subjectId}:${r.semester}`));
  const groups = new Map<string, typeof grades>();
  for (const g of grades) {
    const k = `${g.subjectId}:${g.semester}`;
    if (has.has(k)) continue;
    groups.set(k, [...(groups.get(k) ?? []), g]);
  }
  for (const [k, gs] of groups) {
    const avg = semesterAverage(gs, weights);
    if (avg === null) continue;
    const [subjectId, semester] = k.split(':') as [string, Semester];
    out.push({ subjectId, semester, points: roundPoints(avg), kind: 'noten' });
  }
  return out;
}

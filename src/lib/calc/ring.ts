import type { Goals, Settings } from '../../db/schemas';

export interface RingInput {
  habitsDone: number;
  habitsPlanned: number;
  proteinG: number;
  waterGlasses: number;
  studyMin: number;
  sleepMin: number | null;
}

export interface RingPart {
  key: keyof Settings['ring'];
  label: string;
  /** 0–1, gedeckelt. */
  value: number;
  detail: string;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * Tagesring: Durchschnitt der aktiven Teilziele, jedes gedeckelt auf 100 %.
 * Ziele mit Wert 0 oder deaktiviert zählen nicht. Habits zählen nur, wenn heute welche geplant sind.
 */
export function dayRing(
  input: RingInput,
  goals: Goals,
  enabled: Settings['ring'],
): { parts: RingPart[]; total: number } {
  const parts: RingPart[] = [];
  if (enabled.habits && input.habitsPlanned > 0) {
    parts.push({
      key: 'habits',
      label: 'Habits',
      value: clamp01(input.habitsDone / input.habitsPlanned),
      detail: `${input.habitsDone}/${input.habitsPlanned}`,
    });
  }
  if (enabled.protein && goals.proteinG > 0) {
    parts.push({
      key: 'protein',
      label: 'Protein',
      value: clamp01(input.proteinG / goals.proteinG),
      detail: `${Math.round(input.proteinG)}/${goals.proteinG} g`,
    });
  }
  if (enabled.water && goals.waterGlasses > 0) {
    parts.push({
      key: 'water',
      label: 'Wasser',
      value: clamp01(input.waterGlasses / goals.waterGlasses),
      detail: `${input.waterGlasses}/${goals.waterGlasses}`,
    });
  }
  if (enabled.study && goals.studyMin > 0) {
    parts.push({
      key: 'study',
      label: 'Lernen',
      value: clamp01(input.studyMin / goals.studyMin),
      detail: `${input.studyMin}/${goals.studyMin} min`,
    });
  }
  if (enabled.sleep && goals.sleepH > 0) {
    parts.push({
      key: 'sleep',
      label: 'Schlaf',
      value: clamp01((input.sleepMin ?? 0) / (goals.sleepH * 60)),
      detail: input.sleepMin === null ? 'offen' : `${(input.sleepMin / 60).toFixed(1).replace('.', ',')} h`,
    });
  }
  const total = parts.length === 0 ? 0 : parts.reduce((a, p) => a + p.value, 0) / parts.length;
  return { parts, total };
}

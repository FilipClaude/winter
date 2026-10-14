import type { Goals, Settings } from '../../db/schemas';

export interface RingInput {
  habitsDone: number;
  habitsPlanned: number;
  studyMin: number;
  sleepMin: number | null;
  /** Steht heute laut Wochenplan Training an, und ist schon eine Einheit eingetragen? */
  training: { planned: boolean; done: boolean };
  /** Verdienst der laufenden Woche bis heute, Wochenziel (Cent) und Wochentag (1 = Montag … 7 = Sonntag). */
  earnings: { weekCents: number; goalCents: number; weekday: number };
}

export type RingKey = 'habits' | 'study' | 'sleep' | 'training' | 'earnings';

export interface RingPart {
  key: RingKey;
  label: string;
  /** 0–1, gedeckelt. */
  value: number;
  detail: string;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/**
 * Tagesring (v3): Habits, Lernen, Schlaf, Training und Verdienst – Durchschnitt der aktiven Teilziele,
 * jedes gedeckelt auf 100 %. Ein Segment fällt heraus (zählt nicht als verfehlt), wenn es abgeschaltet
 * ist oder heute nichts zu tun gibt: keine Habits geplant, Ziel 0, Ruhetag laut Wochenplan, kein
 * Wochenziel. Verdienst misst den Wochenfortschritt **bis heute**: Am Mittwoch ist 3/7 des Wochenziels
 * schon 100 %. Protein und Wasser zählen seit v3 nicht mehr (Einstellungen bleiben lesbar).
 */
export function dayRing(
  input: RingInput,
  goals: Pick<Goals, 'studyMin' | 'sleepH'>,
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
  if (enabled.training && input.training.planned) {
    parts.push({
      key: 'training',
      label: 'Training',
      value: input.training.done ? 1 : 0,
      detail: input.training.done ? 'erledigt' : 'offen',
    });
  }
  const e = input.earnings;
  if (enabled.earnings && e.goalCents > 0) {
    const due = (e.goalCents * Math.min(7, Math.max(1, e.weekday))) / 7;
    parts.push({
      key: 'earnings',
      label: 'Verdienst',
      value: clamp01(e.weekCents / due),
      // ganze Euro: Die Zeile im Ring ist schmal (Fund im Screenshot: „40,00 € / 34,29 €“ abgeschnitten)
      detail: `${Math.round(e.weekCents / 100)} / ${Math.round(due / 100)} €`,
    });
  }
  const total = parts.length === 0 ? 0 : parts.reduce((a, p) => a + p.value, 0) / parts.length;
  return { parts, total };
}

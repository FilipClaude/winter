import type { Deadline, Module } from '../../db/schemas';

export interface Eligibility {
  /** Bewertete Einsendearbeiten (mit Punkten). */
  graded: number;
  passed: number;
  required: number;
  /** Prüfungsberechtigt laut der eingestellten Regel. null = keine Regel hinterlegt. */
  eligible: boolean | null;
  /** Noch offene (nicht bewertete) Einsendearbeiten. */
  open: number;
  /** Nicht mehr erreichbar, weil zu wenige Einsendearbeiten übrig sind. */
  unreachable: boolean;
}

/** Ist eine Einsendearbeit bestanden? (Punkte / Maximum ≥ Schwelle in %) */
export function eaPassed(d: Pick<Deadline, 'points' | 'maxPoints'>, passPercent: number): boolean | null {
  if (d.points === undefined || d.maxPoints === undefined || d.maxPoints <= 0) return null;
  return (d.points / d.maxPoints) * 100 >= passPercent - 1e-9;
}

/**
 * Prüfungsberechtigung eines FernUni-Moduls nach der eingestellten Regel, z. B. „mindestens eine EA
 * mit 50 %“ (Regeln unterscheiden sich je Modul – deshalb konfigurierbar, nicht fest eingebaut).
 */
export function moduleEligibility(
  module: Pick<Module, 'rule'>,
  deadlines: Pick<Deadline, 'kind' | 'points' | 'maxPoints'>[],
): Eligibility {
  const eas = deadlines.filter((d) => d.kind === 'einsendearbeit');
  const rule = module.rule;
  const results = eas.map((d) => eaPassed(d, rule?.passPercent ?? 50));
  const graded = results.filter((r) => r !== null).length;
  const passed = results.filter((r) => r === true).length;
  const open = results.filter((r) => r === null).length;
  const required = rule?.minPassed ?? 0;
  const eligible = rule ? passed >= required : null;
  return { graded, passed, required, eligible, open, unreachable: !!rule && passed + open < required };
}

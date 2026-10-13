import {
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD,
  V2_DEFAULT_DASHBOARD,
  type DashboardWidget,
  type DashboardWidgetId,
  type StoredDashboardWidget,
} from '../../db/schemas';

const isCurrent = (id: string): id is DashboardWidgetId =>
  (DASHBOARD_WIDGETS as readonly string[]).includes(id);

const sameLayout = (a: StoredDashboardWidget[], b: StoredDashboardWidget[]) =>
  a.length === b.length &&
  a.every((w, i) => w.id === b[i]?.id && w.size === b[i]?.size && w.hidden === b[i]?.hidden);

/**
 * Neue Widgets in ein eigenes Layout einsortieren: hinter das erste vorhandene Widget aus `after`,
 * sonst ganz vorne (`nextExam`) bzw. hinten. So landet „Nächste Klausur“ direkt nach dem Briefing.
 */
const PLACE_AFTER: Partial<Record<DashboardWidgetId, DashboardWidgetId[]>> = {
  nextExam: ['briefing'],
  earnings: ['nextMatch', 'training', 'studyToday'],
};

/**
 * Bereinigt eine gespeicherte Anordnung: unbekannte, entfallene (v2: Ernährung, Nächste Termine) und
 * doppelte Einträge fallen weg, neue Widgets kommen sichtbar mit Standardgröße an ihren Platz.
 * Wer die unveränderte v2-Standardanordnung hat (oder keine), bekommt den neuen Standard.
 */
export function normalizeDashboard(list: StoredDashboardWidget[]): DashboardWidget[] {
  if (list.length === 0 || sameLayout(list, V2_DEFAULT_DASHBOARD))
    return DEFAULT_DASHBOARD.map((w) => ({ ...w }));
  const seen = new Set<DashboardWidgetId>();
  const out: DashboardWidget[] = [];
  for (const w of list) {
    const id = w.id;
    if (!isCurrent(id) || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...w, id });
  }
  for (const d of DEFAULT_DASHBOARD) {
    if (seen.has(d.id)) continue;
    const after = PLACE_AFTER[d.id];
    if (after) {
      // Anker in Prioritätsreihenfolge (Verdienst lieber hinter „Nächstes Spiel“ als hinter „Training“)
      const anchor = after.map((id) => out.findIndex((w) => w.id === id)).find((i) => i >= 0) ?? -1;
      if (anchor >= 0) out.splice(anchor + 1, 0, { ...d });
      else if (d.id === 'nextExam') out.unshift({ ...d });
      else out.push({ ...d });
    } else out.push({ ...d });
  }
  return out;
}

/** Sichtbare Widgets in Anzeigereihenfolge; bei kritischen Hinweisen stehen sie ganz oben. */
export function orderForDisplay(list: DashboardWidget[], critical: boolean): DashboardWidget[] {
  const visible = list.filter((w) => !w.hidden);
  if (!critical) return visible;
  return [{ id: 'alerts', size: 'l', hidden: false }, ...visible.filter((w) => w.id !== 'alerts')];
}

/** Verschiebt ein Widget um `delta` Plätze (für Pfeiltasten/VoiceOver als Alternative zu Drag & Drop). */
export function moveWidget(list: DashboardWidget[], id: DashboardWidgetId, delta: number): DashboardWidget[] {
  const i = list.findIndex((w) => w.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(i, 1);
  if (item) next.splice(j, 0, item);
  return next;
}

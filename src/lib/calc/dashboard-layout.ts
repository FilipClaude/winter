import {
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD,
  type DashboardWidget,
  type DashboardWidgetId,
} from '../../db/schemas';

/**
 * Bereinigt eine gespeicherte Anordnung: unbekannte und doppelte Einträge fallen weg, Widgets aus
 * späteren Versionen werden mit Standardgröße hinten angehängt (sichtbar).
 */
export function normalizeDashboard(list: DashboardWidget[]): DashboardWidget[] {
  const seen = new Set<DashboardWidgetId>();
  const out: DashboardWidget[] = [];
  for (const w of list) {
    if (!(DASHBOARD_WIDGETS as readonly string[]).includes(w.id) || seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
  }
  for (const d of DEFAULT_DASHBOARD) if (!seen.has(d.id)) out.push(d);
  return out;
}

/** Sichtbare Widgets in Anzeigereihenfolge; bei kritischen Fristen stehen die Hinweise ganz oben. */
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

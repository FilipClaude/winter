import type { DashboardWidgetId } from '../../db/schemas';

export const WIDGET_LABEL: Record<DashboardWidgetId, string> = {
  briefing: 'Tagesbriefing',
  ring: 'Tagesring',
  nextExam: 'Nächste Klausur',
  alerts: 'Hinweise',
  studyToday: 'Lernen heute',
  training: 'Training',
  nextMatch: 'Nächstes Spiel',
  earnings: 'Verdienst',
  steps: 'Schritte',
  sleep: 'Schlaf',
  habits: 'Habits',
  mood: 'Stimmung & Energie',
  abi: 'Abi-Schnitt',
  goals: 'Ziele',
  journal: 'Tagesnotiz',
};

/** Widgets mit kompakter Variante (Größe „klein“ = halbe Breite). */
export const HAS_SMALL = new Set<DashboardWidgetId>(['ring', 'nextMatch', 'steps', 'sleep', 'abi', 'earnings']);

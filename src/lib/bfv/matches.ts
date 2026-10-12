import type { Session } from '../../db/schemas';
import type { BfvData, BfvMatch } from './bfv';

/** Nächstes geplantes Spiel (Anstoß in der Zukunft). */
export function nextMatch(data: BfvData | null | undefined, now: Date): BfvMatch | null {
  if (!data) return null;
  return (
    data.matches.find((m) => m.status === 'geplant' && new Date(m.kickoff).getTime() > now.getTime()) ?? null
  );
}

/**
 * Gespielte BFV-Spiele der letzten 21 Tage, die noch nicht als Einheit eingetragen sind
 * (ab 2 Stunden nach Anstoß). Entfallene Spiele werden nicht abgefragt.
 */
export function pendingMatches(
  data: BfvData | null | undefined,
  sessions: Pick<Session, 'bfvId' | 'type'>[],
  now: Date,
): BfvMatch[] {
  if (!data) return [];
  const done = new Set(sessions.filter((s) => s.type === 'match' && s.bfvId).map((s) => s.bfvId));
  const t = now.getTime();
  return data.matches.filter((m) => {
    if (m.status === 'entfallen' || done.has(m.id)) return false;
    const k = new Date(m.kickoff).getTime();
    return k + 2 * 3_600_000 <= t && k >= t - 21 * 86_400_000;
  });
}

export type FormResult = 'S' | 'U' | 'N';

/** Formkurve (letzte 5) aus den eigenen Spiel-Einträgen – Ergebnisse liefert der BFV nicht lesbar. */
export function formCurve(
  sessions: Pick<Session, 'date' | 'match' | 'createdAt'>[],
  count = 5,
): FormResult[] {
  return sessions
    .filter((s) => s.match)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .slice(-count)
    .map((s) => {
      const m = s.match;
      if (!m) return 'U';
      return m.goalsFor > m.goalsAgainst ? 'S' : m.goalsFor < m.goalsAgainst ? 'N' : 'U';
    });
}

export const formatKickoff = (iso: string) =>
  new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace(',', '');

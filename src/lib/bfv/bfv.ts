import { z } from 'zod';

/**
 * BFV-Abgleich: gemeinsames Schema und reine Parser – genutzt vom Sync-Skript (Node, GitHub Action)
 * und von der App. Importe hier nur aus `zod`, damit Node das Skript ohne Bundler ausführen kann.
 *
 * Quellen (siehe docs/BFV.md):
 *  - Spielplan: offizieller iCal-Export des BFV (service.bfv.de/rest/icsexport/Spielplan …) – nur künftige Spiele.
 *  - Tabelle: Mannschaftsseite auf bfv.de (Tabelle steht als Klartext im HTML).
 *  - Ergebnisse sind auf bfv.de per Schriftart verschleiert und werden bewusst NICHT ausgelesen.
 */

export const BFV_FORMAT = 1;

export const zBfvMatch = z.object({
  /** UID aus dem iCal-Export (stabil je Spiel). */
  id: z.string().min(1).max(80),
  kickoff: z.iso.datetime({ offset: true }),
  home: z.boolean(),
  opponent: z.string().min(1).max(120),
  /** z. B. „Meisterschaften“, „Pokale“, „Freundschaftsspiele“. */
  competition: z.string().max(80),
  league: z.string().max(120),
  location: z.string().max(200),
  /** geplant = im aktuellen Export; vorbei = Anstoß vorbei und nicht mehr im Export; entfallen = verschwunden, obwohl künftig. */
  status: z.enum(['geplant', 'vorbei', 'entfallen']),
});
export type BfvMatch = z.infer<typeof zBfvMatch>;

export const zBfvTableRow = z.object({
  position: z.number().int().min(1).max(40),
  team: z.string().min(1).max(120),
  played: z.number().int().min(0).max(80),
  won: z.number().int().min(0).max(80),
  drawn: z.number().int().min(0).max(80),
  lost: z.number().int().min(0).max(80),
  goals: z.string().regex(/^\d+:\d+$/),
  diff: z.number().int().min(-500).max(500),
  points: z.number().int().min(-50).max(300),
  own: z.boolean(),
});
export type BfvTableRow = z.infer<typeof zBfvTableRow>;

export const zBfvData = z.object({
  format: z.literal(BFV_FORMAT),
  fetchedAt: z.iso.datetime({ offset: true }),
  team: z.object({ name: z.string(), url: z.url(), league: z.string() }),
  season: z.string().regex(/^\d{4}\/\d{2}$/),
  matches: z.array(zBfvMatch).max(200),
  table: z.array(zBfvTableRow).max(40),
  /** Hinweise für die App (z. B. warum Ergebnisse fehlen). */
  notes: z.array(z.string().max(300)).max(10),
});
export type BfvData = z.infer<typeof zBfvData>;

export interface BfvConfig {
  /** Name der eigenen Mannschaft, wie er im BFV-Spielplan steht (ohne Zusätze wie „U17“). */
  teamName: string;
  teamUrl: string;
  icalUrl: string;
  /** Optional: eigene Spieler-ID (bfv.de/spieler/-/<ID>) – Einzelstatistiken sind für Junioren nicht öffentlich. */
  playerId: string | null;
}

// ---------- iCal ----------

/** Entfaltet umbrochene iCal-Zeilen und entfernt Escapes (\, \; \n). */
function unfold(ics: string): string[] {
  return ics
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .map((l) => l.trimEnd());
}

const unescape = (v: string) =>
  v
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .trim();

/** iCal-Zeitpunkt „20261014T170000Z“ → ISO. Nur UTC-Zeitpunkte (so liefert der BFV). */
function icsDate(v: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(v.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

/**
 * Liest den BFV-iCal-Export. SUMMARY hat die Form „Heim-Gast, Wettbewerb, Liga“; weil Vereinsnamen
 * selbst Bindestriche enthalten („SV Planegg-Krailling“), wird über den eigenen Namen getrennt.
 */
export function parseIcs(ics: string, teamName: string): Omit<BfvMatch, 'status'>[] {
  if (!ics.includes('BEGIN:VCALENDAR')) throw new Error('Kein iCal-Kalender (BEGIN:VCALENDAR fehlt)');
  const out: Omit<BfvMatch, 'status'>[] = [];
  let ev: Record<string, string> | null = null;
  let events = 0;
  for (const line of unfold(ics)) {
    if (line === 'BEGIN:VEVENT') {
      ev = {};
      events++;
    } else if (line === 'END:VEVENT') {
      if (ev) {
        const parsed = parseEvent(ev, teamName);
        if (parsed) out.push(parsed);
      }
      ev = null;
    } else if (ev) {
      const i = line.indexOf(':');
      if (i > 0) ev[line.slice(0, i).split(';')[0] ?? ''] = line.slice(i + 1);
    }
  }
  // Format geändert (z. B. Ortszeit mit TZID statt UTC, anderes SUMMARY)? Lieber laut scheitern – die
  // alte Datei bleibt dann stehen – als still alle künftigen Spiele als „entfallen“ auszuliefern.
  if (events > 0 && out.length < events / 2)
    throw new Error(`iCal-Format unbekannt: nur ${out.length} von ${events} Terminen lesbar`);
  return out;
}

function parseEvent(ev: Record<string, string>, teamName: string): Omit<BfvMatch, 'status'> | null {
  const kickoff = icsDate(ev.DTSTART ?? '');
  const id = ev.UID?.trim();
  const summary = unescape(ev.SUMMARY ?? '');
  if (!kickoff || !id || !summary) return null;
  const [teams = '', competition = '', ...rest] = summary.split(', ');
  const idx = teams.indexOf(teamName);
  if (idx < 0) return null;
  const home = idx === 0;
  const opponent = home
    ? teams
        .slice(teamName.length)
        .replace(/^[^-]*?-/, '')
        .trim() // „SV Planegg-Krailling U17-Gegner“
    : teams.slice(0, idx).replace(/-$/, '').trim();
  if (!opponent) return null;
  return {
    id,
    kickoff,
    home,
    opponent,
    competition: competition.trim(),
    league: rest.join(', ').trim(),
    location: unescape(ev.LOCATION ?? '').replace(/,(?=\S)/g, ', '),
  };
}

// ---------- Tabelle ----------

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Liest die erste Tabelle (Gesamt) der Mannschaftsseite. Wirft, wenn keine Zeilen gefunden werden. */
export function parseTable(html: string, teamName: string): BfvTableRow[] {
  const start = html.indexOf('bfv-table-entry--data');
  if (start < 0) throw new Error('Tabelle nicht gefunden (bfv-table-entry--data fehlt)');
  const end = html.indexOf('</table>', start);
  const block = html.slice(html.lastIndexOf('<tr', start), end < 0 ? undefined : end);
  const rows = block.split(/<tr[^>]*bfv-table-entry--data[^>]*>/).slice(1);
  const cell = (row: string, name: string) => {
    const m = new RegExp(`bfv-table-entry__cell--${name}[^"]*"[^>]*>([\\s\\S]*?)</td>`).exec(row);
    return m?.[1] !== undefined ? decode(m[1]) : '';
  };
  const out = rows.map((row) => {
    const team = cell(row, 'team');
    return {
      position: Number(cell(row, 'position').replace('.', '')),
      team,
      played: Number(cell(row, 'matches')),
      won: Number(cell(row, 'wins')),
      drawn: Number(cell(row, 'draws')),
      lost: Number(cell(row, 'loses')),
      goals: cell(row, 'goalratio').replace(/\s/g, ''),
      diff: Number(cell(row, 'goaldifference')),
      points: Number(cell(row, 'score')),
      own: team.startsWith(teamName),
    };
  });
  if (out.length === 0) throw new Error('Tabelle ohne Zeilen');
  return out;
}

/** Liga-Name aus der Mannschaftsseite (Überschrift über der Tabelle), sonst leer. */
export function parseLeague(html: string): string {
  const m = /B-Junioren \/ ([^<]+)</.exec(html) ?? /<title>[^<]*\|([^<]+)<\/title>/.exec(html);
  return m?.[1] ? decode(m[1]) : '';
}

// ---------- Zusammenführen ----------

/**
 * Neuer Stand aus dem Export + bisherige Spiele. Spiele, die nicht mehr im Export stehen, bleiben
 * erhalten: „vorbei“, wenn der Anstoß vorbei ist, sonst „entfallen“ (verlegt/abgesagt).
 */
export function mergeMatches(previous: BfvMatch[], fresh: Omit<BfvMatch, 'status'>[], now: Date): BfvMatch[] {
  const byId = new Map<string, BfvMatch>();
  for (const m of previous) byId.set(m.id, m);
  const freshIds = new Set(fresh.map((m) => m.id));
  for (const m of fresh) byId.set(m.id, { ...m, status: 'geplant' });
  for (const [id, m] of byId) {
    if (freshIds.has(id)) continue;
    // Einmal „entfallen“ bleibt „entfallen“ – sonst würde ein abgesagtes Spiel nach seinem Termin zu
    // „vorbei“ und 21 Tage lang zum Eintragen angeboten (Review-4-Fund).
    if (m.status !== 'geplant') continue;
    byId.set(id, { ...m, status: new Date(m.kickoff).getTime() < now.getTime() ? 'vorbei' : 'entfallen' });
  }
  // Ein geplantes Spiel, dessen Anstoß vorbei ist, gilt als vorbei (Export kann verzögert sein).
  return [...byId.values()]
    .map((m) =>
      m.status === 'geplant' && new Date(m.kickoff).getTime() + 3 * 3_600_000 < now.getTime()
        ? { ...m, status: 'vorbei' as const }
        : m,
    )
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .slice(-120);
}

/** Saison „2026/27“ (1. Juli bis 30. Juni). */
export function seasonFor(now: Date): string {
  const y = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 6 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

/** Vergleich ohne Zeitstempel – committet wird nur bei echten Änderungen. */
export function sameContent(a: BfvData | null, b: BfvData): boolean {
  if (!a) return false;
  const strip = (d: BfvData) => JSON.stringify({ ...d, fetchedAt: '' });
  return strip(a) === strip(b);
}

/**
 * BFV-Abgleich (läuft in der GitHub Action, lokal mit `node scripts/bfv-sync.ts`).
 *
 * Holt den offiziellen iCal-Export (künftige Spiele) und die Mannschaftsseite (Tabelle), prüft alles
 * mit Zod und schreibt `public/data/bfv.json` – aber nur bei echten Änderungen. Schonend: genau zwei
 * Anfragen, eigener User-Agent mit Kontakt, Zeitlimit, drei Versuche mit wachsender Pause.
 * Bei jedem Fehler bleibt die alte Datei unverändert und das Skript endet mit Code 1 (Workflow rot).
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  BFV_FORMAT,
  mergeMatches,
  parseIcs,
  parseLeague,
  parseTable,
  sameContent,
  seasonFor,
  zBfvData,
  type BfvConfig,
  type BfvData,
} from '../src/lib/bfv/bfv.ts';

const OUT = 'public/data/bfv.json';
const UA =
  'Winter-App/2 (private Nutzung, 1-2 Abgleiche/Tag mit je 2 Anfragen; Kontakt: https://github.com/FilipClaude/winter)';

async function fetchText(url: string, attempts = 3): Promise<string> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'text/html,text/calendar;q=0.9,*/*;q=0.5' },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} für ${url}`);
      return await res.text();
    } catch (e) {
      lastError = e;
      const wait = 2000 * 2 ** i;
      console.warn(`Versuch ${i + 1} fehlgeschlagen (${String(e)}), warte ${wait} ms`);
      await new Promise((r) => setTimeout(r, wait));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function readPrevious(): BfvData | null {
  if (!existsSync(OUT)) return null;
  const r = zBfvData.safeParse(JSON.parse(readFileSync(OUT, 'utf8')));
  return r.success ? r.data : null;
}

/** Liga = häufigste Liga der Meisterschaftsspiele im Export (zuverlässiger als das Seiten-HTML). */
function mainLeague(matches: { competition: string; league: string }[]): string {
  const counts = new Map<string, number>();
  for (const m of matches)
    if (m.competition === 'Meisterschaften' && m.league)
      counts.set(m.league, (counts.get(m.league) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/**
 * Spiele aus dem bisherigen Stand. Beim Saisonwechsel (1. Juli) nur die letzten 21 Tage – so bleiben
 * Eintragen-Hinweise für Spiele Ende Juni erhalten, die alte Saison wächst aber nicht endlos weiter.
 */
function carryOver(previous: BfvData | null, now: Date): BfvData['matches'] {
  if (!previous) return [];
  if (previous.season === seasonFor(now)) return previous.matches;
  const cutoff = now.getTime() - 21 * 86_400_000;
  return previous.matches.filter((m) => new Date(m.kickoff).getTime() >= cutoff);
}

function setOutput(name: string, value: string) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function main() {
  const config = JSON.parse(readFileSync('bfv.config.json', 'utf8')) as BfvConfig;
  const now = new Date();
  const [ics, html] = [await fetchText(config.icalUrl), await fetchText(config.teamUrl)];
  const fresh = parseIcs(ics, config.teamName);
  const table = parseTable(html, config.teamName);
  if (!table.some((r) => r.own))
    throw new Error(`Eigene Mannschaft „${config.teamName}“ nicht in der Tabelle`);
  const previous = readPrevious();
  const next: BfvData = {
    format: BFV_FORMAT,
    fetchedAt: now.toISOString(),
    team: {
      name: config.teamName,
      url: config.teamUrl,
      league: mainLeague(fresh) || parseLeague(html) || (previous?.team.league ?? ''),
    },
    season: seasonFor(now),
    matches: mergeMatches(carryOver(previous, now), fresh, now),
    table,
    notes: [
      'Ergebnisse und Einzelstatistiken liefert der BFV nicht maschinenlesbar (verschleiert) – bitte nach dem Spiel selbst eintragen.',
    ],
  };
  const checked = zBfvData.parse(next);
  if (sameContent(previous, checked)) {
    console.log('Keine Änderung – nichts geschrieben.');
    setOutput('changed', 'false');
    return;
  }
  mkdirSync('public/data', { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(checked, null, 2)}\n`);
  console.log(`Geschrieben: ${checked.matches.length} Spiele, Tabelle mit ${checked.table.length} Zeilen.`);
  setOutput('changed', 'true');
}

main().catch((e: unknown) => {
  console.error(
    `BFV-Abgleich fehlgeschlagen – alte Datei bleibt: ${e instanceof Error ? e.message : String(e)}`,
  );
  process.exitCode = 1;
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  mergeMatches,
  parseIcs,
  parseLeague,
  parseTable,
  sameContent,
  seasonFor,
  zBfvData,
  type BfvData,
} from './bfv';

/** Echte Antworten vom 12.10.2026 (öffentlicher iCal-Export und Tabellen-HTML der Mannschaftsseite). */
const ICS = readFileSync('src/test/fixtures/bfv-spielplan.ics', 'utf8');
const TABLE = readFileSync('src/test/fixtures/bfv-tabelle.html', 'utf8');
const TEAM = 'SV Planegg-Krailling';

describe('BFV iCal-Export', () => {
  const matches = parseIcs(ICS, TEAM);

  it('liest alle künftigen Spiele mit Heim/Auswärts und Gegner trotz Bindestrich im Vereinsnamen', () => {
    expect(matches.length).toBeGreaterThanOrEqual(5);
    const cham = matches.find((m) => m.opponent === 'ASV Cham');
    expect(cham).toMatchObject({
      home: false,
      kickoff: '2026-10-18T13:00:00Z',
      competition: 'Meisterschaften',
      league: 'U 17 (B-Jun.) Landesliga Bayern Süd',
    });
    expect(cham?.location).toContain('93413 Cham');
    const kirchheim = matches.find((m) => m.opponent === 'Kirchheimer SC');
    expect(kirchheim?.home).toBe(true);
  });

  it('Pokalspiel mit Zusatz „U17“ am eigenen Namen', () => {
    const cup = matches.find((m) => m.competition === 'Pokale');
    expect(cup).toMatchObject({ opponent: 'SV DJK Taufkirchen', home: false });
  });

  it('ohne Kalender: Fehler statt leerer Daten', () => {
    expect(() => parseIcs('<html>Wartung</html>', TEAM)).toThrow('Kein iCal');
  });

  it('gefaltete Zeilen und Escapes', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20261024T103000Z',
      'SUMMARY:SV Planegg-Krailling-FC Bayern München\\, Meisterschaften\\, U 17 (B-J',
      ' un.) Landesliga',
      'LOCATION:Platz\\,Weg 1\\,82152 Planegg',
      'UID:abc',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    expect(parseIcs(ics, TEAM)[0]).toMatchObject({
      opponent: 'FC Bayern München',
      home: true,
      league: 'U 17 (B-Jun.) Landesliga',
      location: 'Platz, Weg 1, 82152 Planegg',
    });
  });
});

describe('BFV-Tabelle', () => {
  it('liest 14 Zeilen, markiert die eigene Mannschaft', () => {
    const rows = parseTable(TABLE, TEAM);
    expect(rows).toHaveLength(14);
    expect(rows[0]).toMatchObject({
      position: 1,
      team: 'TSV 1861 Nördlingen',
      played: 7,
      won: 7,
      goals: '32:9',
      diff: 23,
      points: 21,
      own: false,
    });
    const own = rows.find((r) => r.own);
    expect(own).toMatchObject({ position: 4, goals: '17:11', points: 14 });
    expect(rows.filter((r) => r.own)).toHaveLength(1);
    expect(parseLeague(TABLE)).toBe('U 17 (B-Jun.) Landesliga Bayern Süd');
  });

  it('ohne Tabelle: Fehler (Workflow wird rot, alte Datei bleibt)', () => {
    expect(() => parseTable('<html></html>', TEAM)).toThrow('Tabelle nicht gefunden');
  });
});

describe('Zusammenführen und Änderungserkennung', () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const fresh = parseIcs(ICS, TEAM);

  it('vergangene Spiele bleiben als „vorbei“, verschwundene künftige als „entfallen“', () => {
    const previous = [
      {
        id: 'alt',
        kickoff: '2026-10-10T12:00:00Z',
        home: true,
        opponent: 'FC Ismaning',
        competition: 'Meisterschaften',
        league: '',
        location: '',
        status: 'geplant' as const,
      },
      {
        id: 'weg',
        kickoff: '2026-12-01T12:00:00Z',
        home: true,
        opponent: 'X',
        competition: '',
        league: '',
        location: '',
        status: 'geplant' as const,
      },
    ];
    const merged = mergeMatches(previous, fresh, now);
    expect(merged.find((m) => m.id === 'alt')?.status).toBe('vorbei');
    expect(merged.find((m) => m.id === 'weg')?.status).toBe('entfallen');
    // Cham (18.10.) ist am 20.10. vorbei, obwohl noch im Export
    expect(merged.find((m) => m.opponent === 'ASV Cham')?.status).toBe('vorbei');
    expect(merged.map((m) => m.kickoff)).toEqual([...merged.map((m) => m.kickoff)].sort());
  });

  it('Saison und Vergleich ohne Zeitstempel; Schema validiert', () => {
    expect(seasonFor(new Date('2026-10-12T00:00:00Z'))).toBe('2026/27');
    expect(seasonFor(new Date('2027-05-12T00:00:00Z'))).toBe('2026/27');
    const data: BfvData = {
      format: 1,
      fetchedAt: '2026-10-12T05:00:00.000Z',
      team: { name: TEAM, url: 'https://www.bfv.de/x', league: 'Liga' },
      season: '2026/27',
      matches: mergeMatches([], fresh, now),
      table: parseTable(TABLE, TEAM),
      notes: [],
    };
    expect(zBfvData.safeParse(data).success).toBe(true);
    expect(sameContent(data, { ...data, fetchedAt: '2026-10-13T05:00:00.000Z' })).toBe(true);
    expect(sameContent(data, { ...data, table: data.table.slice(1) })).toBe(false);
    expect(sameContent(null, data)).toBe(false);
  });
});

describe('App-Seite: nächstes Spiel, offene Einträge, Form', async () => {
  const { nextMatch, pendingMatches, formCurve } = await import('./matches');
  const base = { competition: 'Meisterschaften', league: 'L', location: '', home: true };
  const data: BfvData = {
    format: 1,
    fetchedAt: '2026-10-20T05:00:00.000Z',
    team: { name: TEAM, url: 'https://www.bfv.de/x', league: 'L' },
    season: '2026/27',
    table: [],
    notes: [],
    matches: [
      {
        ...base,
        id: 'a',
        kickoff: '2026-10-10T12:00:00Z',
        opponent: 'Vor 10 Tagen',
        status: 'vorbei',
      },
      { ...base, id: 'b', kickoff: '2026-10-20T10:00:00Z', opponent: 'Heute früh', status: 'geplant' },
      { ...base, id: 'c', kickoff: '2026-10-20T15:00:00Z', opponent: 'Heute spät', status: 'geplant' },
      { ...base, id: 'd', kickoff: '2026-09-01T12:00:00Z', opponent: 'Zu alt', status: 'vorbei' },
      { ...base, id: 'e', kickoff: '2026-10-15T12:00:00Z', opponent: 'Abgesagt', status: 'entfallen' },
    ],
  };
  const now = new Date('2026-10-20T13:00:00Z');

  it('nächstes Spiel = erstes künftiges geplantes', () => {
    expect(nextMatch(data, now)?.id).toBe('c');
    expect(nextMatch(undefined, now)).toBeNull();
  });

  it('nach dem Abpfiff (≥ 2 h) und höchstens 21 Tage zurück; eingetragene und entfallene nicht', () => {
    expect(pendingMatches(data, [], now).map((m) => m.id)).toEqual(['a', 'b']);
    // 1,5 h nach Anstoß noch nicht abfragen
    expect(pendingMatches(data, [], new Date('2026-10-20T11:30:00Z')).map((m) => m.id)).toEqual(['a']);
    expect(pendingMatches(data, [{ type: 'match', bfvId: 'a' }], now).map((m) => m.id)).toEqual(['b']);
  });

  it('Form aus den eigenen Einträgen (älteste zuerst, letzte 5)', () => {
    const m = (date: string, gf: number, ga: number) => ({
      date,
      createdAt: `${date}T20:00:00.000Z`,
      match: {
        opponent: 'x',
        goalsFor: gf,
        goalsAgainst: ga,
        minutes: 80,
        goals: 0,
        assists: 0,
        shots: 0,
        rating: 6,
        reflection: '',
      },
    });
    expect(formCurve([m('2026-10-05', 1, 1), m('2026-09-01', 3, 0), m('2026-10-12', 0, 2)])).toEqual([
      'S',
      'U',
      'N',
    ]);
  });
});

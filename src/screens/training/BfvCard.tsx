import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, ListOrdered, Shield } from 'lucide-react';
import { db } from '../../db/db';
import { useBfv } from '../../hooks/useBfv';
import { useNow } from '../../hooks/useNow';
import { formatKickoff, formCurve, nextMatch, pendingMatches, type FormResult } from '../../lib/bfv/matches';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Banner, Button, Card } from '../../ui/primitives';
import { openSessionSheet } from './openSession';

/** Hinweis nach dem Abpfiff: BFV-Spiel mit einem Tap eintragen (Gegner/Datum vorausgefüllt). */
export function PendingMatchBanners() {
  const bfv = useBfv();
  const now = useNow(60_000);
  const { openSheet } = useOverlay();
  const sessions = useLiveQuery(() => db.sessions.where('type').equals('match').toArray(), []);
  if (!bfv || !sessions) return null;
  const pending = pendingMatches(bfv, sessions, now);
  if (pending.length === 0) return null;
  return (
    <div className="stack stack--s" data-testid="pending-matches">
      {pending.map((m) => (
        <Banner
          key={m.id}
          icon={Shield}
          tone="accent"
          action={
            <Button
              variant="ghost"
              size="s"
              className="accent"
              onClick={() => openSessionSheet(openSheet, { bfv: { id: m.id, kickoff: m.kickoff, home: m.home, opponent: m.opponent } })}
            >
              Eintragen
            </Button>
          }
        >
          Spiel {m.home ? 'gegen' : 'bei'} {m.opponent} ({formatKickoff(m.kickoff)}) eintragen?
        </Banner>
      ))}
    </div>
  );
}

const FORM_LABEL: Record<FormResult, string> = { S: 'Sieg', U: 'Unentschieden', N: 'Niederlage' };

export function BfvCard() {
  const bfv = useBfv();
  const now = useNow(60_000);
  const sessions = useLiveQuery(() => db.sessions.where('type').equals('match').toArray(), []);
  const { openSheet } = useOverlay();
  if (!bfv) {
    return (
      <Card label="BFV" icon={Shield} ariaLabel="BFV-Spielplan" testId="bfv-card">
        <p className="small faint">Noch keine BFV-Daten (der Abgleich läuft täglich morgens über GitHub).</p>
      </Card>
    );
  }
  const next = nextMatch(bfv, now);
  const upcoming = bfv.matches.filter((m) => m.status === 'geplant' && new Date(m.kickoff) > now).slice(0, 4);
  const own = bfv.table.find((r) => r.own);
  const form = formCurve(sessions ?? []);
  return (
    <>
      <Card label={bfv.team.league || 'BFV'} icon={Shield} ariaLabel="BFV-Spielplan" testId="bfv-card">
        {next ? (
          <div className="stack stack--s">
            <span className="label">Nächstes Spiel</span>
            <p className="list-item__title" data-testid="bfv-next">
              {formatKickoff(next.kickoff)} · {next.home ? 'gegen' : 'bei'} {next.opponent}
            </p>
            <p className="xsmall faint">
              {next.competition}
              {next.location ? ` · ${next.location}` : ''}
            </p>
          </div>
        ) : (
          <p className="small faint">Keine geplanten Spiele im BFV-Spielplan.</p>
        )}
        {upcoming.length > 1 && (
          <div className="list" style={{ marginTop: 'var(--space-3)' }}>
            {upcoming.slice(1).map((m) => (
              <div key={m.id} className="list-item">
                <CalendarClock size={16} strokeWidth={1.5} aria-hidden className="faint" />
                <span className="grow small">
                  {m.home ? 'gegen' : 'bei'} {m.opponent}
                </span>
                <span className="mono xsmall muted">{formatKickoff(m.kickoff)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="row row--between" style={{ marginTop: 'var(--space-3)' }}>
          <span className="xsmall faint">
            {/* fetchedAt ändert sich nur, wenn sich Daten ändern (geprüft wird täglich) */}
            Zuletzt geändert {new Date(bfv.fetchedAt).toLocaleDateString('de-DE')} · <a href={bfv.team.url} target="_blank" rel="noreferrer">bfv.de</a>
          </span>
          {form.length > 0 && (
            <span className="form-curve" role="img" aria-label={`Form der letzten ${form.length} Spiele: ${form.map((f) => FORM_LABEL[f]).join(', ')}`}>
              {form.map((f, i) => (
                <span key={i} className={`form-curve__dot form-curve__dot--${f}`} aria-hidden>
                  {f}
                </span>
              ))}
            </span>
          )}
        </div>
      </Card>
      {bfv.table.length > 0 && (
        <Card
          label={`Tabelle${own ? ` · Platz ${own.position}` : ''}`}
          icon={ListOrdered}
          ariaLabel="Tabelle"
          testId="bfv-table"
          action={
            next ? (
              <Button variant="ghost" size="s" onClick={() => openSessionSheet(openSheet, { type: 'match' })}>
                Spiel
              </Button>
            ) : undefined
          }
        >
          <table className="bfv-table">
            <thead>
              <tr>
                <th>Pl.</th>
                <th className="bfv-table__team">Verein</th>
                <th>Sp.</th>
                <th>Tore</th>
                <th>Pkt.</th>
              </tr>
            </thead>
            <tbody>
              {bfv.table.map((r) => (
                <tr key={r.team} className={r.own ? 'bfv-table__own' : undefined}>
                  <td className="num">{r.position}</td>
                  <td className="bfv-table__team">{r.team}</td>
                  <td className="num">{r.played}</td>
                  <td className="mono">{r.goals}</td>
                  <td className="num">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {bfv.notes[0] && <p className="xsmall faint" style={{ marginTop: 'var(--space-3)' }}>{bfv.notes[0]}</p>}
          {own && <Badge tone="muted">{own.won}-{own.drawn}-{own.lost} (S-U-N)</Badge>}
        </Card>
      )}
    </>
  );
}

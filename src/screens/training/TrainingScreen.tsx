import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, AlertTriangle, CalendarDays, Medal, Plus, Timer, Trophy } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { saveSettings } from '../../db/repo';
import { SESSION_TYPES, type Session, type SessionType, type WeekPlan } from '../../db/schemas';
import { useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { detectPRs, exerciseBests, loadRatio, type LoadStatus, seasonOf, seasonRange, seasonStats, SESSION_LABEL, sessionLoad, weeklyLoads } from '../../lib/calc/training';
import { formatDecimal } from '../../lib/calc/insights';
import { addDays, formatShort, formatWeekdayShort, isoWeekNumber, isoWeekday, startOfWeek, type ISODate } from '../../lib/date';
import { BarChart } from '../../ui/charts';
import { Segmented } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Banner, Button, Card, EmptyState, ScreenHeader, SectionTitle, Stat } from '../../ui/primitives';
import { openSessionSheet } from './openSession';
import { SESSION_ICON } from './session-icons';
import { ScreenSkeleton } from '../../ui/kit';

type Filter = 'alle' | 'fussball' | 'gym' | 'spiele';

export default function TrainingScreen() {
  const today = useToday();
  const settings = useSettings();
  const { openSheet } = useOverlay();
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const [filter, setFilter] = useState<Filter>('alle');

  if (!sessions) return <ScreenSkeleton />;

  const season = seasonOf(today);
  const range = seasonRange(season);
  const ratio = loadRatio(sessions, today);
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(startOfWeek(today), -7 * (7 - i)));
  const weekly = weeklyLoads(sessions, weeks);
  const matches = sessions.filter((s) => s.type === 'match' && s.date >= range.from && s.date <= range.to);
  const stats = seasonStats(matches);
  const prMarks = detectPRs(sessions);
  const prSessions = new Set(prMarks.map((m) => m.sessionId));
  const bests = exerciseBests(sessions).slice(0, 6);

  const filtered = sessions
    .filter((s) => filter === 'alle' || (filter === 'fussball' && (s.type === 'football' || s.type === 'match')) || (filter === 'gym' && s.type === 'gym') || (filter === 'spiele' && s.type === 'match'))
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
    .slice(0, 40);

  return (
    <div className="screen">
      <ScreenHeader eyebrow={`Saison ${season}`} />
      <div className="row row--between">
        <h1 className="screen-title">Training</h1>
        <Button variant="primary" size="s" icon={Plus} onClick={() => openSessionSheet(openSheet, { date: today })}>
          Einheit
        </Button>
      </div>

      <Card label="Belastung" icon={Activity} ariaLabel="Belastung" testId="load-card">
        <div className="row row--between" style={{ alignItems: 'flex-end' }}>
          <div>
            <div className="big num">{ratio.acute.toLocaleString('de-DE')}</div>
            <div className="xsmall faint">Load letzte 7 Tage</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="big big--s num">{ratio.ratio === null ? '–' : formatDecimal(ratio.ratio, 2)}</div>
            <div className="xsmall faint">akut : chronisch</div>
          </div>
        </div>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <BarChart
            label="Wochenlast der letzten 8 Wochen"
            data={weekly.map((w, i) => ({ label: `KW${isoWeekNumber(w.week)}`, value: w.load, highlight: i === weekly.length - 1, warn: i === weekly.length - 1 && ratio.status === 'hoch' }))}
            goal={ratio.chronic || undefined}
            goalLabel={`Ø der letzten 4 Wochen: ${ratio.chronic}`}
            height={96}
          />
        </div>
        <div style={{ marginTop: 'var(--space-3)' }}>
          <LoadStatusLine status={ratio.status} />
        </div>
        <p className="xsmall faint" style={{ marginTop: 'var(--space-2)' }}>
          Load = Dauer × RPE. Grobe Orientierung, keine medizinische Aussage.
        </p>
      </Card>

      <WeekPlanCard plan={settings.weekPlan} today={today} sessions={sessions} />

      <SectionTitle>Saison {season} · Spiele</SectionTitle>
      <Card ariaLabel="Saisonstatistik" testId="season-card">
        {stats.games === 0 ? (
          <EmptyState icon={Trophy} title="Noch keine Spiele in dieser Saison">
            Trag ein Spiel ein, dann erscheinen Tore pro 90 Minuten, Quote und Note.
          </EmptyState>
        ) : (
          <div className="stat-grid">
            <Stat value={stats.games} label="Spiele" />
            <Stat value={stats.goals} label="Tore" />
            <Stat value={stats.assists} label="Assists" />
            <Stat value={formatDecimal(stats.goalsPer90, 2)} label="Tore / 90" />
            <Stat value={formatDecimal(stats.assistsPer90, 2)} label="Assists / 90" />
            <Stat value={stats.conversion === null ? '–' : `${stats.conversion}`} unit="%" label="Chancenverwertung" />
            <Stat value={stats.minutes.toLocaleString('de-DE')} label="Minuten" />
            <Stat value={formatDecimal(stats.avgRating, 1)} label="Ø Note" />
            <Stat value={`${stats.wins}-${stats.draws}-${stats.losses}`} label="S-U-N" />
          </div>
        )}
      </Card>

      {bests.length > 0 && (
        <>
          <SectionTitle>Bestleistungen</SectionTitle>
          <Card ariaLabel="Bestleistungen" testId="bests-card">
            <div className="list">
              {bests.map((b) => (
                <div key={b.name} className="list-item">
                  <span className="list-item__icon">
                    <Medal size={16} strokeWidth={1.5} aria-hidden />
                  </span>
                  <span className="grow truncate">{b.name}</span>
                  <span style={{ textAlign: 'right' }}>
                    {b.e1rm > 0 ? (
                      <>
                        <span className="num">{formatDecimal(b.e1rm, 1)}</span>
                        <span className="unit">kg 1RM</span>
                      </>
                    ) : (
                      <>
                        <span className="num">{b.reps}</span>
                        <span className="unit">Wdh.</span>
                      </>
                    )}
                    <br />
                    <span className="xsmall faint">{formatShort(b.date)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <SectionTitle>Verlauf</SectionTitle>
      <Segmented<Filter>
        label="Filter"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'alle', label: 'Alle' },
          { value: 'fussball', label: 'Fußball' },
          { value: 'gym', label: 'Gym' },
          { value: 'spiele', label: 'Spiele' },
        ]}
      />
      <Card ariaLabel="Einheiten" testId="session-list">
        {filtered.length === 0 ? (
          <EmptyState icon={Timer} title="Keine Einheiten">
            Über das Plus oder die Schnellerfassung eintragen.
          </EmptyState>
        ) : (
          <div className="list">
            {filtered.map((s) => (
              <SessionRow key={s.id} s={s} pr={prSessions.has(s.id)} onOpen={() => openSessionSheet(openSheet, { session: s })} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function LoadStatusLine({ status }: { status: LoadStatus }) {
  if (status === 'hoch') {
    return (
      <Banner icon={AlertTriangle} tone="warn" testId="load-warning">
        Starker Sprung: Diese Woche deutlich mehr als dein Schnitt. Erholung einplanen.
      </Banner>
    );
  }
  const text: Record<LoadStatus, string> = {
    'zu-wenig-daten': 'Für das Verhältnis braucht es mindestens 3 Wochen Trainingsdaten.',
    niedrig: 'Weniger als üblich – Entlastung oder Pause.',
    ok: 'Im Rahmen deiner üblichen Belastung.',
    erhoeht: 'Etwas mehr als üblich. Im Blick behalten.',
    hoch: '',
  };
  return (
    <div className="stack stack--s small" style={{ alignItems: 'flex-start' }}>
      {status === 'ok' ? <Badge>im Rahmen</Badge> : status === 'erhoeht' ? <Badge tone="warn">erhöht</Badge> : <Badge tone="muted">{status === 'niedrig' ? 'niedrig' : 'zu wenig Daten'}</Badge>}
      <span className="muted">{text[status]}</span>
    </div>
  );
}

function SessionRow({ s, pr, onOpen }: { s: Session; pr: boolean; onOpen: () => void }) {
  const Icon = SESSION_ICON[s.type];
  let meta = `${s.durationMin} min · RPE ${s.rpe} · Load ${sessionLoad(s.durationMin, s.rpe)}`;
  let title = SESSION_LABEL[s.type];
  if (s.match) {
    title = `${s.match.opponent || 'Spiel'} ${s.match.goalsFor}:${s.match.goalsAgainst}`;
    meta = `${s.match.minutes}′ · ${s.match.goals} T · ${s.match.assists} A · Note ${s.match.rating}`;
  } else if (s.gym && s.gym.exercises.length > 0) {
    meta = `${s.gym.exercises.map((e) => e.name).slice(0, 3).join(', ')}${s.gym.exercises.length > 3 ? ' …' : ''}`;
  }
  return (
    <button type="button" className="list-item" onClick={onOpen} data-testid="session-row">
      <span className="list-item__icon">
        <Icon size={16} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="list-item__title row" style={{ gap: 'var(--space-2)' }}>
          <span className="truncate">{title}</span>
          {pr && <Badge>PR</Badge>}
        </span>
        <span className="list-item__meta truncate" style={{ display: 'block' }}>
          {meta}
        </span>
      </span>
      <span className="xsmall faint" style={{ textAlign: 'right', flex: 'none' }}>
        {formatWeekdayShort(s.date)}
        <br />
        {formatShort(s.date)}
      </span>
    </button>
  );
}

function WeekPlanCard({ plan, today, sessions }: { plan: WeekPlan; today: ISODate; sessions: Session[] }) {
  const { openSheet } = useOverlay();
  const monday = startOfWeek(today);
  return (
    <Card
      label="Wochenplan"
      icon={CalendarDays}
      ariaLabel="Wochenplan"
      action={
        <Button variant="ghost" size="s" onClick={() => openSheet({ title: 'Wochenplan', render: (close) => <WeekPlanSheet plan={plan} close={close} /> })}>
          Bearbeiten
        </Button>
      }
    >
      <div className="week-plan">
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
          const date = addDays(monday, wd - 1);
          const planned = plan[String(wd)] ?? [];
          const done = sessions.filter((s) => s.date === date);
          const isToday = date === today;
          return (
            <div key={wd} className={`week-plan__day ${isToday ? 'is-today' : ''}`}>
              <span className="week-plan__wd">{formatWeekdayShort(date)}</span>
              <span className="week-plan__items">
                {planned.length === 0 && done.length === 0 && <span className="faint">–</span>}
                {planned.map((t) => {
                  const Icon = SESSION_ICON[t];
                  const hit = done.some((s) => s.type === t);
                  return <Icon key={t} size={16} strokeWidth={1.5} className={hit ? 'accent' : date < today ? 'faint' : ''} aria-label={`${SESSION_LABEL[t]}${hit ? ' erledigt' : ''}`} />;
                })}
              </span>
            </div>
          );
        })}
      </div>
      <p className="xsmall faint" style={{ marginTop: 'var(--space-2)' }}>
        Heute geplant: {(plan[String(isoWeekday(today))] ?? []).map((t) => SESSION_LABEL[t]).join(', ') || 'nichts'}
      </p>
    </Card>
  );
}

const WEEKDAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function WeekPlanSheet({ plan, close }: { plan: WeekPlan; close: () => void }) {
  const { toast } = useOverlay();
  const [draft, setDraft] = useState<WeekPlan>(() => ({ ...plan }));
  const toggle = (wd: string, t: SessionType) => {
    const cur = draft[wd] ?? [];
    setDraft({ ...draft, [wd]: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t].slice(0, 4) });
  };
  return (
    <div className="form">
      {WEEKDAYS.map((name, i) => {
        const wd = String(i + 1);
        return (
          <div key={wd} className="stack stack--s">
            <span className="field__label">{name}</span>
            <div className="chips">
              {SESSION_TYPES.map((t) => (
                <button key={t} type="button" className="chip" aria-pressed={(draft[wd] ?? []).includes(t)} onClick={() => toggle(wd, t)}>
                  {SESSION_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <Button
        variant="primary"
        block
        onClick={() =>
          void saveSettings({ weekPlan: draft }).then(() => {
            toast('Wochenplan gespeichert');
            close();
          })
        }
      >
        Speichern
      </Button>
    </div>
  );
}

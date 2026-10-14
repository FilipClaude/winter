import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Dumbbell,
  Footprints,
  HeartPulse,
  LayoutGrid,
  Moon,
  NotebookPen,
  Plus,
  Repeat,
  Smile,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { db } from '../../db/db';
import { toggleHabit, updateDay } from '../../db/repo';
import { useKV, useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { dayRing } from '../../lib/calc/ring';
import { SESSION_LABEL, sessionLoad, sessionTitle } from '../../lib/calc/training';
import { addDays, formatHM, formatMonth, isoWeekNumber, isoWeekday, relativeDayName, toISODate, toTimeHM, type ISODate } from '../../lib/date';
import { navigate } from '../../router';
import { FrostCheck, Scale } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Banner, Button, Card, EmptyState, IconButton, ProgressBar, ScreenHeader } from '../../ui/primitives';
import { NumberTicker, Ring } from '../../ui/visual';
import { openHealthSheet } from '../health/openHealth';
import { NextExamCard } from '../school/NextExamCard';
import { SchoolAlerts } from '../school/SchoolAlerts';
import { PendingMatchBanners } from '../training/BfvCard';
import { openSessionSheet } from '../training/openSession';
import { SESSION_ICON } from '../training/session-icons';
import { EarningsWidget } from './Earnings';
import { JournalSheet } from './JournalSheet';
import { BackupReminder, DemoNotice } from './Reminders';
import { useDayData } from './useDayData';
import { ScreenSkeleton } from '../../ui/kit';
import type { ReactNode } from 'react';
import type { DashboardWidgetId, GymSplit } from '../../db/schemas';
import { normalizeDashboard, orderForDisplay } from '../../lib/calc/dashboard-layout';
import { AbiWidget, BriefingWidget, DashboardEditor, GoalsWidget, NextMatchWidget, StudyTodayWidget } from './widgets';

export function TodayScreen({ date: dateParam }: { date?: string | undefined }) {
  const today = useToday();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const reduce = useReducedMotion();
  const go = (d: ISODate) => navigate('heute', d === today ? undefined : d);

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={`KW ${isoWeekNumber(date)}`}
        right={
          date !== today ? (
            <Button variant="ghost" size="s" onClick={() => go(today)}>
              Zu heute
            </Button>
          ) : undefined
        }
      />
      <motion.div
        key={date}
        className="screen"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18 }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.18}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          if (info.offset.x > 80) go(addDays(date, -1));
          else if (info.offset.x < -80) go(addDays(date, 1));
        }}
        style={{ touchAction: 'pan-y' }}
      >
        <DateHero date={date} today={today} onPrev={() => go(addDays(date, -1))} onNext={() => go(addDays(date, 1))} />
        <TodayContent date={date} today={today} />
      </motion.div>
    </div>
  );
}

function DateHero({ date, today, onPrev, onNext }: { date: ISODate; today: ISODate; onPrev: () => void; onNext: () => void }) {
  const rel = relativeDayName(date, today);
  const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  return (
    <div className="today-hero">
      <span className="today-hero__day num" aria-hidden>
        {Number(date.slice(8, 10))}
      </span>
      <h1 className="today-hero__text">
        <span className="today-hero__weekday">
          {weekday}
          {rel && rel !== 'heute' && <span className="faint"> · {rel}</span>}
        </span>
        <span className="today-hero__month">{formatMonth(date)}</span>
        <span className="sr-only">{date}</span>
      </h1>
      <div className="today-hero__nav">
        <IconButton icon={ChevronLeft} label="Vortag" onClick={onPrev} />
        <IconButton icon={ChevronRight} label="Folgetag" onClick={onNext} />
      </div>
    </div>
  );
}

function TodayContent({ date, today }: { date: ISODate; today: ISODate }) {
  const data = useDayData(date);
  const settings = useSettings();
  const { openSheet } = useOverlay();
  const lastImport = useKV<string>('lastHealthImport');
  if (!data) return <ScreenSkeleton cards={5} />;

  const plan = settings.weekPlan[String(isoWeekday(date))] ?? [];
  const ring = dayRing(
    {
      habitsDone: data.habits.filter((h) => data.checked.has(h.id)).length,
      habitsPlanned: data.habits.length,
      studyMin: data.studyMin,
      sleepMin: data.sleep?.minutes ?? null,
      training: { planned: plan.length > 0, done: data.sessions.length > 0 },
      earnings: { weekCents: data.weekEarningsCents, goalCents: settings.earnings.weeklyGoalCents, weekday: isoWeekday(date) },
    },
    settings.goals,
    settings.ring,
  );
  const importedToday = lastImport !== undefined && toISODate(lastImport) === today;
  const g = settings.goals;
  const isToday = date === today;

  const steps = (
    <Card label="Schritte" icon={Footprints} ariaLabel="Schritte">
      {data.health?.steps !== undefined ? (
        <>
          <div className="big big--m">
            <NumberTicker value={data.health.steps} />
          </div>
          <div className="of" style={{ marginTop: 6 }}>
            {data.health.distanceKm !== undefined && <span className="mono">{data.health.distanceKm.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km</span>}
            {data.health.flights !== undefined && <span className="mono"> · {data.health.flights} Stockw.</span>}
          </div>
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={g.steps > 0 ? data.health.steps / g.steps : 0} label="Schrittziel" />
          </div>
        </>
      ) : (
        <p className="small faint card-empty">Noch kein Import</p>
      )}
    </Card>
  );

  const sleep = (
    <Card label="Schlaf" icon={Moon} ariaLabel="Schlaf" onClick={() => navigate('koerper')}>
      {data.sleep ? (
        <>
          <div className="big big--m num">{formatHM(data.sleep.minutes)}</div>
          <div className="of mono" style={{ marginTop: 6 }}>
            {toTimeHM(data.sleep.start)}–{toTimeHM(data.sleep.end)}
          </div>
          <div className="xsmall faint" style={{ marginTop: 8 }}>
            {data.sleep.source === 'health' ? 'aus Health' : data.sleep.quality ? `Qualität ${data.sleep.quality}/5` : 'manuell'}
          </div>
        </>
      ) : (
        <p className="small faint card-empty">Nicht erfasst</p>
      )}
    </Card>
  );

  const widgets: Record<DashboardWidgetId, { l: ReactNode; s?: ReactNode } | null> = {
    briefing: isToday ? { l: <BriefingWidget today={today} /> } : null,
    ring: {
      l: (
        <Card ariaLabel="Tagesring" testId="ring-card">
          <div className="ring-card">
            <Ring value={ring.total} size={132} label="Tagesziele erfüllt">
              <div>
                <NumberTicker value={Math.round(ring.total * 100)} className="num ring-card__pct" />
                <span className="unit">%</span>
                <div className="xsmall faint">Tagesziele</div>
              </div>
            </Ring>
            <ul className="ring-card__parts">
              {ring.parts.map((p) => (
                <li key={p.key}>
                  <div className="row row--between xsmall">
                    <span className="muted">{p.label}</span>
                    <span className="mono faint">{p.detail}</span>
                  </div>
                  <ProgressBar value={p.value} label={p.label} />
                </li>
              ))}
              {ring.parts.length === 0 && <li className="small muted">Keine Tagesziele aktiv.</li>}
            </ul>
          </div>
        </Card>
      ),
      s: (
        <Card ariaLabel="Tagesring" testId="ring-card">
          <div className="ring-card ring-card--s">
            <Ring value={ring.total} size={96} label="Tagesziele erfüllt">
              <div>
                <NumberTicker value={Math.round(ring.total * 100)} className="num ring-card__pct" />
                <span className="unit">%</span>
              </div>
            </Ring>
          </div>
        </Card>
      ),
    },
    alerts: isToday
      ? {
          l: (
            <div className="stack stack--s">
              <SchoolAlerts today={today} />
              <PendingMatchBanners />
              <BackupReminder today={today} />
              <DemoNotice />
              {!data.health && !importedToday && (
                <Banner
                  icon={HeartPulse}
                  tone="accent"
                  testId="health-hint"
                  action={
                    <Button variant="ghost" size="s" className="accent" onClick={() => openHealthSheet(openSheet, settings.shortcutName)}>
                      Health holen
                    </Button>
                  }
                >
                  Heute noch kein Health-Import.
                </Banner>
              )}
            </div>
          ),
        }
      : null,
    nextExam: { l: <NextExamCard today={date < today ? today : date} /> },
    earnings: { l: <EarningsWidget date={date} />, s: <EarningsWidget date={date} compact /> },
    studyToday: { l: <StudyTodayWidget date={date} /> },
    training: { l: <TrainingCard date={date} sessions={data.sessions} plan={plan} /> },
    nextMatch: { l: <NextMatchWidget today={today} />, s: <NextMatchWidget today={today} /> },
    steps: { l: steps, s: steps },
    sleep: { l: sleep, s: sleep },
    habits: {
      l: (
        <Card label="Habits" icon={Repeat} ariaLabel="Habits" action={<Button variant="ghost" size="s" onClick={() => navigate('habits')}>Alle</Button>}>
          {data.habits.length === 0 ? (
            <EmptyState icon={Repeat} title="Keine Habits für heute">
              <Button variant="secondary" size="s" onClick={() => navigate('habits')}>
                Habit anlegen
              </Button>
            </EmptyState>
          ) : (
            <div className="list" data-testid="habit-list">
              {data.habits.map((h) => (
                <div key={h.id} className="list-item">
                  <FrostCheck checked={data.checked.has(h.id)} label={h.name} onChange={() => void toggleHabit(h.id, date)} />
                  <span className={`grow ${data.checked.has(h.id) ? 'muted' : ''}`}>{h.name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ),
    },
    mood: {
      l: (
        <Card label="Stimmung & Energie" icon={Smile} ariaLabel="Stimmung und Energie">
          <div className="stack">
            <div className="stack stack--s">
              <span className="xsmall muted">Stimmung</span>
              <Scale label="Stimmung" value={data.day.mood} onChange={(v) => void updateDay(date, { mood: v })} allowClear fill />
            </div>
            <div className="stack stack--s">
              <span className="xsmall muted">Energie</span>
              <Scale label="Energie" value={data.day.energy} onChange={(v) => void updateDay(date, { energy: v })} allowClear fill />
            </div>
          </div>
        </Card>
      ),
    },
    abi: { l: <AbiWidget />, s: <AbiWidget /> },
    goals: { l: <GoalsWidget today={today} /> },
    journal: {
      l: (
        <Card label="Tagesnotiz" icon={NotebookPen} ariaLabel="Tagesnotiz öffnen" onClick={() => openSheet({ title: 'Tagesnotiz', render: (close) => <JournalSheet day={data.day} close={close} /> })}>
          {data.day.note || data.day.good || data.day.better || data.day.tomorrow ? (
            <div className="stack stack--s small">
              {data.day.note && <p className="journal-preview">{data.day.note}</p>}
              {data.day.tomorrow && (
                <p className="muted">
                  <span className="faint">Morgen wichtig: </span>
                  {data.day.tomorrow}
                </p>
              )}
            </div>
          ) : (
            <p className="small faint">Kurz festhalten, wie der Tag war.</p>
          )}
        </Card>
      ),
    },
  };

  const layout = orderForDisplay(normalizeDashboard(settings.dashboard));
  return (
    <>
      <div className="dash" data-testid="dashboard">
        {layout.map((w) => {
          const entry = widgets[w.id];
          if (!entry) return null;
          const node = w.size === 's' ? (entry.s ?? entry.l) : entry.l;
          return (
            <div key={w.id} className={`dash__w dash__w--${entry.s ? w.size : 'l'}`} data-widget={w.id}>
              {node}
            </div>
          );
        })}
      </div>
      <Button
        variant="ghost"
        block
        icon={LayoutGrid}
        data-testid="dashboard-edit"
        onClick={() => openSheet({ title: 'Dashboard anpassen', render: () => <DashboardEditor /> })}
      >
        Dashboard anpassen
      </Button>
    </>
  );
}

function TrainingCard({ date, sessions, plan }: { date: ISODate; sessions: { id: string; type: keyof typeof SESSION_LABEL; split?: GymSplit | undefined; durationMin: number; rpe: number }[]; plan: (keyof typeof SESSION_LABEL)[] }) {
  const { openSheet } = useOverlay();
  const open = useLiveQuery(() => db.sessions.count(), []);
  const pending = plan.filter((p) => !sessions.some((s) => s.type === p));
  return (
    <Card
      label="Training"
      icon={Dumbbell}
      ariaLabel="Training heute"
      action={<IconButton icon={Plus} label="Training eintragen" variant="accent" onClick={() => openSessionSheet(openSheet, { date })} />}
    >
      {sessions.length === 0 && pending.length === 0 ? (
        <p className="small faint">{open === 0 ? 'Noch keine Einheiten erfasst.' : 'Heute frei.'}</p>
      ) : (
        <div className="list">
          {sessions.map((s) => (
            <div key={s.id} className="list-item">
              <span className="list-item__icon">
                <SessionIcon type={s.type} />
              </span>
              <span className="grow">
                <span className="list-item__title">{sessionTitle(s)}</span>
                <br />
                <span className="list-item__meta mono">
                  {s.durationMin} min · RPE {s.rpe} · Load {sessionLoad(s.durationMin, s.rpe)}
                </span>
              </span>
              <Badge>erledigt</Badge>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p} className="list-item">
              <span className="list-item__icon">
                <CircleDashed size={16} strokeWidth={1.5} aria-hidden />
              </span>
              <span className="grow">
                <span className="list-item__title">{SESSION_LABEL[p]}</span>
                <br />
                <span className="list-item__meta">laut Wochenplan</span>
              </span>
              <Button size="s" variant="secondary" onClick={() => openSessionSheet(openSheet, { date, type: p })}>
                Eintragen
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SessionIcon({ type }: { type: keyof typeof SESSION_ICON }) {
  const Icon = SESSION_ICON[type];
  return <Icon size={16} strokeWidth={1.5} aria-hidden />;
}

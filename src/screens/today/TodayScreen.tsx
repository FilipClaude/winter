import { useLiveQuery } from 'dexie-react-hooks';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Droplet,
  Dumbbell,
  Footprints,
  HeartPulse,
  Moon,
  NotebookPen,
  Plus,
  Repeat,
  Smile,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { db } from '../../db/db';
import { addWater, toggleHabit, updateDay } from '../../db/repo';
import { useKV, useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { dayRing } from '../../lib/calc/ring';
import { SESSION_LABEL, sessionLoad } from '../../lib/calc/training';
import { addDays, formatHM, formatMonth, isoWeekNumber, isoWeekday, relativeDayName, toISODate, toTimeHM, type ISODate } from '../../lib/date';
import { navigate } from '../../router';
import { FrostCheck, Scale } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Banner, Button, Card, EmptyState, IconButton, ProgressBar, ScreenHeader } from '../../ui/primitives';
import { NumberTicker, Ring } from '../../ui/visual';
import { MealSheet } from '../body/MealSheet';
import { openHealthSheet } from '../health/openHealth';
import { DeadlineAlerts, NextDateCard } from '../school/DeadlineAlerts';
import { openSessionSheet } from '../training/openSession';
import { SESSION_ICON } from '../training/session-icons';
import { JournalSheet } from './JournalSheet';
import { BackupReminder, DemoNotice } from './Reminders';
import { useDayData } from './useDayData';

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
  if (!data) return <div style={{ minHeight: 600 }} />;

  const ring = dayRing(
    {
      habitsDone: data.habits.filter((h) => data.checked.has(h.id)).length,
      habitsPlanned: data.habits.length,
      proteinG: data.proteinG,
      waterGlasses: data.day.water,
      studyMin: data.studyMin,
      sleepMin: data.sleep?.minutes ?? null,
    },
    settings.goals,
    settings.ring,
  );
  const importedToday = lastImport !== undefined && toISODate(lastImport) === today;
  const g = settings.goals;

  return (
    <>
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

      {date === today && <DeadlineAlerts today={today} />}
      {date === today && <BackupReminder today={today} />}
      {date === today && <DemoNotice />}

      {date === today && !data.health && !importedToday && (
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

      <div className="grid-2">
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
      </div>

      <div className="grid-2">
        <Card
          label="Protein"
          icon={Activity}
          ariaLabel="Protein"
          action={<IconButton icon={Plus} label="Mahlzeit eintragen" variant="accent" onClick={() => openSheet({ title: 'Mahlzeit', render: (close) => <MealSheet date={date} close={close} /> })} />}
        >
          <div className="big big--m" data-testid="protein-value">
            <NumberTicker value={data.proteinG} />
            <span className="unit">g</span>
          </div>
          <div className="of" style={{ margin: '6px 0 10px' }}>
            von {g.proteinG} g · {data.kcal.toLocaleString('de-DE')} kcal
          </div>
          <ProgressBar value={g.proteinG > 0 ? data.proteinG / g.proteinG : 0} label="Proteinziel" />
        </Card>
        <Card
          label="Wasser"
          icon={Droplet}
          ariaLabel="Wasser"
          action={<IconButton icon={Plus} label="Ein Glas Wasser" variant="accent" onClick={() => void addWater(date, 1)} />}
        >
          <div className="big big--m" data-testid="water-value">
            <NumberTicker value={data.day.water} />
            <span className="unit">Gläser</span>
          </div>
          <div className="of" style={{ margin: '6px 0 10px' }}>
            von {g.waterGlasses} · {((data.day.water * settings.glassMl) / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} l
          </div>
          <div className="glasses" aria-hidden>
            {Array.from({ length: Math.max(g.waterGlasses, data.day.water) }, (_, i) => (
              <i key={i} className={i < data.day.water ? 'on' : ''} />
            ))}
          </div>
          {data.day.water > 0 && (
            <button type="button" className="btn btn--ghost btn--s glasses__undo" onClick={() => void addWater(date, -1)}>
              Ein Glas zurück
            </button>
          )}
        </Card>
      </div>

      <NextDateCard today={date} />

      <TrainingCard date={date} sessions={data.sessions} plan={settings.weekPlan[String(isoWeekday(date))] ?? []} />

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

      <Card
        label="Tagesnotiz"
        icon={NotebookPen}
        ariaLabel="Tagesnotiz öffnen"
        onClick={() => openSheet({ title: 'Tagesnotiz', render: (close) => <JournalSheet day={data.day} close={close} /> })}
      >
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
    </>
  );
}

function TrainingCard({ date, sessions, plan }: { date: ISODate; sessions: { id: string; type: keyof typeof SESSION_LABEL; durationMin: number; rpe: number }[]; plan: (keyof typeof SESSION_LABEL)[] }) {
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
                <span className="list-item__title">{SESSION_LABEL[s.type]}</span>
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

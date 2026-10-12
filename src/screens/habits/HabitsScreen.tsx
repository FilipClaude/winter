import { useLiveQuery } from 'dexie-react-hooks';
import { Flame, Plus, Repeat, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteHabit, saveHabit, toggleHabit, ValidationError } from '../../db/repo';
import type { Habit } from '../../db/schemas';
import { useToday } from '../../hooks/useNow';
import { dailyCompletion, habitRate, habitStreak, heatLevel, isScheduled } from '../../lib/calc/habits';
import { addDays, dateRange, formatDE, startOfWeek, type ISODate } from '../../lib/date';
import { Heatmap } from '../../ui/charts';
import { FrostCheck, Segmented, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button, Card, EmptyState, ScreenHeader, SectionTitle } from '../../ui/primitives';
import { ScreenSkeleton } from '../../ui/kit';

const WEEKS = 18;
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export default function HabitsScreen() {
  const today = useToday();
  const { openSheet } = useOverlay();
  const data = useLiveQuery(async () => ({ habits: await db.habits.orderBy('order').toArray(), checks: await db.habitChecks.toArray() }), []);
  if (!data) return <ScreenSkeleton />;
  const active = data.habits.filter((h) => !h.archived);
  const start = addDays(startOfWeek(today), -7 * (WEEKS - 1));
  const days = dateRange(start, addDays(startOfWeek(today), 6));
  const completion = dailyCompletion(active, data.checks, days);
  const weeks = Array.from({ length: WEEKS }, (_, w) =>
    days.slice(w * 7, w * 7 + 7).map((d) => {
      const v = completion.get(d) ?? null;
      return {
        date: d,
        level: d > today ? null : v === null ? (0 as const) : heatLevel(v),
        title: `${formatDE(d)}: ${v === null ? 'nichts geplant' : `${Math.round(v * 100)} %`}`,
      };
    }),
  );
  const rate30 = habitRate(active, data.checks, addDays(today, -29), today);
  const open = () => openSheet({ title: 'Neuer Habit', render: (close) => <HabitSheet close={close} today={today} /> });

  return (
    <div className="screen">
      <ScreenHeader eyebrow="Gewohnheiten" />
      <div className="row row--between">
        <h1 className="screen-title">Habits</h1>
        <Button variant="primary" size="s" icon={Plus} onClick={open}>
          Habit
        </Button>
      </div>

      <Card label={`${WEEKS} Wochen`} icon={Repeat} ariaLabel="Habit-Heatmap" testId="habit-heatmap">
        <Heatmap weeks={weeks} label="Erfüllung pro Tag, dunkel = nichts, hell = alles erledigt" />
        <div className="row row--between xsmall faint" style={{ marginTop: 'var(--space-3)' }}>
          <span>30 Tage: {rate30 === null ? '–' : `${Math.round(rate30 * 100)} %`} erledigt</span>
          <span className="heat-legend" aria-hidden>
            weniger <i className="heatmap__cell" /> <i className="heatmap__cell l1" /> <i className="heatmap__cell l2" /> <i className="heatmap__cell l3" /> <i className="heatmap__cell l4" /> mehr
          </span>
        </div>
      </Card>

      <SectionTitle>Heute & Streaks</SectionTitle>
      {active.length === 0 ? (
        <Card ariaLabel="Keine Habits">
          <EmptyState icon={Repeat} title="Noch keine Habits" action={<Button variant="secondary" size="s" onClick={open}>Ersten Habit anlegen</Button>}>
            Zum Beispiel Dehnen, 10 Seiten lesen oder Vokabeln.
          </EmptyState>
        </Card>
      ) : (
        <Card ariaLabel="Habit-Liste" testId="habit-streaks">
          <div className="list">
            {active.map((h) => {
              const checked = new Set(data.checks.filter((c) => c.habitId === h.id).map((c) => c.date));
              const st = habitStreak(h, checked, today);
              const scheduled = isScheduled(h, today);
              return (
                <div key={h.id} className="list-item">
                  {scheduled ? (
                    <FrostCheck checked={checked.has(today)} label={h.name} onChange={() => void toggleHabit(h.id, today)} />
                  ) : (
                    <span className="frost-check" aria-hidden>
                      <span className="frost-check__box" style={{ opacity: 0.35 }} />
                    </span>
                  )}
                  <button
                    type="button"
                    className="grow"
                    style={{ textAlign: 'left', minHeight: 44, minWidth: 0 }}
                    onClick={() => openSheet({ title: 'Habit bearbeiten', render: (close) => <HabitSheet close={close} today={today} habit={h} /> })}
                  >
                    <span className="list-item__title truncate" style={{ display: 'block' }}>
                      {h.name}
                    </span>
                    <span className="list-item__meta">
                      {scheduleLabel(h)}
                      {!scheduled && ' · heute frei'} · Rekord {st.longest}
                    </span>
                  </button>
                  <span className="streak" aria-label={`Aktueller Streak ${st.current}`}>
                    <Flame size={16} strokeWidth={1.5} aria-hidden className={st.current > 0 ? 'accent' : 'faint'} />
                    <span className="num">{st.current}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {data.habits.some((h) => h.archived) && (
        <>
          <SectionTitle>Archiviert</SectionTitle>
          <Card ariaLabel="Archivierte Habits">
            <div className="list">
              {data.habits
                .filter((h) => h.archived)
                .map((h) => (
                  <button key={h.id} type="button" className="list-item muted" onClick={() => openSheet({ title: 'Habit bearbeiten', render: (close) => <HabitSheet close={close} today={today} habit={h} /> })}>
                    {h.name}
                  </button>
                ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function scheduleLabel(h: Habit): string {
  if (h.schedule.kind === 'daily') return 'täglich';
  const d = [...h.schedule.days].sort();
  if (d.join() === '1,2,3,4,5') return 'Mo–Fr';
  return d.map((x) => WD[x - 1]).join(', ');
}

function HabitSheet({ close, today, habit }: { close: () => void; today: ISODate; habit?: Habit }) {
  const { toast } = useOverlay();
  const [name, setName] = useState(habit?.name ?? '');
  const [kind, setKind] = useState<'daily' | 'weekdays'>(habit?.schedule.kind ?? 'daily');
  const [days, setDays] = useState<number[]>(habit?.schedule.kind === 'weekdays' ? habit.schedule.days : [1, 2, 3, 4, 5]);
  const [error, setError] = useState<string>();

  async function submit(archived = habit?.archived ?? false) {
    try {
      await saveHabit({
        ...(habit ? { id: habit.id, createdAt: habit.createdAt, order: habit.order } : {}),
        name,
        schedule: kind === 'daily' ? { kind } : { kind, days: [...days].sort() },
        archived,
        startDate: habit?.startDate ?? today,
      });
      toast(archived ? 'Habit archiviert' : 'Habit gespeichert');
      close();
    } catch (e) {
      setError(e instanceof ValidationError ? (kind === 'weekdays' && days.length === 0 ? 'Mindestens einen Wochentag wählen' : e.message) : 'Speichern fehlgeschlagen');
    }
  }

  return (
    <div className="form">
      <TextField label="Name" value={name} onValue={setName} maxLength={60} placeholder="z. B. Dehnen 10 min" autoFocus={!habit} />
      <Segmented<'daily' | 'weekdays'>
        label="Rhythmus"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'daily', label: 'Täglich' },
          { value: 'weekdays', label: 'Bestimmte Tage' },
        ]}
      />
      {kind === 'weekdays' && (
        <div className="chips" role="group" aria-label="Wochentage">
          {WD.map((label, i) => (
            <button key={label} type="button" className="chip" aria-pressed={days.includes(i + 1)} onClick={() => setDays(days.includes(i + 1) ? days.filter((d) => d !== i + 1) : [...days, i + 1])}>
              {label}
            </button>
          ))}
        </div>
      )}
      {error && <p className="field__error">{error}</p>}
      <Button variant="primary" block disabled={!name.trim()} onClick={() => void submit()}>
        Speichern
      </Button>
      {habit && (
        <>
          <Button variant="secondary" block onClick={() => void submit(!habit.archived)}>
            {habit.archived ? 'Wieder aktivieren' : 'Archivieren'}
          </Button>
          <Button
            variant="warn"
            block
            icon={Trash2}
            onClick={() => {
              if (window.confirm(`„${habit.name}“ samt Verlauf löschen?`)) void deleteHabit(habit.id).then(close);
            }}
          >
            Löschen
          </Button>
        </>
      )}
    </div>
  );
}

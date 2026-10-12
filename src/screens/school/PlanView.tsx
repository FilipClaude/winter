import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, CalendarRange, Clock, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteLesson, deleteStudyBlock, saveLesson, saveSettings, toggleStudyBlock, ValidationError } from '../../db/repo';
import type { Lesson, Settings, Subject } from '../../db/schemas';
import { useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import {
  nextBreak,
  publicHolidaysBY,
  SCHOOL_BREAKS,
  SCHOOL_BREAKS_SOURCE,
  schoolFreeReason,
  weekType,
} from '../../lib/calc/calendar-by';
import { addDays, formatDE, formatMinutes, formatWeekdayShort, isoWeekday, relativeDayName, startOfWeek, type ISODate } from '../../lib/date';
import { FrostCheck, NumberField, Segmented, SelectField, TextField } from '../../ui/controls';
import { ScreenSkeleton } from '../../ui/kit';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Button, Card, EmptyState, IconButton } from '../../ui/primitives';

const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr'] as const;

export function PlanView() {
  const today = useToday();
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const [blocks, lessons, subjects] = await Promise.all([
      // Alle offenen Einheiten aus der Vergangenheit (überfällig) plus die nächsten drei Wochen.
      db.studyBlocks
        .where('date')
        .belowOrEqual(addDays(today, 21))
        .filter((b) => b.date >= today || !b.done)
        .toArray(),
      db.lessons.toArray(),
      db.subjects.orderBy('order').toArray(),
    ]);
    return { blocks, lessons, subjects };
  }, [today]);
  if (!data) return <ScreenSkeleton cards={3} />;
  const names = new Map(data.subjects.map((s) => [s.id, s.name]));
  return (
    <div className="stack" data-testid="plan-view">
      <StudyPlanCard blocks={data.blocks} names={names} today={today} />
      <TimetableCard lessons={data.lessons} subjects={data.subjects} settings={settings} today={today} />
      <BreaksCard today={today} />
    </div>
  );
}

function StudyPlanCard({
  blocks,
  names,
  today,
}: {
  blocks: { id: string; date: ISODate; subjectId: string; topic: string; kind: string; minutes: number; done: boolean }[];
  names: Map<string, string>;
  today: ISODate;
}) {
  const upcoming = blocks
    .filter((b) => b.date >= today || (b.date < today && !b.done))
    .sort((a, b) => a.date.localeCompare(b.date) || Number(a.done) - Number(b.done));
  const days = [...new Set(upcoming.map((b) => b.date))];
  return (
    <Card label="Lernplan" icon={CalendarClockIcon} ariaLabel="Lernplan" testId="study-plan">
      {upcoming.length === 0 ? (
        <EmptyState icon={CalendarRange} title="Kein Lernplan">
          In einer Klausur Themen eintragen und „Lernplan erstellen“ tippen. Wiederholungen nach 1, 3 und 7 Tagen werden automatisch geplant.
        </EmptyState>
      ) : (
        <div className="stack">
          {days.map((d) => (
            <div key={d} className="stack stack--s">
              <span className="label">
                {relativeDayName(d, today) ?? `${formatWeekdayShort(d)}, ${formatDE(d)}`}
                {d < today && ' · überfällig'}
              </span>
              <div className="list">
                {upcoming
                  .filter((b) => b.date === d)
                  .map((b) => (
                    <div key={b.id} className="list-item" data-testid="study-block">
                      <FrostCheck checked={b.done} label={`${b.topic} erledigt`} onChange={() => void toggleStudyBlock(b.id)} />
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span className={`list-item__title ${b.done ? 'muted' : ''}`}>{b.topic}</span>
                        <br />
                        <span className="list-item__meta">
                          {names.get(b.subjectId) ?? 'Fach'} · {b.kind === 'lernen' ? 'Lernen' : 'Wiederholen'} · {formatMinutes(b.minutes)}
                        </span>
                      </span>
                      <IconButton icon={Trash2} label={`${b.topic} entfernen`} onClick={() => void deleteStudyBlock(b.id)} />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const CalendarClockIcon = Clock;

function TimetableCard({
  lessons,
  subjects,
  settings,
  today,
}: {
  lessons: Lesson[];
  subjects: Subject[];
  settings: Settings;
  today: ISODate;
}) {
  const { openSheet } = useOverlay();
  const todayWd = isoWeekday(today);
  const [day, setDay] = useState<number>(todayWd <= 5 ? todayWd : 1);
  const tt = settings.timetable;
  // Für Wochenenden die kommende Woche zeigen
  const refDate = todayWd <= 5 ? today : addDays(startOfWeek(today), 7);
  const wt = weekType(refDate, tt.weekARef);
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  const visible = lessons
    .filter((l) => l.weekday === day && (!tt.abWeeks || l.week === 'AB' || l.week === wt))
    .sort((a, b) => a.period - b.period);
  const dateOfDay = addDays(startOfWeek(refDate), day - 1);
  const free = schoolFreeReason(dateOfDay);
  return (
    <Card
      label={tt.abWeeks ? `Stundenplan · ${wt}-Woche` : 'Stundenplan'}
      icon={CalendarDays}
      ariaLabel="Stundenplan"
      testId="timetable"
      action={
        <IconButton
          icon={Plus}
          label="Stunde eintragen"
          variant="accent"
          onClick={() =>
            openSheet({ title: 'Stunde', render: (close) => <LessonSheet subjects={subjects} weekday={day} abWeeks={tt.abWeeks} close={close} /> })
          }
        />
      }
    >
      <div className="stack">
        <Segmented label="Wochentag" value={String(day)} onChange={(v) => setDay(Number(v))} options={WD.map((w, i) => ({ value: String(i + 1), label: w }))} />
        {free && <Badge tone="muted">{formatDE(dateOfDay)}: {free}</Badge>}
        {visible.length === 0 ? (
          <p className="small faint">Für {WD[day - 1]} noch keine Stunden eingetragen.</p>
        ) : (
          <div className="list">
            {visible.map((l) => (
              <button
                key={l.id}
                type="button"
                className="list-item list-row list-row--button"
                data-testid="lesson-row"
                onClick={() =>
                  openSheet({
                    title: 'Stunde',
                    render: (close) => <LessonSheet subjects={subjects} weekday={day} abWeeks={tt.abWeeks} lesson={l} close={close} />,
                  })
                }
              >
                <span className="num" style={{ width: 28, color: 'var(--color-text-3)' }}>
                  {l.period}.
                </span>
                <span className="grow list-row__text">
                  <span className="list-item__title">{names.get(l.subjectId) ?? 'Fach'}</span>
                  {(l.room || l.week !== 'AB') && (
                    <span className="list-item__meta">
                      {l.room}
                      {l.room && l.week !== 'AB' ? ' · ' : ''}
                      {l.week !== 'AB' ? `nur ${l.week}-Woche` : ''}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        <label className="toggle-row">
          <span className="grow">
            <span className="list-item__title">A/B-Wochen</span>
            <span className="list-item__meta" style={{ display: 'block' }}>
              Stunden können dann nur in A- oder B-Wochen stattfinden.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={tt.abWeeks}
            onChange={(e) => void saveSettings({ timetable: { ...tt, abWeeks: e.target.checked } })}
          />
        </label>
        {tt.abWeeks && (
          <Button
            variant="ghost"
            size="s"
            onClick={() =>
              void saveSettings({
                timetable: { ...tt, weekARef: wt === 'A' ? addDays(startOfWeek(refDate), 7) : startOfWeek(refDate) },
              })
            }
          >
            A und B tauschen (diese Woche ist {wt === 'A' ? 'B' : 'A'})
          </Button>
        )}
      </div>
    </Card>
  );
}

function LessonSheet({
  subjects,
  weekday,
  abWeeks,
  lesson,
  close,
}: {
  subjects: Subject[];
  weekday: number;
  abWeeks: boolean;
  lesson?: Lesson;
  close: () => void;
}) {
  const { toast } = useOverlay();
  const active = subjects.filter((s) => !s.archived && s.name !== 'FernUni');
  const [f, setF] = useState({
    weekday: lesson?.weekday ?? weekday,
    period: (lesson?.period ?? 1) as number | '',
    subjectId: lesson?.subjectId ?? active[0]?.id ?? '',
    room: lesson?.room ?? '',
    week: lesson?.week ?? ('AB' as Lesson['week']),
  });
  const [error, setError] = useState('');
  return (
    <div className="form">
      <Segmented label="Tag" value={String(f.weekday)} onChange={(v) => setF({ ...f, weekday: Number(v) })} options={WD.map((w, i) => ({ value: String(i + 1), label: w }))} />
      <div className="form-row">
        <NumberField label="Stunde" value={f.period} min={1} max={12} onValue={(period) => setF({ ...f, period })} />
        <TextField label="Raum" value={f.room} maxLength={20} onValue={(room) => setF({ ...f, room })} />
      </div>
      <SelectField label="Fach" value={f.subjectId} options={active.map((s) => ({ value: s.id, label: s.name }))} onValue={(subjectId) => setF({ ...f, subjectId })} />
      {abWeeks && (
        <Segmented<Lesson['week']>
          label="Woche"
          value={f.week}
          onChange={(week) => setF({ ...f, week })}
          options={[
            { value: 'AB', label: 'jede' },
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
          ]}
        />
      )}
      {error && <p className="small warn">{error}</p>}
      <Button
        variant="primary"
        block
        onClick={() =>
          void saveLesson({
            ...(lesson ? { id: lesson.id, createdAt: lesson.createdAt } : {}),
            weekday: f.weekday,
            period: f.period === '' ? 0 : f.period,
            subjectId: f.subjectId,
            room: f.room.trim(),
            week: abWeeks ? f.week : 'AB',
          })
            .then(() => {
              toast('Stunde gespeichert');
              close();
            })
            .catch((e: unknown) => setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen'))
        }
      >
        Speichern
      </Button>
      {lesson && (
        <Button variant="ghost" block icon={Trash2} onClick={() => void deleteLesson(lesson.id).then(close)}>
          Löschen
        </Button>
      )}
    </div>
  );
}

function BreaksCard({ today }: { today: ISODate }) {
  const next = nextBreak(today);
  const upcomingBreaks = SCHOOL_BREAKS.filter((b) => b.to >= today).slice(0, 8);
  const holidays = [...publicHolidaysBY(Number(today.slice(0, 4))), ...publicHolidaysBY(Number(today.slice(0, 4)) + 1)]
    .filter((h) => h.date >= today && Number(h.date.slice(5, 7)) >= 1)
    .slice(0, 4);
  return (
    <Card label="Ferien & Feiertage" icon={CalendarRange} ariaLabel="Ferien und Feiertage" testId="breaks">
      {next ? (
        <p className="small" style={{ marginBottom: 'var(--space-3)' }}>
          {next.inDays === 0 ? (
            <>
              Gerade: <b>{next.name}</b> bis {formatDE(next.to)}
            </>
          ) : (
            <>
              Nächste Ferien: <b>{next.name}</b> in <b className="accent num">{next.inDays}</b> Tagen
            </>
          )}
        </p>
      ) : (
        <p className="small faint">Keine weiteren Ferien hinterlegt (Ferienordnung reicht bis Sommer 2030).</p>
      )}
      <div className="list">
        {upcomingBreaks.map((b) => (
          <div key={b.name} className="list-item">
            <span className="grow">{b.name}</span>
            <span className="mono small muted">
              {b.from === b.to ? formatDE(b.from) : `${formatDE(b.from).slice(0, 6)}–${formatDE(b.to)}`}
            </span>
          </div>
        ))}
      </div>
      {holidays.length > 0 && (
        <p className="xsmall faint" style={{ marginTop: 'var(--space-3)' }}>
          Nächste Feiertage: {holidays.map((h) => `${h.name} ${formatDE(h.date).slice(0, 6)}`).join(' · ')}
        </p>
      )}
      <p className="xsmall faint" style={{ marginTop: 'var(--space-2)' }}>
        Quelle: {SCHOOL_BREAKS_SOURCE}
      </p>
    </Card>
  );
}

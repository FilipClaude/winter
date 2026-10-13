import { useLiveQuery } from 'dexie-react-hooks';
import { AlarmClock, ChevronDown, GraduationCap, ListTodo, Plus, Square, Timer } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { cancelTimer, stopTimer, toggleTodo } from '../../db/repo';
import { useNow, useToday } from '../../hooks/useNow';
import { formatExamDay, upcomingExams } from '../../lib/calc/exams';
import { formatDecimal } from '../../lib/calc/insights';
import {
  countdownLabel,
  pointsAverage,
  pointsToDecimalGrade,
  pointsToGrade,
  pomodoroState,
  studyBySubject,
  studyMinutesInRange,
} from '../../lib/calc/school';
import { addDays, dateRange, diffDays, formatDE, formatHM, formatMinutes, formatShort, startOfWeek } from '../../lib/date';
import { BarChart } from '../../ui/charts';
import { FrostCheck } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Banner, Button, Card, EmptyState, IconButton, ProgressBar, ScreenHeader, SectionTitle, Stat } from '../../ui/primitives';
import { EXAM_KIND_LABEL, formatClock, useTimer } from './school-utils';
import { AbiView } from './AbiView';
import { GradesView } from './GradesView';
import { PlanView } from './PlanView';
import { NextExamCard } from './NextExamCard';
import { ExamSheet, StudySheet, TodoSheet } from './SchoolSheets';
import { isUniSubject, withoutUni } from '../../lib/calc/subjects';

type Tab = 'aufgaben' | 'klausuren' | 'noten' | 'abi' | 'plan' | 'lernzeit';

const TABS: { value: Tab; label: string }[] = [
  { value: 'aufgaben', label: 'Aufgaben' },
  { value: 'klausuren', label: 'Klausuren' },
  { value: 'noten', label: 'Noten' },
  { value: 'abi', label: 'Abi' },
  { value: 'plan', label: 'Plan' },
  { value: 'lernzeit', label: 'Lernzeit' },
];

export default function SchoolScreen({ tab: initial }: { tab?: string | undefined }) {
  const today = useToday();
  const [tab, setTab] = useState<Tab>(TABS.find((t) => t.value === initial)?.value ?? 'aufgaben');
  return (
    <div className="screen">
      <ScreenHeader eyebrow="Q12" />
      <h1 className="screen-title">Schule</h1>
      <NextExamCard today={today} hero />
      <TimerCard />
      <div className="chips chips--scroll school-tabs" role="group" aria-label="Bereich">
        {TABS.map((t) => (
          <button key={t.value} type="button" className="chip" aria-pressed={tab === t.value} onClick={() => setTab(t.value)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'aufgaben' && <Todos />}
      {tab === 'klausuren' && <Exams />}
      {tab === 'noten' && <GradesView />}
      {tab === 'abi' && <AbiView />}
      {tab === 'plan' && <PlanView />}
      {tab === 'lernzeit' && <StudyStats />}
    </div>
  );
}

function useSubjectNames() {
  // Uni-Fächer (v3 ausgeblendet) bekommen keinen Namen – z. B. ein noch laufender alter Timer zeigt dann „Fach“.
  return (
    useLiveQuery(async () => new Map((await db.subjects.toArray()).filter((s) => !isUniSubject(s)).map((s) => [s.id, s.name])), []) ??
    new Map<string, string>()
  );
}

// ---------- Timer ----------

function TimerCard() {
  const timer = useTimer();
  const names = useSubjectNames();
  const now = useNow(1000);
  const today = useToday();
  const { openSheet, toast } = useOverlay();
  const todayMin =
    useLiveQuery(async () => withoutUni(await db.studySessions.where('date').equals(today).toArray(), await db.subjects.toArray()), [today])?.reduce((a, s) => a + s.minutes, 0) ?? 0;

  if (timer) {
    const name = names.get(timer.subjectId) ?? 'Fach';
    const secs = (now.getTime() - new Date(timer.startedAt).getTime()) / 1000;
    const pomo = timer.pomodoro ? pomodoroState(secs, timer.pomodoro.workMin, timer.pomodoro.breakMin) : null;
    return (
      <Card
        label={pomo ? `${pomo.phase === 'fokus' ? `Fokus ${pomo.round}` : 'Pause'} · ${name}` : `Lernen · ${name}`}
        icon={Timer}
        ariaLabel="Lern-Timer läuft"
        testId="timer-card"
        className={`timer-card ${pomo?.phase === 'pause' ? 'timer-card--pause' : ''}`}
      >
        <div className="row row--between">
          <span className="big num timer-card__time" data-testid="timer-clock">
            {pomo ? formatClock(pomo.remainingSec) : formatClock(secs)}
          </span>
          <IconButton
            icon={Square}
            label="Timer stoppen"
            variant="outline"
            onClick={() => void stopTimer().then((m) => toast(`${formatMinutes(m)} ${name} gespeichert`))}
          />
        </div>
        {secs > 6 * 3600 ? (
          <Banner
            icon={AlarmClock}
            tone="warn"
            testId="timer-forgotten"
            action={
              <Button variant="ghost" size="s" onClick={() => void cancelTimer().then(() => toast('Timer verworfen', { tone: 'warn' }))}>
                Verwerfen
              </Button>
            }
          >
            Läuft seit über {Math.floor(secs / 3600)} h – vergessen? Verwerfen und die Zeit über „Lernzeit“ nachtragen.
          </Banner>
        ) : pomo ? (
          <p className="xsmall faint" data-testid="pomodoro-info">
            {pomo.phase === 'fokus' ? 'Fokus' : 'Pause'} – noch {formatClock(pomo.remainingSec)}. Gebucht wird nur die Fokuszeit ({formatMinutes(pomo.focusSec / 60)}).
          </p>
        ) : (
          <p className="xsmall faint">Läuft weiter, auch wenn die App geschlossen wird.</p>
        )}
      </Card>
    );
  }
  return (
    <Card label="Lernzeit heute" icon={Timer} ariaLabel="Lernzeit" testId="timer-card">
      <div className="row row--between">
        <span className="big big--m num">
          {formatHM(todayMin)}
          <span className="unit">h</span>
        </span>
        <Button variant="primary" icon={Timer} onClick={() => openSheet({ title: 'Lernzeit', render: (close) => <StudySheet close={close} /> })}>
          Lernen starten
        </Button>
      </div>
    </Card>
  );
}

// ---------- Aufgaben ----------

function Todos() {
  const today = useToday();
  const names = useSubjectNames();
  const { openSheet } = useOverlay();
  const todos = useLiveQuery(() => db.todos.toArray(), []);
  if (!todos) return null;
  const prio = { hoch: 0, normal: 1, niedrig: 2 } as const;
  // Überfällige und heute fällige zuerst, dann Priorität, dann Fälligkeit.
  const urgent = (t: (typeof todos)[number]) => (t.due !== undefined && t.due <= today ? 0 : 1);
  const open = todos
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        urgent(a) - urgent(b) ||
        prio[a.priority ?? 'normal'] - prio[b.priority ?? 'normal'] ||
        (a.due ?? '9999').localeCompare(b.due ?? '9999') ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const done = todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 5);
  return (
    <>
      <SectionTitle action={<Button variant="ghost" size="s" icon={Plus} onClick={() => openSheet({ title: 'Aufgabe', render: (close) => <TodoSheet close={close} /> })}>Aufgabe</Button>}>
        Offen · {open.length}
      </SectionTitle>
      <Card ariaLabel="Offene Aufgaben" testId="todo-list">
        {open.length === 0 ? (
          <EmptyState icon={ListTodo} title={todos.length === 0 ? 'Noch keine Aufgaben' : 'Alles erledigt'}>
            {todos.length === 0
              ? 'Hausaufgaben mit Fälligkeit, Priorität und auf Wunsch wöchentlicher Wiederholung – über „Aufgabe“ oder das Plus.'
              : 'Neue Hausaufgaben über das Plus oder die Schnellerfassung.'}
          </EmptyState>
        ) : (
          <div className="list">
            {open.map((t) => {
              const overdue = t.due !== undefined && t.due < today;
              return (
                <div key={t.id} className="list-item">
                  <FrostCheck checked={false} label={`${t.title} erledigt`} onChange={() => void toggleTodo(t.id)} />
                  <button type="button" className="grow" style={{ textAlign: 'left', minHeight: 44 }} onClick={() => openSheet({ title: 'Aufgabe', render: (close) => <TodoSheet close={close} todo={t} /> })}>
                    <span className="list-item__title">{t.title}</span>
                    {t.priority === 'hoch' && <Badge tone="warn">hoch</Badge>}
                    {t.repeat && t.repeat !== 'none' && <Badge tone="muted">{t.repeat === 'weekly' ? 'wöchentlich' : '2-wöchentlich'}</Badge>}
                    <br />
                    <span className={`list-item__meta ${overdue ? 'warn' : ''}`}>
                      {[t.subjectId && names.get(t.subjectId), t.due && (t.due === today ? 'heute fällig' : overdue ? `überfällig seit ${formatShort(t.due)}` : `fällig ${countdownLabel(t.due, today)}`)].filter(Boolean).join(' · ') || 'ohne Frist'}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      {done.length > 0 && (
        <>
          <SectionTitle>Zuletzt erledigt</SectionTitle>
          <Card ariaLabel="Erledigte Aufgaben">
            <div className="list">
              {done.map((t) => (
                <div key={t.id} className="list-item">
                  <FrostCheck checked label={`${t.title} wieder öffnen`} onChange={() => void toggleTodo(t.id)} />
                  <span className="grow muted" style={{ textDecoration: 'line-through' }}>
                    {t.title}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

// ---------- Klausuren ----------

function Exams() {
  const today = useToday();
  const { openSheet } = useOverlay();
  const data = useLiveQuery(async () => ({ exams: await db.exams.toArray(), subjects: await db.subjects.orderBy('order').toArray(), grades: await db.grades.toArray() }), []);
  if (!data) return null;
  const names = new Map(data.subjects.map((s) => [s.id, s.name]));
  const upcoming = upcomingExams(data.exams, today);
  const past = data.exams.filter((e) => !upcoming.includes(e)).sort((a, b) => b.date.localeCompare(a.date));
  const gradeOf = new Map(data.grades.filter((g) => g.examId).map((g) => [g.examId, g.points]));
  const graded = data.exams.filter((e) => e.points !== undefined);
  const overall = pointsAverage(graded.map((e) => e.points ?? 0));
  const bySubject = data.subjects
    .map((s) => ({ s, points: graded.filter((e) => e.subjectId === s.id).map((e) => e.points ?? 0) }))
    .filter((x) => x.points.length > 0);

  return (
    <>
      <SectionTitle action={<Button variant="ghost" size="s" icon={Plus} onClick={() => openSheet({ title: 'Klausur', render: (close) => <ExamSheet close={close} /> })}>Klausur</Button>}>
        Klausurenplan
      </SectionTitle>
      <Card ariaLabel="Anstehende Klausuren" testId="exam-list">
        {upcoming.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Keine Klausuren geplant">
            Klausuren, Kurzarbeiten, Exen und Referate mit Datum und Themen eintragen.
          </EmptyState>
        ) : (
          <div className="list">
            {upcoming.map((e) => {
              const days = diffDays(today, e.date);
              return (
                <button key={e.id} type="button" className="list-item" onClick={() => openSheet({ title: 'Klausur', render: (close) => <ExamSheet close={close} exam={e} /> })}>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="list-item__title">
                      {names.get(e.subjectId) ?? 'Fach'} <span className="faint small">· {EXAM_KIND_LABEL[e.kind]}</span>
                    </span>
                    <span className="list-item__meta truncate" style={{ display: 'block', margin: '2px 0 6px' }}>
                      {formatExamDay(e.date)} {e.topics && `· ${e.topics}`}
                    </span>
                    <ProgressBar value={e.progress / 100} label="Lernstand" warn={days <= 3 && e.progress < 60} />
                  </span>
                  <span style={{ textAlign: 'right', flex: 'none', minWidth: 52 }}>
                    <span className={`big big--s num ${days <= 2 ? 'warn' : ''}`}>{days}</span>
                    <br />
                    <span className="xsmall faint">{days === 1 ? 'Tag' : 'Tage'}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {past.length > 0 && (
        <details className="past-exams" data-testid="past-exams">
          <summary>
            <span>Vergangen · {past.length}</span>
            <ChevronDown size={18} strokeWidth={1.5} aria-hidden />
          </summary>
          <Card ariaLabel="Vergangene Klausuren">
            <div className="list">
              {past.map((e) => (
                <button key={e.id} type="button" className="list-item" onClick={() => openSheet({ title: 'Klausur', render: (close) => <ExamSheet close={close} exam={e} /> })}>
                  <span className="grow">
                    {names.get(e.subjectId) ?? 'Fach'} <span className="faint small">· {EXAM_KIND_LABEL[e.kind]}</span>
                    <br />
                    <span className="list-item__meta">{formatDE(e.date)}</span>
                  </span>
                  {(e.points ?? gradeOf.get(e.id)) !== undefined ? (
                    <span style={{ textAlign: 'right' }}>
                      <span className="num">
                        {e.points ?? gradeOf.get(e.id)}
                        <span className="unit">P</span>
                      </span>
                      <br />
                      <span className="xsmall faint">Note {pointsToGrade(e.points ?? gradeOf.get(e.id) ?? 0)}</span>
                    </span>
                  ) : (
                    <Badge tone="muted">Punkte offen</Badge>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </details>
      )}

      <SectionTitle>Notenschnitt</SectionTitle>
      <Card ariaLabel="Notenschnitt" testId="grades-card">
        {bySubject.length === 0 ? (
          <p className="small faint">Noch keine bewerteten Klausuren. Punkte nach der Rückgabe in der Klausur eintragen.</p>
        ) : (
          <>
            <div className="row row--between" style={{ marginBottom: 'var(--space-3)' }}>
              <Stat value={formatDecimal(overall, 1)} unit="P" label="Gesamt-Ø Punkte" />
              <Stat value={overall === null ? '–' : formatDecimal(pointsToDecimalGrade(overall), 1)} label="entspricht Note" />
            </div>
            <div className="list">
              {bySubject.map(({ s, points }) => {
                const avg = pointsAverage(points);
                return (
                  <div key={s.id} className="list-item">
                    <span className="grow">
                      {s.name}
                      {s.major && <span className="faint xsmall"> · LF</span>}
                      <br />
                      <span className="list-item__meta">{points.join(' · ')} P</span>
                    </span>
                    <span style={{ textAlign: 'right' }}>
                      <span className="num">{formatDecimal(avg, 1)}</span>
                      <span className="unit">P</span>
                      <br />
                      <span className="xsmall faint">Note {avg === null ? '–' : pointsToGrade(avg)}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

    </>
  );
}

// ---------- Lernzeit ----------

function StudyStats() {
  const today = useToday();
  const monday = startOfWeek(today);
  const from = addDays(today, -27);
  const data = useLiveQuery(async () => {
    const subjects = await db.subjects.orderBy('order').toArray();
    return { sessions: withoutUni(await db.studySessions.where('date').between(from, today, true, true).toArray(), subjects), subjects };
  }, [from, today]);
  if (!data) return null;
  const week = data.sessions.filter((s) => s.date >= monday);
  const weekMin = studyMinutesInRange(data.sessions, monday, today);
  const days = dateRange(addDays(today, -13), today);
  const by = studyBySubject(week);
  const maxSubject = Math.max(1, ...by.values());

  return (
    <>
      <Card label="Lernzeit" icon={Timer} ariaLabel="Lernzeit-Statistik" testId="study-stats">
        <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
          <Stat value={formatHM(weekMin)} unit="h" label="diese Woche" />
          <Stat value={formatHM(studyMinutesInRange(data.sessions, from, today) / 4)} unit="h" label="Ø pro Woche (4 Wo.)" />
        </div>
        <BarChart
          label="Lernzeit pro Tag, 14 Tage"
          data={days.map((d) => ({ label: d.slice(8), value: data.sessions.filter((s) => s.date === d).reduce((a, s) => a + s.minutes, 0) / 60, highlight: d === today }))}
          format={(n) => `${formatDecimal(n, 1)} h`}
        />
      </Card>
      <SectionTitle>Diese Woche nach Fach</SectionTitle>
      <Card ariaLabel="Lernzeit nach Fach">
        {by.size === 0 ? (
          <p className="small faint">Diese Woche noch keine Lernzeit erfasst.</p>
        ) : (
          <div className="stack">
            {data.subjects
              .filter((s) => by.has(s.id))
              .sort((a, b) => (by.get(b.id) ?? 0) - (by.get(a.id) ?? 0))
              .map((s) => (
                <div key={s.id} className="stack stack--s">
                  <div className="row row--between small">
                    <span>{s.name}</span>
                    <span className="mono faint">{formatMinutes(by.get(s.id) ?? 0)}</span>
                  </div>
                  <ProgressBar value={(by.get(s.id) ?? 0) / maxSubject} label={s.name} />
                </div>
              ))}
          </div>
        )}
      </Card>
    </>
  );
}

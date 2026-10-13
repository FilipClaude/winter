import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDown, ArrowUp, BookOpenCheck, GraduationCap, GripVertical, Plus, Shield, Sparkles, Target, Trash2 } from 'lucide-react';
import { Reorder, useDragControls } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { db } from '../../db/db';
import { deleteGoal, getSettings, saveGoal, saveSettings, toggleStudyBlock, ValidationError } from '../../db/repo';
import { GOAL_METRICS, type DashboardWidget, type Goal, type GoalMetric } from '../../db/schemas';
import { useBfv } from '../../hooks/useBfv';
import { useNow } from '../../hooks/useNow';
import { useSettings } from '../../hooks/useSettings';
import { formatKickoff, nextMatch } from '../../lib/bfv/matches';
import { computeAbi, knownHalfYears } from '../../lib/calc/abi';
import { abiSubjects } from '../../lib/calc/abi-setup';
import { buildBriefing } from '../../lib/calc/briefing';
import { isScheduled } from '../../lib/calc/habits';
import { nextBreak, schoolFreeReason, weekType } from '../../lib/calc/calendar-by';
import { moveWidget, normalizeDashboard } from '../../lib/calc/dashboard-layout';
import { GOAL_LABEL, goalProgress, goalRange } from '../../lib/calc/goals';
import { formatDecimal } from '../../lib/calc/insights';
import { SESSION_LABEL } from '../../lib/calc/training';
import { addDays, diffDays, formatMinutes, isoWeekday, toISODate, type ISODate } from '../../lib/date';
import { navigate } from '../../router';
import { FrostCheck, NumberField, Segmented, SelectField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button, Card, IconButton, ProgressBar } from '../../ui/primitives';
import { EXAM_KIND_LABEL } from '../school/school-utils';
import { HAS_SMALL, WIDGET_LABEL } from './widget-meta';

// ---------- Tagesbriefing ----------

export function BriefingWidget({ today }: { today: ISODate }) {
  const settings = useSettings();
  const lines = useLiveQuery(async () => {
    const [deadlines, modules, exams, subjects, sessions, blocks, habits, checks] = await Promise.all([
      db.deadlines.where('date').belowOrEqual(addDays(today, 14)).toArray(),
      db.modules.toArray(),
      db.exams.where('date').between(today, addDays(today, 7), true, true).toArray(),
      db.subjects.toArray(),
      db.sessions.where('date').equals(today).toArray(),
      db.studyBlocks.where('date').equals(today).toArray(),
      db.habits.toArray(),
      db.habitChecks.where('date').equals(today).toArray(),
    ]);
    const mName = new Map(modules.map((m) => [m.id, m.name]));
    const sName = new Map(subjects.map((s) => [s.id, s.name]));
    const open = blocks.filter((b) => !b.done);
    const planned = (settings.weekPlan[String(isoWeekday(today))] ?? []).map((t) => SESSION_LABEL[t]);
    const active = habits.filter((h) => !h.archived);
    return buildBriefing({
      today,
      deadlines: deadlines.filter((d) => !d.done).map((d) => ({ title: d.title, module: mName.get(d.moduleId) ?? 'Modul', date: d.date })),
      exams: exams
        .filter((e) => e.points === undefined)
        .map((e) => ({ subject: sName.get(e.subjectId) ?? 'Fach', kind: EXAM_KIND_LABEL[e.kind], date: e.date, progress: e.progress })),
      training: { planned, done: sessions.length },
      studyBlocks: {
        open: open.length,
        minutes: open.reduce((a, b) => a + b.minutes, 0),
        subjects: open.map((b) => sName.get(b.subjectId) ?? 'Fach'),
      },
      schoolFree: schoolFreeReason(today),
      nextBreak: nextBreak(today),
      // nur heute geplante Habits zählen (Wochentage), Review-Fund
      habitsOpen: active.filter((h) => isScheduled(h, today) && !checks.some((c) => c.habitId === h.id)).length,
    });
  }, [today, settings.weekPlan]);
  // Platz schon beim Laden reservieren: Das Briefing steht ganz oben, sein spätes Erscheinen schob sonst
  // das ganze Dashboard um ~100 px nach unten (Lighthouse-Fund, CLS 0,29).
  if (!lines)
    return (
      <Card label="Briefing" icon={Sparkles} ariaLabel="Tagesbriefing">
        {/* genau eine Briefing-Zeile hoch – der häufigste Fall, so springt nichts */}
        <div className="stack stack--s" aria-busy="true">
          <p className="briefing__line skeleton__text">&nbsp;</p>
        </div>
      </Card>
    );
  return (
    <Card label="Briefing" icon={Sparkles} ariaLabel="Tagesbriefing" testId="briefing">
      <div className="stack stack--s">
        {lines.map((l) => (
          <p key={l} className="briefing__line">
            {l}
          </p>
        ))}
      </div>
    </Card>
  );
}

// ---------- Lernen heute (Lernplan + Stundenplan) ----------

export function StudyTodayWidget({ date }: { date: ISODate }) {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const [blocks, lessons, subjects] = await Promise.all([
      db.studyBlocks.where('date').equals(date).toArray(),
      db.lessons.where('weekday').equals(isoWeekday(date)).toArray(),
      db.subjects.toArray(),
    ]);
    return { blocks, lessons, names: new Map(subjects.map((s) => [s.id, s.name])) };
  }, [date]);
  if (!data) return null;
  const tt = settings.timetable;
  const wt = weekType(date, tt.weekARef);
  const free = schoolFreeReason(date);
  const lessons = free
    ? []
    : data.lessons
        .filter((l) => !tt.abWeeks || l.week === 'AB' || l.week === wt)
        .sort((a, b) => a.period - b.period);
  if (data.blocks.length === 0 && lessons.length === 0) return null;
  return (
    <Card label="Lernen heute" icon={BookOpenCheck} ariaLabel="Lernen heute" testId="study-today" action={<Button variant="ghost" size="s" onClick={() => navigate('schule', 'plan')}>Plan</Button>}>
      {lessons.length > 0 && (
        <p className="xsmall muted" style={{ marginBottom: 'var(--space-2)' }}>
          {tt.abWeeks ? `${wt}-Woche · ` : ''}
          {lessons.map((l) => `${l.period}. ${data.names.get(l.subjectId) ?? 'Fach'}`).join(' · ')}
        </p>
      )}
      {data.blocks.length > 0 && (
        <div className="list">
          {data.blocks.map((b) => (
            <div key={b.id} className="list-item">
              <FrostCheck checked={b.done} label={`${b.topic} erledigt`} onChange={() => void toggleStudyBlock(b.id)} />
              <span className="grow" style={{ minWidth: 0 }}>
                <span className={`list-item__title truncate ${b.done ? 'muted' : ''}`} style={{ display: 'block' }}>
                  {b.topic}
                </span>
                <span className="list-item__meta">
                  {data.names.get(b.subjectId) ?? 'Fach'} · {b.kind === 'lernen' ? 'Lernen' : 'Wiederholen'} · {formatMinutes(b.minutes)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------- Nächstes Spiel (BFV) ----------

export function NextMatchWidget({ today }: { today: ISODate }) {
  const bfv = useBfv();
  const now = useNow(60_000);
  const next = nextMatch(bfv, now);
  if (!bfv || !next) return null;
  const own = bfv.table.find((r) => r.own);
  const days = diffDays(today, toISODate(next.kickoff));
  return (
    <Card label="Nächstes Spiel" icon={Shield} ariaLabel="Nächstes Spiel" testId="next-match" onClick={() => navigate('training')}>
      <div className="list-item__title" style={{ lineHeight: 'var(--leading-snug)' }}>
        {next.home ? 'gegen' : 'bei'} {next.opponent}
      </div>
      <div className="xsmall muted mono" style={{ marginTop: 'var(--space-1)' }}>
        {formatKickoff(next.kickoff)}
      </div>
      <div className="xsmall faint" style={{ marginTop: 'var(--space-2)' }}>
        {days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`}
        {own ? ` · Platz ${own.position}` : ''}
      </div>
    </Card>
  );
}

// ---------- Abi-Schnitt ----------

export function AbiWidget() {
  const settings = useSettings();
  const r = useLiveQuery(async () => {
    const [subjects, grades, results] = await Promise.all([db.subjects.toArray(), db.grades.toArray(), db.semesterResults.toArray()]);
    if (grades.length === 0 && results.length === 0) return null;
    const abi = settings.abi;
    return computeAbi({
      subjects: abiSubjects(subjects, abi),
      known: knownHalfYears(grades, results, { big: abi.bigWeight, small: abi.smallWeight }),
      seminar: abi.seminar,
      examPoints: abi.examPoints,
    });
  }, [settings.abi]);
  if (r === undefined) return null;
  return (
    <Card label="Abi-Schnitt" icon={GraduationCap} ariaLabel="Abi-Schnitt" testId="abi-widget" onClick={() => navigate('schule', 'abi')}>
      {r === null ? (
        <p className="small faint">Noch keine Noten – im Abi-Rechner eintragen.</p>
      ) : (
        <>
          <div className="big big--m num">{r.grade === null ? '–' : formatDecimal(r.grade, 1)}</div>
          <div className="xsmall faint">
            {r.total} / 900 P{r.projectedShare > 0 ? ` · ${Math.round(r.projectedShare * 100)} % Prognose` : ''}
          </div>
        </>
      )}
    </Card>
  );
}

// ---------- Ziele ----------

export function GoalsWidget({ today }: { today: ISODate }) {
  const { openSheet } = useOverlay();
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const monthFrom = goalRange('month', today).from;
    const weekFrom = goalRange('week', today).from;
    const from = monthFrom < weekFrom ? monthFrom : weekFrom;
    const [goals, sessions, meals, days, sleep, health, study, exams, habits, checks, subjects, grades, results] = await Promise.all([
      db.goals.toArray(),
      db.sessions.where('date').between(from, today, true, true).toArray(),
      db.meals.where('date').between(from, today, true, true).toArray(),
      db.days.where('date').between(from, today, true, true).toArray(),
      db.sleep.where('date').between(from, today, true, true).toArray(),
      db.health.where('date').between(from, today, true, true).toArray(),
      db.studySessions.where('date').between(from, today, true, true).toArray(),
      db.exams.toArray(),
      db.habits.toArray(),
      db.habitChecks.where('date').between(from, today, true, true).toArray(),
      db.subjects.toArray(),
      db.grades.toArray(),
      db.semesterResults.toArray(),
    ]);
    const abi = settings.abi;
    const abiGrade =
      grades.length + results.length > 0
        ? computeAbi({
            subjects: abiSubjects(subjects, abi),
            known: knownHalfYears(grades, results, { big: abi.bigWeight, small: abi.smallWeight }),
            seminar: abi.seminar,
            examPoints: abi.examPoints,
          }).grade
        : null;
    const review = { sessions, meals, days, sleep, health, study, exams, habits, checks };
    return goals
      .filter((g) => !g.archived)
      .map((g) => ({ goal: g, p: goalProgress(g, review, today, abiGrade) }));
  }, [today, settings.abi]);
  if (!data) return null;
  const open = (goal?: Goal) => openSheet({ title: goal ? 'Ziel bearbeiten' : 'Neues Ziel', render: (close) => <GoalSheet goal={goal} close={close} /> });
  return (
    <Card label="Ziele" icon={Target} ariaLabel="Ziele" testId="goals-widget" action={<IconButton icon={Plus} label="Ziel anlegen" variant="accent" onClick={() => open()} />}>
      {data.length === 0 ? (
        <p className="small faint">Wochen- oder Monatsziele, z. B. „10 h Lernen“ oder „3× Gym“.</p>
      ) : (
        <div className="list">
          {data.map(({ goal, p }) => {
            const meta = GOAL_LABEL[goal.metric];
            const fmt = (n: number | null) => (n === null ? '–' : formatDecimal(n, goal.metric === 'abiAverage' || goal.metric === 'avgSleepH' || goal.metric === 'studyMin' ? 1 : 0));
            return (
              <button key={goal.id} type="button" className="list-item list-row list-row--button" onClick={() => open(goal)} data-testid="goal-row">
                <span className="grow list-row__text">
                  <span className="list-item__title">
                    {meta.label} {goal.period === 'week' ? 'diese Woche' : 'diesen Monat'}
                  </span>
                  <span className="list-item__meta mono">
                    {fmt(p.valueShown)} / {meta.lowerIsBetter ? '≤ ' : ''}
                    {fmt(p.targetShown)} {meta.unit} {p.reached ? '· erreicht' : ''}
                  </span>
                  <ProgressBar value={p.ratio} label={`${meta.label} Fortschritt`} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function GoalSheet({ goal, close }: { goal: Goal | undefined; close: () => void }) {
  const { toast } = useOverlay();
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'studyMin');
  const [period, setPeriod] = useState<Goal['period']>(goal?.period ?? 'week');
  // Lernzeit-Ziele werden in Stunden eingegeben und in Minuten gespeichert.
  const [target, setTarget] = useState<number | ''>(goal ? (goal.metric === 'studyMin' ? goal.target / 60 : goal.target) : 10);
  const [error, setError] = useState('');
  const meta = GOAL_LABEL[metric];
  return (
    <div className="form">
      <SelectField label="Kennzahl" value={metric} onValue={(v) => setMetric(v as GoalMetric)} options={GOAL_METRICS.map((m) => ({ value: m, label: GOAL_LABEL[m].label }))} />
      <Segmented<Goal['period']>
        label="Zeitraum"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'week', label: 'Woche' },
          { value: 'month', label: 'Monat' },
        ]}
      />
      <NumberField label={`Ziel${meta.unit ? ` (${meta.unit})` : ''}${meta.lowerIsBetter ? ' – höchstens' : ''}`} value={target} onValue={setTarget} min={0} max={100000} decimal />
      {error && <p className="small warn">{error}</p>}
      <Button
        variant="primary"
        block
        onClick={() => {
          const t = target === '' ? 0 : metric === 'studyMin' ? Math.round(target * 60) : target;
          void saveGoal({ ...(goal ? { id: goal.id, createdAt: goal.createdAt } : {}), metric, period, target: t, archived: false })
            .then(() => {
              toast('Ziel gespeichert');
              close();
            })
            .catch((e: unknown) => setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen'));
        }}
      >
        Speichern
      </Button>
      {goal && (
        <Button variant="ghost" block icon={Trash2} onClick={() => void deleteGoal(goal.id).then(close)}>
          Ziel löschen
        </Button>
      )}
    </div>
  );
}

// ---------- Dashboard anpassen ----------

/**
 * Die Reihenfolge lebt beim Bearbeiten im lokalen Zustand (synchron, wie Reorder es braucht) und wird
 * erst am Ende eines Zugs gespeichert – sonst springen Einträge beim Ziehen, und schnelle Taps auf die
 * Pfeile arbeiten mit einem veralteten Stand (Review-Fund).
 */
export function DashboardEditor() {
  const stored = useLiveQuery(() => getSettings(), []);
  const [list, setList] = useState<DashboardWidget[] | null>(null);
  const latest = useRef<DashboardWidget[]>([]);
  if (stored && list === null) setList(normalizeDashboard(stored.dashboard));
  // Ref spiegelt den Stand für Ereignisse (Pfeil-Taps, Ende des Ziehens) – nie während des Renderns schreiben.
  useEffect(() => {
    if (list) latest.current = list;
  }, [list]);
  if (!list) return null;
  const update = (next: DashboardWidget[], persist: boolean) => {
    latest.current = next;
    setList(next);
    if (persist) void saveSettings({ dashboard: next });
  };
  return (
    <div className="form" data-testid="dashboard-editor">
      <p className="small muted">Ziehen zum Sortieren (oder Pfeile), Größe und Sichtbarkeit je Widget. Kritische Fristen erscheinen immer ganz oben.</p>
      <Reorder.Group axis="y" values={list} onReorder={(next) => update(next, false)} className="dash-edit">
        {list.map((w, i) => (
          <EditorRow
            key={w.id}
            w={w}
            first={i === 0}
            last={i === list.length - 1}
            onChange={(next) => update(latest.current.map((x) => (x.id === w.id ? next : x)), true)}
            onMove={(d) => update(moveWidget(latest.current, w.id, d), true)}
            onDragEnd={() => void saveSettings({ dashboard: latest.current })}
          />
        ))}
      </Reorder.Group>
      <Button variant="ghost" block onClick={() => update(normalizeDashboard([]), true)}>
        Standard wiederherstellen
      </Button>
    </div>
  );
}

function EditorRow({
  w,
  first,
  last,
  onChange,
  onMove,
  onDragEnd,
}: {
  w: DashboardWidget;
  first: boolean;
  last: boolean;
  onChange: (w: DashboardWidget) => void;
  onMove: (delta: number) => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();
  const name = WIDGET_LABEL[w.id];
  return (
    <Reorder.Item value={w} dragListener={false} dragControls={controls} onDragEnd={onDragEnd} className="dash-edit__row" data-testid="dash-edit-row">
      <span className="dash-edit__grip" onPointerDown={(e) => controls.start(e)} aria-hidden>
        <GripVertical size={18} strokeWidth={1.5} />
      </span>
      <span className={`grow small ${w.hidden ? 'faint' : ''}`}>{name}</span>
      {HAS_SMALL.has(w.id) && (
        <button type="button" className="chip" aria-pressed={w.size === 's'} aria-label={`${name}: klein`} onClick={() => onChange({ ...w, size: w.size === 's' ? 'l' : 's' })}>
          klein
        </button>
      )}
      <IconButton icon={ArrowUp} label={`${name} nach oben`} disabled={first} onClick={() => onMove(-1)} />
      <IconButton icon={ArrowDown} label={`${name} nach unten`} disabled={last} onClick={() => onMove(1)} />
      <input type="checkbox" role="switch" className="switch" aria-label={`${name} anzeigen`} checked={!w.hidden} onChange={(e) => onChange({ ...w, hidden: !e.target.checked })} />
    </Reorder.Item>
  );
}

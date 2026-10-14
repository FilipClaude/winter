import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, Play, Plus, Square, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import {
  addStudyManual,
  cancelTimer,
  deleteExam,
  deleteTodo,
  replaceExamPlan,
  saveTodo,
  startTimer,
  stopTimer,
  saveExamWithGrade,
  ValidationError,
} from '../../db/repo';
import { EXAM_KINDS, SEMESTERS, type Exam, type ExamTopic, type Semester, type Todo } from '../../db/schemas';
import { useSettings } from '../../hooks/useSettings';
import { useNow, useToday } from '../../hooks/useNow';
import { buildStudyPlan } from '../../lib/calc/studyplan';
import { uid } from '../../lib/id';
import { schoolSubjects } from '../../lib/calc/subjects';
import { pointsToGrade } from '../../lib/calc/school';
import { formatHM, todayISO, type ISODate } from '../../lib/date';
import { NumberField, Segmented, SelectField, TextArea, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button, IconButton, SectionTitle } from '../../ui/primitives';
import { MockSection } from './MockExams';
import { EXAM_KIND_LABEL, formatClock, useTimer } from './school-utils';

function useSubjects() {
  return useLiveQuery(async () => schoolSubjects(await db.subjects.orderBy('order').toArray()), []) ?? [];
}

function useError() {
  const [error, setError] = useState<string>();
  const handle = (e: unknown) => setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen');
  return { error, setError, handle };
}

// ---------- Lern-Timer ----------

export function StudySheet({ close, subjectId: preset }: { close: () => void; subjectId?: string }) {
  const { toast } = useOverlay();
  const subjects = useSubjects();
  const timer = useTimer();
  const now = useNow(1000);
  const [subjectId, setSubjectId] = useState(preset ?? '');
  const settings = useSettings();
  const [mode, setMode] = useState<'frei' | 'pomodoro'>('frei');
  const [minutes, setMinutes] = useState<number | ''>('');
  const [date, setDate] = useState<ISODate>(todayISO());
  const { error, handle } = useError();
  const chosen = subjectId || subjects[0]?.id || '';
  const running = timer ? subjects.find((s) => s.id === timer.subjectId) : undefined;
  const elapsedMin = timer ? Math.max(0, (now.getTime() - new Date(timer.startedAt).getTime()) / 60_000) : 0;

  return (
    <div className="form">
      {timer ? (
        <div className="card timer-card" data-testid="timer-running">
          <span className="label">Läuft · {running?.name ?? 'Fach'}</span>
          <div className="big num timer-card__time">{formatClock(elapsedMin * 60)}</div>
          <div className="row">
            <Button
              variant="primary"
              className="grow"
              icon={Square}
              onClick={() =>
                void stopTimer().then((m) => {
                  toast(`${formatHM(m)} h ${running?.name ?? ''} gespeichert`);
                  close();
                })
              }
            >
              Stoppen & speichern
            </Button>
            <Button variant="ghost" icon={X} onClick={() => void cancelTimer()}>
              Verwerfen
            </Button>
          </div>
        </div>
      ) : null}

      <SectionTitle>Fach</SectionTitle>
      <div className="chips" role="group" aria-label="Fach">
        {subjects.map((s) => (
          <button key={s.id} type="button" className="chip" aria-pressed={s.id === chosen} onClick={() => setSubjectId(s.id)}>
            {s.name}
          </button>
        ))}
      </div>
      {!timer && (
        <Segmented
          label="Timer-Modus"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'frei', label: 'Frei' },
            { value: 'pomodoro', label: `Pomodoro ${settings.pomodoro.workMin}/${settings.pomodoro.breakMin}` },
          ]}
        />
      )}
      {!timer && (
        <Button
          variant="primary"
          block
          icon={Play}
          disabled={!chosen}
          onClick={() =>
            void startTimer(chosen, new Date(), mode === 'pomodoro' ? settings.pomodoro : undefined).then(() => {
              toast('Timer läuft – auch wenn die App geschlossen wird');
              close();
            })
          }
        >
          Timer starten
        </Button>
      )}
      <SectionTitle>Nachtragen</SectionTitle>
      <div className="form-row">
        <NumberField label="Minuten" value={minutes} onValue={setMinutes} min={1} max={720} />
        <TextField label="Datum" type="date" value={date} onValue={(v) => v && setDate(v)} />
      </div>
      {error && <p className="field__error">{error}</p>}
      <Button
        variant="secondary"
        block
        disabled={!chosen || minutes === '' || minutes <= 0}
        onClick={() =>
          void addStudyManual(chosen, date, Math.round(Number(minutes)))
            .then(() => {
              toast('Lernzeit eingetragen');
              close();
            })
            .catch(handle)
        }
      >
        Lernzeit eintragen
      </Button>
    </div>
  );
}

// ---------- Aufgaben ----------

export function TodoSheet({ close, todo }: { close: () => void; todo?: Todo }) {
  const { toast } = useOverlay();
  const subjects = useSubjects();
  const [title, setTitle] = useState(todo?.title ?? '');
  const [subjectId, setSubjectId] = useState(todo?.subjectId ?? '');
  const [due, setDue] = useState(todo?.due ?? '');
  const [priority, setPriority] = useState<NonNullable<Todo['priority']>>(todo?.priority ?? 'normal');
  const [repeat, setRepeat] = useState<NonNullable<Todo['repeat']>>(todo?.repeat ?? 'none');
  const { error, handle } = useError();

  return (
    <div className="form">
      <TextField label="Aufgabe" value={title} onValue={setTitle} maxLength={200} placeholder="z. B. Mathe S. 112 Nr. 4" autoFocus={!todo} />
      <div className="form-row">
        <SelectField label="Fach" value={subjectId} onValue={setSubjectId} options={[{ value: '', label: 'ohne Fach' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]} />
        <TextField label="Fällig" type="date" value={due} onValue={setDue} />
      </div>
      <Segmented<NonNullable<Todo['priority']>>
        label="Priorität"
        value={priority}
        onChange={setPriority}
        options={[
          { value: 'hoch', label: 'Hoch' },
          { value: 'normal', label: 'Normal' },
          { value: 'niedrig', label: 'Niedrig' },
        ]}
      />
      <Segmented<NonNullable<Todo['repeat']>>
        label="Wiederholen"
        value={repeat}
        onChange={setRepeat}
        options={[
          { value: 'none', label: 'Einmalig' },
          { value: 'weekly', label: 'Wöchentlich' },
          { value: 'biweekly', label: '2-wöchentl.' },
        ]}
      />
      {repeat !== 'none' && <p className="xsmall faint">Beim Abhaken entsteht die nächste Aufgabe {repeat === 'weekly' ? '7' : '14'} Tage nach der Fälligkeit.</p>}
      {error && <p className="field__error">{error}</p>}
      <Button
        variant="primary"
        block
        disabled={!title.trim()}
        onClick={() =>
          void saveTodo({
            ...(todo ? { id: todo.id, createdAt: todo.createdAt, doneAt: todo.doneAt } : {}),
            date: todo?.date ?? todayISO(),
            title,
            done: todo?.done ?? false,
            ...(subjectId ? { subjectId } : {}),
            ...(due ? { due } : {}),
            ...(priority !== 'normal' ? { priority } : {}),
            ...(repeat !== 'none' ? { repeat } : {}),
          })
            .then(() => {
              toast(todo ? 'Aufgabe gespeichert' : 'Aufgabe angelegt');
              close();
            })
            .catch(handle)
        }
      >
        Speichern
      </Button>
      {todo && (
        <Button variant="warn" block icon={Trash2} onClick={() => void deleteTodo(todo.id).then(close)}>
          Löschen
        </Button>
      )}
    </div>
  );
}

// ---------- Klausuren ----------

const LEVEL_LABEL = ['offen', 'angefangen', 'sitzt', 'wiederholt'] as const;

export function ExamSheet({ close, exam }: { close: () => void; exam?: Exam }) {
  const { toast } = useOverlay();
  const subjects = useSubjects();
  const settings = useSettings();
  const today = useToday();
  const [subjectId, setSubjectId] = useState(exam?.subjectId ?? '');
  const [kind, setKind] = useState<Exam['kind']>(exam?.kind ?? 'klausur');
  const [date, setDate] = useState(exam?.date ?? '');
  const [topics, setTopics] = useState(exam?.topics ?? '');
  const [topicList, setTopicList] = useState<ExamTopic[]>(exam?.topicList ?? []);
  const [newTopic, setNewTopic] = useState('');
  const [progress, setProgress] = useState(exam?.progress ?? 0);
  const [points, setPoints] = useState<number | ''>(exam?.points ?? '');
  const [reflection, setReflection] = useState(exam?.reflection ?? '');
  const [semester, setSemester] = useState<Semester | 'auto'>(exam?.semester ?? 'auto');
  const [planInfo, setPlanInfo] = useState('');
  // Einmal gespeichert (z. B. über „Lernplan erstellen“), wird dieselbe Klausur weiter bearbeitet –
  // sonst entstünde bei jedem Tippen eine neue (Review-Fund).
  const [stored, setStored] = useState<Pick<Exam, 'id' | 'createdAt'> | null>(exam ? { id: exam.id, createdAt: exam.createdAt } : null);
  const { error, handle } = useError();
  const chosen = subjectId || subjects[0]?.id || '';
  // Mit Themen-Checkliste ergibt sich der Lernstand aus den Themen (0–3 je Thema).
  const effectiveProgress =
    topicList.length > 0 ? Math.round((topicList.reduce((a, t) => a + t.level, 0) / (topicList.length * 3)) * 100) : progress;
  const returned = points !== '' || (date !== '' && date < today);
  const pointsValid = points === '' || (Number.isInteger(points) && points >= 0 && points <= 15);

  async function persist(): Promise<Exam> {
    const saved = await saveExamWithGrade({
      ...(stored ?? {}),
      subjectId: chosen,
      kind,
      date,
      topics,
      progress: effectiveProgress,
      ...(topicList.length > 0 ? { topicList } : {}),
      ...(reflection.trim() ? { reflection: reflection.trim() } : {}),
      ...(points !== '' ? { points } : {}),
      ...(semester !== 'auto' ? { semester } : {}),
    });
    setStored({ id: saved.id, createdAt: saved.createdAt });
    return saved;
  }

  return (
    <div className="form">
      <div className="form-row">
        <SelectField label="Fach" value={chosen} onValue={setSubjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
        <SelectField label="Art" value={kind} onValue={(v) => setKind(v as Exam['kind'])} options={EXAM_KINDS.map((k) => ({ value: k, label: EXAM_KIND_LABEL[k] }))} />
      </div>
      <TextField label="Datum" type="date" value={date} onValue={setDate} />
      <TextArea label="Notiz zu den Themen" value={topics} onValue={setTopics} rows={2} maxLength={2000} placeholder="z. B. Analysis: Ableitungen, Kurvendiskussion" />

      <div className="stack stack--s" data-testid="exam-topics">
        <span className="field__label">Themen · Lernstand {effectiveProgress} %</span>
        {topicList.map((t, i) => (
          <div key={t.id} className="topic-row">
            <span className="grow small">{t.title}</span>
            <Segmented
              label={`Lernstand ${t.title}`}
              value={String(t.level)}
              options={LEVEL_LABEL.map((l, lv) => ({ value: String(lv), label: l }))}
              onChange={(v) => setTopicList(topicList.map((x, j) => (j === i ? { ...x, level: Number(v) } : x)))}
            />
            <IconButton icon={Trash2} label={`${t.title} entfernen`} onClick={() => setTopicList(topicList.filter((_, j) => j !== i))} />
          </div>
        ))}
        <div className="row">
          <div className="grow">
            <TextField label="Neues Thema" value={newTopic} onValue={setNewTopic} maxLength={120} placeholder="z. B. Integrale" />
          </div>
          <Button
            size="s"
            variant="secondary"
            icon={Plus}
            disabled={!newTopic.trim()}
            onClick={() => {
              setTopicList([...topicList, { id: uid(), title: newTopic.trim(), level: 0 }]);
              setNewTopic('');
            }}
          >
            Thema
          </Button>
        </div>
      </div>

      {topicList.length === 0 && (
        <div className="field">
          <label className="field__label" htmlFor="exam-progress">
            Lernstand · <span className="mono accent">{progress} %</span>
          </label>
          <input id="exam-progress" className="range" type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
        </div>
      )}
      <NumberField label="Punkte (0–15, nach Rückgabe)" value={points} onValue={setPoints} min={0} max={15} hint={points !== '' ? `Note ${pointsToGrade(points)} – wird als Note im Fach übernommen` : 'leer lassen, solange nicht bewertet'} />
      <MockSection examId={stored?.id} subjectId={chosen} realPoints={points} />
      {returned && (
        <TextArea label="Reflexion: Was war schwer, was mache ich nächstes Mal anders?" value={reflection} onValue={setReflection} rows={3} maxLength={4000} />
      )}
      {planInfo && <p className="small accent" data-testid="plan-info">{planInfo}</p>}
      {error && <p className="field__error">{error}</p>}
      {topicList.length > 0 && date > today && points === '' && (
        <Button
          variant="secondary"
          block
          icon={CalendarClock}
          data-testid="make-plan"
          disabled={!chosen || !date || !pointsValid}
          onClick={() =>
            void persist()
              .then(async (saved) => {
                const plan = buildStudyPlan(saved.date, today, topicList, { minutesPerSchoolDay: Math.max(15, Math.round(settings.goals.studyMin / 2)) });
                await replaceExamPlan(
                  saved.id,
                  plan.blocks.map((b) => ({ date: b.date, subjectId: saved.subjectId, examId: saved.id, topic: b.topic.slice(0, 120), kind: b.kind, minutes: b.minutes, done: false })),
                );
                setPlanInfo(`${plan.blocks.length} Lerneinheiten geplant – sie erscheinen auf „Heute“ und unter Schule → Plan.${plan.warning ? ` ${plan.warning}` : ''}`);
              })
              .catch(handle)
          }
        >
          Lernplan erstellen
        </Button>
      )}
      <Segmented<Semester | 'auto'>
        label="Halbjahr"
        value={semester}
        onChange={setSemester}
        options={[{ value: 'auto', label: 'auto' }, ...SEMESTERS.map((s) => ({ value: s, label: s }))]}
      />
      <Button
        variant="primary"
        block
        disabled={!chosen || !date || !pointsValid}
        onClick={() =>
          void persist()
            .then(() => {
              toast('Klausur gespeichert');
              close();
            })
            .catch(handle)
        }
      >
        Speichern
      </Button>
      {stored && (
        <Button
          variant="warn"
          block
          icon={Trash2}
          onClick={() => {
            // Löscht auch die verknüpfte Note und offene Lerneinheiten – deshalb nachfragen.
            if (window.confirm('Klausur samt verknüpfter Note, offenen Lerneinheiten und Probe-Durchgängen löschen?')) void deleteExam(stored.id).then(close);
          }}
        >
          Löschen
        </Button>
      )}
    </div>
  );
}


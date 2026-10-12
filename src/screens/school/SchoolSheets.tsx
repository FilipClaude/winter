import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Square, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import {
  addStudyManual,
  cancelTimer,
  deleteDeadline,
  deleteExam,
  deleteTodo,
  saveDeadline,
  saveExam,
  saveModule,
  saveTodo,
  startTimer,
  stopTimer,
  ValidationError,
} from '../../db/repo';
import { DEADLINE_KINDS, EXAM_KINDS, type Deadline, type Exam, type Todo } from '../../db/schemas';
import { useNow } from '../../hooks/useNow';
import { pointsToGrade } from '../../lib/calc/school';
import { formatHM, todayISO, type ISODate } from '../../lib/date';
import { NumberField, SelectField, TextArea, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button, SectionTitle } from '../../ui/primitives';
import { DEADLINE_KIND_LABEL, EXAM_KIND_LABEL, formatClock, useTimer } from './school-utils';

function useSubjects() {
  return useLiveQuery(async () => (await db.subjects.orderBy('order').toArray()).filter((s) => !s.archived), []) ?? [];
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
        <Button
          variant="primary"
          block
          icon={Play}
          disabled={!chosen}
          onClick={() =>
            void startTimer(chosen).then(() => {
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
  const { error, handle } = useError();

  return (
    <div className="form">
      <TextField label="Aufgabe" value={title} onValue={setTitle} maxLength={200} placeholder="z. B. Mathe S. 112 Nr. 4" autoFocus={!todo} />
      <div className="form-row">
        <SelectField label="Fach" value={subjectId} onValue={setSubjectId} options={[{ value: '', label: 'ohne Fach' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]} />
        <TextField label="Fällig" type="date" value={due} onValue={setDue} />
      </div>
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

export function ExamSheet({ close, exam }: { close: () => void; exam?: Exam }) {
  const { toast } = useOverlay();
  const subjects = useSubjects();
  const [subjectId, setSubjectId] = useState(exam?.subjectId ?? '');
  const [kind, setKind] = useState<Exam['kind']>(exam?.kind ?? 'klausur');
  const [date, setDate] = useState(exam?.date ?? '');
  const [topics, setTopics] = useState(exam?.topics ?? '');
  const [progress, setProgress] = useState(exam?.progress ?? 0);
  const [points, setPoints] = useState<number | ''>(exam?.points ?? '');
  const { error, handle } = useError();
  const chosen = subjectId || subjects[0]?.id || '';

  return (
    <div className="form">
      <div className="form-row">
        <SelectField label="Fach" value={chosen} onValue={setSubjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
        <SelectField label="Art" value={kind} onValue={(v) => setKind(v as Exam['kind'])} options={EXAM_KINDS.map((k) => ({ value: k, label: EXAM_KIND_LABEL[k] }))} />
      </div>
      <TextField label="Datum" type="date" value={date} onValue={setDate} />
      <TextArea label="Themen" value={topics} onValue={setTopics} rows={3} maxLength={2000} placeholder="z. B. Analysis: Ableitungen, Kurvendiskussion" />
      <div className="field">
        <label className="field__label" htmlFor="exam-progress">
          Lernstand · <span className="mono accent">{progress} %</span>
        </label>
        <input id="exam-progress" className="range" type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} />
      </div>
      <NumberField label="Punkte (0–15, nach Rückgabe)" value={points} onValue={setPoints} min={0} max={15} hint={points !== '' ? `Note ${pointsToGrade(points)}` : 'leer lassen, solange nicht bewertet'} />
      {error && <p className="field__error">{error}</p>}
      <Button
        variant="primary"
        block
        disabled={!chosen || !date}
        onClick={() =>
          void saveExam({
            ...(exam ? { id: exam.id, createdAt: exam.createdAt } : {}),
            subjectId: chosen,
            kind,
            date,
            topics,
            progress,
            ...(points !== '' ? { points: Math.round(points) } : {}),
          })
            .then(() => {
              toast('Klausur gespeichert');
              close();
            })
            .catch(handle)
        }
      >
        Speichern
      </Button>
      {exam && (
        <Button variant="warn" block icon={Trash2} onClick={() => void deleteExam(exam.id).then(close)}>
          Löschen
        </Button>
      )}
    </div>
  );
}

// ---------- FernUni-Fristen ----------

export function DeadlineSheet({ close, deadline, moduleId: presetModule }: { close: () => void; deadline?: Deadline; moduleId?: string }) {
  const { toast } = useOverlay();
  const modules = useLiveQuery(async () => (await db.modules.toArray()).filter((m) => !m.archived), []) ?? [];
  const [moduleId, setModuleId] = useState(deadline?.moduleId ?? presetModule ?? '');
  const [newModule, setNewModule] = useState('');
  const [newNumber, setNewNumber] = useState('');
  const [kind, setKind] = useState<Deadline['kind']>(deadline?.kind ?? 'einsendearbeit');
  const [title, setTitle] = useState(deadline?.title ?? '');
  const [date, setDate] = useState(deadline?.date ?? '');
  const [time, setTime] = useState(deadline?.time ?? '');
  const { error, handle } = useError();
  const chosen = moduleId || modules[0]?.id || '';
  const creating = modules.length === 0 || chosen === '__neu';

  async function submit() {
    let mId = chosen;
    if (creating) {
      const m = await saveModule({ name: newModule, number: newNumber, archived: false });
      mId = m.id;
    }
    await saveDeadline({
      ...(deadline ? { id: deadline.id, createdAt: deadline.createdAt } : {}),
      moduleId: mId,
      kind,
      title: title.trim() || DEADLINE_KIND_LABEL[kind],
      date,
      done: deadline?.done ?? false,
      ...(time ? { time } : {}),
    });
    toast('Frist gespeichert – Warnung 14, 7 und 2 Tage vorher');
    close();
  }

  return (
    <div className="form">
      {modules.length > 0 && (
        <SelectField
          label="Modul"
          value={chosen}
          onValue={setModuleId}
          options={[...modules.map((m) => ({ value: m.id, label: m.number ? `${m.number} ${m.name}` : m.name })), { value: '__neu', label: '+ Neues Modul' }]}
        />
      )}
      {creating && (
        <div className="form-row">
          <TextField label="Neues Modul" value={newModule} onValue={setNewModule} maxLength={80} placeholder="z. B. Grundlagen der BWL" />
          <TextField label="Nummer" value={newNumber} onValue={setNewNumber} maxLength={20} placeholder="31001" />
        </div>
      )}
      <SelectField label="Art" value={kind} onValue={(v) => setKind(v as Deadline['kind'])} options={DEADLINE_KINDS.map((k) => ({ value: k, label: DEADLINE_KIND_LABEL[k] }))} />
      <TextField label="Bezeichnung" value={title} onValue={setTitle} maxLength={120} placeholder="z. B. EA 2" />
      <div className="form-row">
        <TextField label="Fällig am" type="date" value={date} onValue={setDate} />
        <TextField label="Uhrzeit (optional)" type="time" value={time} onValue={setTime} />
      </div>
      {error && <p className="field__error">{error}</p>}
      <Button variant="primary" block disabled={!date || (creating && !newModule.trim())} onClick={() => void submit().catch(handle)}>
        Speichern
      </Button>
      {deadline && (
        <Button variant="warn" block icon={Trash2} onClick={() => void deleteDeadline(deadline.id).then(close)}>
          Löschen
        </Button>
      )}
    </div>
  );
}

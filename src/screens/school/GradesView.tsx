import { useLiveQuery } from 'dexie-react-hooks';
import { NotebookTabs, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteGrade, saveGrade, ValidationError } from '../../db/repo';
import { GRADE_TYPE_LABEL, GRADE_TYPES, SEMESTERS, type Grade, type Semester, type Subject } from '../../db/schemas';
import { useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { roundPoints, semesterAverage } from '../../lib/calc/abi';
import { semesterForDate } from '../../lib/calc/calendar-by';
import { formatDecimal } from '../../lib/calc/insights';
import { pointsToGrade } from '../../lib/calc/school';
import { formatDE, type ISODate } from '../../lib/date';
import { LineChart } from '../../ui/charts';
import { NumberField, Segmented, SelectField, TextField } from '../../ui/controls';
import { ScreenSkeleton } from '../../ui/kit';
import { useOverlay } from '../../ui/overlay-context';
import { Button, Card, EmptyState, IconButton } from '../../ui/primitives';

export function GradesView() {
  const today = useToday();
  const settings = useSettings();
  const { openSheet } = useOverlay();
  const [semester, setSemester] = useState<Semester>(semesterForDate(today));
  const data = useLiveQuery(async () => {
    const [subjects, grades] = await Promise.all([db.subjects.orderBy('order').toArray(), db.grades.toArray()]);
    return { subjects: subjects.filter((s) => !s.archived && s.name !== 'FernUni'), grades };
  }, []);
  if (!data) return <ScreenSkeleton cards={2} />;
  const weights = { big: settings.abi.bigWeight, small: settings.abi.smallWeight };
  const inSem = data.grades.filter((g) => g.semester === semester);
  const open = (subject?: Subject, grade?: Grade) =>
    openSheet({
      title: grade ? 'Note bearbeiten' : 'Neue Note',
      render: (close) => (
        <GradeSheet subjects={data.subjects} subjectId={grade?.subjectId ?? subject?.id} semester={semester} grade={grade} close={close} today={today} />
      ),
    });

  return (
    <div className="stack" data-testid="grades-view">
      <div className="row row--between">
        <Segmented<Semester> label="Halbjahr" value={semester} onChange={setSemester} options={SEMESTERS.map((s) => ({ value: s, label: s }))} />
      </div>
      <Button variant="primary" icon={Plus} block onClick={() => open()}>
        Note eintragen
      </Button>
      {inSem.length === 0 && (
        <EmptyState icon={NotebookTabs} title={`Noch keine Noten in ${semester}`}>
          Klausuren und Kurzarbeiten zählen als große, Exen, Abfragen und Mündliches als kleine Leistungsnachweise. Groß und klein werden
          1 : 1 gewichtet.
        </EmptyState>
      )}
      {data.subjects.map((s) => {
        const mine = inSem.filter((g) => g.subjectId === s.id).sort((a, b) => a.date.localeCompare(b.date));
        if (mine.length === 0) return null;
        const avg = semesterAverage(mine, weights);
        const history = data.grades.filter((g) => g.subjectId === s.id).sort((a, b) => a.date.localeCompare(b.date));
        return (
          <Card
            key={s.id}
            label={s.name + (s.major ? ' · LF' : '')}
            ariaLabel={`Noten ${s.name}`}
            testId="grade-subject"
            action={<IconButton icon={Plus} label={`Note in ${s.name}`} variant="accent" onClick={() => open(s)} />}
          >
            <div className="row row--between" style={{ alignItems: 'flex-end' }}>
              <div>
                <span className="big big--m num">{avg === null ? '–' : formatDecimal(avg, 1)}</span>
                <span className="unit">P</span>
                <div className="xsmall faint">
                  Halbjahresleistung ≈ {avg === null ? '–' : `${roundPoints(avg)} P (Note ${pointsToGrade(roundPoints(avg))})`}
                </div>
              </div>
            </div>
            {history.length >= 2 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <LineChart
                  label={`Notenverlauf ${s.name}`}
                  min={0}
                  max={15}
                  height={80}
                  data={history.map((g) => ({ label: formatDE(g.date).slice(0, 6), value: g.points }))}
                />
              </div>
            )}
            <div className="list" style={{ marginTop: 'var(--space-2)' }}>
              {mine.map((g) => (
                <button key={g.id} type="button" className="list-item list-row list-row--button" onClick={() => open(s, g)} data-testid="grade-row">
                  <span className="grow list-row__text">
                    <span className="list-item__title">
                      {GRADE_TYPE_LABEL[g.type]} · {g.size === 'gross' ? 'groß' : 'klein'}
                      {g.weight !== 1 && <span className="faint"> ×{formatDecimal(g.weight, 1)}</span>}
                    </span>
                    <span className="list-item__meta">
                      {formatDE(g.date)}
                      {g.note && ` · ${g.note}`}
                    </span>
                  </span>
                  <span className="num" style={{ fontSize: 'var(--text-xl)' }}>
                    {g.points}
                    <span className="unit">P</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const BIG_TYPES = new Set<Grade['type']>(['klausur', 'kurzarbeit']);

function GradeSheet({
  subjects,
  subjectId,
  semester,
  grade,
  close,
  today,
}: {
  subjects: Subject[];
  subjectId: string | undefined;
  semester: Semester;
  grade: Grade | undefined;
  close: () => void;
  today: ISODate;
}) {
  const { toast } = useOverlay();
  const [f, setF] = useState({
    subjectId: grade?.subjectId ?? subjectId ?? subjects[0]?.id ?? '',
    semester: grade?.semester ?? semester,
    type: grade?.type ?? ('ex' as Grade['type']),
    size: grade?.size ?? ('klein' as Grade['size']),
    points: (grade?.points ?? '') as number | '',
    weight: (grade?.weight ?? 1) as number | '',
    date: grade?.date ?? today,
    note: grade?.note ?? '',
  });
  const [error, setError] = useState('');
  return (
    <div className="form">
      <SelectField label="Fach" value={f.subjectId} options={subjects.map((s) => ({ value: s.id, label: s.name }))} onValue={(subjectId) => setF({ ...f, subjectId })} />
      <Segmented<Semester> label="Halbjahr" value={f.semester} onChange={(s) => setF({ ...f, semester: s })} options={SEMESTERS.map((s) => ({ value: s, label: s }))} />
      <div className="chips" role="group" aria-label="Art">
        {GRADE_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className="chip"
            aria-pressed={f.type === t}
            onClick={() => setF({ ...f, type: t, size: BIG_TYPES.has(t) ? 'gross' : 'klein' })}
          >
            {GRADE_TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <Segmented<Grade['size']>
        label="Leistungsnachweis"
        value={f.size}
        onChange={(size) => setF({ ...f, size })}
        options={[
          { value: 'gross', label: 'groß' },
          { value: 'klein', label: 'klein' },
        ]}
      />
      <div className="form-row">
        <NumberField label="Punkte (0–15)" value={f.points} min={0} max={15} onValue={(points) => setF({ ...f, points })} />
        <NumberField label="Gewicht" hint="innerhalb groß/klein" value={f.weight} min={0.1} max={10} decimal onValue={(weight) => setF({ ...f, weight })} />
      </div>
      <TextField label="Datum" type="date" value={f.date} onValue={(date) => setF({ ...f, date })} />
      <TextField label="Notiz" value={f.note} onValue={(note) => setF({ ...f, note })} placeholder="z. B. Thema" />
      {error && <p className="small warn">{error}</p>}
      <Button
        variant="primary"
        block
        onClick={() => {
          void saveGrade({
            ...(grade ? { id: grade.id, createdAt: grade.createdAt } : {}),
            subjectId: f.subjectId,
            semester: f.semester,
            size: f.size,
            type: f.type,
            points: f.points === '' ? -1 : f.points,
            weight: f.weight === '' ? 1 : f.weight,
            date: f.date,
            note: f.note.trim(),
          })
            .then(() => {
              toast('Note gespeichert');
              close();
            })
            .catch((e: unknown) => setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen'));
        }}
      >
        Speichern
      </Button>
      {grade && (
        <Button
          variant="ghost"
          block
          icon={Trash2}
          onClick={() =>
            void deleteGrade(grade.id).then(() => {
              toast('Note gelöscht', { tone: 'warn' });
              close();
            })
          }
        >
          Löschen
        </Button>
      )}
    </div>
  );
}

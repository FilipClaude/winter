import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteMockExam, restoreRow, saveMockExam, ValidationError } from '../../db/repo';
import { useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { mockResults, mockTrend, type MockResult } from '../../lib/calc/exams';
import { formatDecimal } from '../../lib/calc/insights';
import { schoolSubjects } from '../../lib/calc/subjects';
import { formatDayMonth, formatShort, type ISODate } from '../../lib/date';
import { LineChart } from '../../ui/charts';
import { NumberField, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button, Card, IconButton, SectionTitle } from '../../ui/primitives';

export const NP_NOTE = 'Schätzung, Notenschlüssel der Schule kann abweichen';

const pct = (n: number) => `${formatDecimal(n, n % 1 ? 1 : 0)} %`;
const be = (n: number) => formatDecimal(n, n % 1 ? 1 : 0);

function trendText(t: number | null): string {
  if (t === null) return '';
  return t === 0 ? 'gleich' : `${t > 0 ? '+' : '−'}${Math.abs(t)} P seit der ersten Probe`;
}

/** Kleiner Verlauf der geschätzten Punkte (0–15). Ab zwei Durchgängen. */
function PointsChart({ results, label, real }: { results: MockResult[]; label: string; real?: number | undefined }) {
  if (results.length < 2) return null;
  return (
    <LineChart
      label={label}
      data={results.map((r) => ({ label: formatDayMonth(r.date).slice(0, 5), value: r.points }))}
      {...(real !== undefined ? { secondary: results.map(() => ({ value: real })) } : {})}
      min={0}
      max={15}
      height={80}
    />
  );
}

/**
 * Probe-Durchgänge einer gespeicherten Klausur im Klausur-Sheet: Liste mit Prozent und geschätzten
 * Notenpunkten, Trend, Vergleich mit der echten Note, Eintragen und Löschen (mit Rückgängig).
 */
export function MockSection({ examId, subjectId, realPoints }: { examId: string | undefined; subjectId: string; realPoints: number | '' }) {
  const settings = useSettings();
  const today = useToday();
  const { toast } = useOverlay();
  const rows = useLiveQuery(async () => (examId ? db.mockExams.where('examId').equals(examId).toArray() : []), [examId]);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<ISODate>(today);
  const [points, setPoints] = useState<number | ''>('');
  const [max, setMax] = useState<number | ''>('');
  const [minutes, setMinutes] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!examId)
    return (
      <div className="stack stack--s" data-testid="mock-section">
        <span className="field__label">Probe-Klausuren</span>
        <p className="xsmall faint">Nach dem ersten Speichern lassen sich hier Probe-Durchgänge eintragen.</p>
      </div>
    );
  if (!rows) return null;
  const results = mockResults(rows, settings.npScale);
  const last = results.at(-1);
  const trend = mockTrend(results);
  const valid = points !== '' && max !== '' && max >= 1 && points <= max && (minutes === '' || (Number.isInteger(minutes) && minutes >= 1 && minutes <= 600));

  const add = () => {
    if (points === '' || max === '') return;
    // Fach der gespeicherten Klausur, nicht das gerade im Formular gewählte (Review-2-Fund)
    void db.exams
      .get(examId)
      .then((exam) =>
        saveMockExam({
      date,
      examId,
      subjectId: exam?.subjectId ?? subjectId,
      points,
      maxPoints: max,
      ...(minutes !== '' ? { durationMin: Math.round(minutes) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
        }),
      )
      .then(() => {
        toast('Probe eingetragen');
        setPoints('');
        setMinutes('');
        setNote('');
        setError('');
        setOpen(false);
      })
      .catch((e: unknown) => setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen'));
  };

  return (
    <div className="stack stack--s" data-testid="mock-section">
      <div className="row row--between">
        <span className="field__label">Probe-Klausuren{results.length > 0 ? ` · ${results.length}` : ''}</span>
        {!open && (
          <Button size="s" variant="secondary" icon={Plus} onClick={() => setOpen(true)} data-testid="mock-add">
            Probe
          </Button>
        )}
      </div>
      {results.length > 0 && (
        <>
          <div className="list" data-testid="mock-list">
            {[...results].reverse().map((r) => {
              const row = rows.find((x) => x.id === r.id);
              if (!row) return null;
              return (
                <div key={r.id} className="list-item" data-testid="mock-row">
                  <span className="grow">
                    <span className="list-item__title">
                      {be(row.points)}/{be(row.maxPoints)} BE · {pct(r.percent)} · ≈ {r.points} P
                    </span>
                    <br />
                    <span className="list-item__meta">
                      {formatShort(r.date)}
                      {row.durationMin ? ` · ${row.durationMin} min` : ''}
                      {row.note ? ` · ${row.note}` : ''}
                    </span>
                  </span>
                  <IconButton
                    icon={Trash2}
                    label={`Probe vom ${formatShort(r.date)} löschen`}
                    onClick={() =>
                      void deleteMockExam(r.id).then((gone) =>
                        toast('Probe gelöscht', { tone: 'warn', ...(gone ? { action: { label: 'Rückgängig', run: () => void restoreRow('mockExams', gone) } } : {}) }),
                      )
                    }
                  />
                </div>
              );
            })}
          </div>
          <PointsChart results={results} label="Geschätzte Punkte je Probe-Durchgang" real={realPoints === '' ? undefined : realPoints} />
          <p className="xsmall faint" data-testid="mock-summary">
            {realPoints !== '' && last ? `Echte Note ${realPoints} P · letzte Probe ≈ ${last.points} P · ` : ''}
            {trendText(trend) ? `${trendText(trend)} · ` : ''}
            {NP_NOTE}.
          </p>
        </>
      )}
      {open && (
        <div className="stack stack--s mock-form">
          <div className="form-row">
            <NumberField label="Erreichte BE" value={points} onValue={setPoints} min={0} max={1000} decimal />
            <NumberField label="Maximale BE" value={max} onValue={setMax} min={1} max={1000} decimal />
          </div>
          {valid && (
            <p className="xsmall muted" data-testid="mock-preview">
              {pct(Math.round((points / max) * 1000) / 10)} · ≈ {mockResults([{ id: '', date, createdAt: '', examId, subjectId, points, maxPoints: max }], settings.npScale)[0]?.points} P ({NP_NOTE})
            </p>
          )}
          {points !== '' && max !== '' && points > max && <p className="field__error">Erreichte BE dürfen nicht über dem Maximum liegen.</p>}
          <div className="form-row">
            <TextField label="Datum der Probe" type="date" value={date} onValue={(v) => v && setDate(v)} />
            <NumberField label="Dauer (min, optional)" value={minutes} onValue={setMinutes} min={1} max={600} />
          </div>
          <TextField label="Notiz (optional)" value={note} onValue={setNote} maxLength={500} placeholder="z. B. Altklausur 2024" />
          {error && <p className="field__error">{error}</p>}
          <div className="row">
            <Button variant="primary" className="grow" disabled={!valid} onClick={add}>
              Probe speichern
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Verlauf je Fach über alle Probe-Durchgänge, mit echten Klausurpunkten zum Vergleich (Schule → Klausuren). */
export function SubjectMockTrends() {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const [mocks, subjects, exams] = await Promise.all([db.mockExams.toArray(), db.subjects.orderBy('order').toArray(), db.exams.toArray()]);
    return { mocks, subjects: schoolSubjects(subjects), exams };
  }, []);
  if (!data || data.mocks.length === 0) return null;
  const results = mockResults(data.mocks, settings.npScale);
  const bySubject = data.subjects
    .map((s) => ({ s, rs: results.filter((r) => r.subjectId === s.id) }))
    .filter((x) => x.rs.length > 0);
  if (bySubject.length === 0) return null;
  return (
    <>
      <SectionTitle>Probe-Klausuren je Fach</SectionTitle>
      <Card label="Verlauf" icon={TrendingUp} ariaLabel="Probe-Klausuren je Fach" testId="mock-trends">
        <div className="stack">
          {bySubject.map(({ s, rs }) => {
            const last = rs.at(-1);
            // „echt“ nur, wenn die Klausur des letzten Durchgangs schon bewertet ist (sonst verglich man Äpfel mit Birnen)
            const real = data.exams.find((e) => e.id === last?.examId && e.points !== undefined);
            return (
              <div key={s.id} className="stack stack--s" data-testid="mock-trend">
                <div className="row row--between small">
                  <span>{s.name}</span>
                  <span className="mono faint">
                    {rs.length} × · zuletzt ≈ {last?.points ?? '–'} P{real?.points !== undefined ? ` · echt ${real.points} P` : ''}
                  </span>
                </div>
                <PointsChart results={rs} label={`${s.name}: geschätzte Punkte je Probe-Durchgang`} real={real?.points} />
                {trendText(mockTrend(rs)) && <span className="xsmall faint">{trendText(mockTrend(rs))}</span>}
              </div>
            );
          })}
          <p className="xsmall faint">Gestrichelt: echte Note der Klausur. {NP_NOTE}.</p>
        </div>
      </Card>
    </>
  );
}

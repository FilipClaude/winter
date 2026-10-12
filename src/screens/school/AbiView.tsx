import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, BookMarked, Calculator, GraduationCap, Info, ListChecks, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { saveSettings, setSemesterResult } from '../../db/repo';
import { SEMESTERS, type Semester, type Settings, type Subject } from '../../db/schemas';
import { useSettings } from '../../hooks/useSettings';
import {
  ABI_RULES,
  computeAbi,
  knownHalfYears,
  neededExamPoints,
  type AbiResult,
  type AbiSubject,
  type Certainty,
  type HalfYear,
  type Role,
} from '../../lib/calc/abi';
import { abiSubjects, defaultRole } from '../../lib/calc/abi-setup';
import { formatDecimal } from '../../lib/calc/insights';
import { NumberField, Segmented } from '../../ui/controls';
import { ScreenSkeleton } from '../../ui/kit';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Banner, Button, Card, EmptyState, SectionTitle } from '../../ui/primitives';

const CERTAINTY_TONE: Record<Certainty, 'accent' | 'warn' | 'muted'> = {
  sicher: 'accent',
  gedeutet: 'muted',
  unsicher: 'warn',
};

export function AbiView() {
  const settings = useSettings();
  const data = useLiveQuery(async () => {
    const [subjects, grades, results] = await Promise.all([
      db.subjects.orderBy('order').toArray(),
      db.grades.toArray(),
      db.semesterResults.toArray(),
    ]);
    return { subjects, grades, results };
  }, []);
  if (!data) return <ScreenSkeleton cards={3} />;

  const abi = settings.abi;
  const subjects = abiSubjects(data.subjects, abi);
  const known = knownHalfYears(data.grades, data.results, { big: abi.bigWeight, small: abi.smallWeight });
  const r = computeAbi({ subjects, known, seminar: abi.seminar, examPoints: abi.examPoints });
  return (
    <div className="stack" data-testid="abi-view">
      <AbiSummary r={r} />
      {abi.examSubjects.length !== 5 && (
        <Banner icon={GraduationCap} tone="accent" testId="abi-setup-hint">
          Wähle zuerst deine 5 Abiturfächer – dann rechnet Winter mit den richtigen Pflicht-Halbjahren.
        </Banner>
      )}
      {r.warnings.length > 0 && (
        <div className="stack stack--s" data-testid="abi-warnings">
          {r.warnings.map((w, i) => (
            <Banner key={i} icon={AlertTriangle} tone={w.level === 'kritisch' ? 'warn' : 'plain'}>
              {w.text}
            </Banner>
          ))}
        </div>
      )}
      <ExamCard settings={settings} subjects={data.subjects} result={r} abiSubjects={subjects} />
      <ScenarioCard result={r} subjects={subjects} />
      <HalfYearGrid subjects={subjects} result={r} />
      <SeminarCard settings={settings} />
      <RolesCard settings={settings} subjects={data.subjects} />
      <RulesCard />
    </div>
  );
}

function AbiSummary({ r }: { r: AbiResult }) {
  return (
    <Card label="Abi-Schnitt (Hochrechnung)" icon={GraduationCap} ariaLabel="Abi-Schnitt" testId="abi-summary">
      <div className="row row--between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="big num" data-testid="abi-grade">
            {r.grade === null ? '–' : formatDecimal(r.grade, 1)}
          </div>
          <div className="xsmall faint">{r.grade === null ? 'unter 300 Punkten' : 'Durchschnittsnote'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="num" style={{ fontSize: 'var(--type-title-size)' }}>
            {r.total}
            <span className="unit">/ 900</span>
          </div>
          <div className="xsmall faint mono">
            I {r.block1}/600 · II {r.block2}/300
          </div>
        </div>
      </div>
      {r.projectedShare > 0 && (
        <p className="xsmall muted" style={{ marginTop: 'var(--space-3)' }}>
          {Math.round(r.projectedShare * 100)} % der Werte sind Prognose (aus deinem Fachschnitt). Je mehr Noten und Zeugnisse du einträgst, desto genauer.
        </p>
      )}
    </Card>
  );
}

function ExamCard({
  settings,
  subjects,
  result,
  abiSubjects: list,
}: {
  settings: Settings;
  subjects: Subject[];
  result: AbiResult;
  abiSubjects: AbiSubject[];
}) {
  const { openSheet } = useOverlay();
  const abi = settings.abi;
  const name = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Fach';
  return (
    <Card
      label="Abiturprüfungen"
      icon={ScrollText}
      ariaLabel="Abiturprüfungen"
      testId="abi-exams"
      action={
        <Button
          variant="ghost"
          size="s"
          onClick={() =>
            openSheet({
              title: 'Abiturfächer',
              render: (close) => <ExamSubjectsSheet settings={settings} subjects={subjects} close={close} />,
            })
          }
        >
          Fächer
        </Button>
      }
    >
      {abi.examSubjects.length === 0 ? (
        <EmptyState icon={ScrollText} title="Noch keine Abiturfächer gewählt" />
      ) : (
        <div className="list">
          {result.examResults.map((e) => {
            const s = list.find((x) => x.id === e.subjectId);
            return (
              <div key={e.subjectId} className="list-item">
                <span className="grow">
                  <span className="list-item__title">{name(e.subjectId)}</span>
                  {s?.core && subjects.find((x) => x.id === e.subjectId)?.major && <Badge tone="muted">LF</Badge>}
                  <br />
                  <span className="list-item__meta">
                    {e.projected ? 'Prognose aus Halbjahren' : 'geplant'} · zählt {e.points * ABI_RULES.examFactor.value} P
                  </span>
                </span>
                <div style={{ width: 110 }}>
                  <NumberField
                    label={`Punkte ${name(e.subjectId)}`}
                    value={abi.examPoints[e.subjectId] ?? ''}
                    placeholder={String(e.points)}
                    min={0}
                    max={15}
                    onValue={(v) => {
                      const examPoints = Object.fromEntries(
                        Object.entries(abi.examPoints).filter(([k]) => k !== e.subjectId),
                      );
                      if (v !== '') {
                        if (!Number.isInteger(v) || v < 0 || v > 15) return;
                        examPoints[e.subjectId] = v;
                      }
                      void saveSettings({ abi: { ...abi, examPoints } });
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ExamSubjectsSheet({ settings, subjects, close }: { settings: Settings; subjects: Subject[]; close: () => void }) {
  const [sel, setSel] = useState<string[]>(settings.abi.examSubjects);
  const { toast } = useOverlay();
  const toggle = (id: string) =>
    setSel(sel.includes(id) ? sel.filter((x) => x !== id) : sel.length >= 5 ? sel : [...sel, id]);
  return (
    <div className="form">
      <p className="small muted">
        Fünf Abiturfächer: drei schriftlich, zwei mündlich. Deutsch, Mathematik und das Leistungsfach sind schriftliche Pflicht (GSO Anlage 10).
      </p>
      <div className="chips" role="group" aria-label="Abiturfächer">
        {subjects
          .filter((s) => !s.archived && s.name !== 'FernUni')
          .map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={sel.includes(s.id)} onClick={() => toggle(s.id)}>
              {s.name}
              {s.major ? ' · LF' : ''}
            </button>
          ))}
      </div>
      <p className="xsmall faint">{sel.length} von 5 gewählt</p>
      <Button
        variant="primary"
        block
        onClick={() =>
          void saveSettings({ abi: { ...settings.abi, examSubjects: sel } }).then(() => {
            toast('Abiturfächer gespeichert');
            close();
          })
        }
      >
        Speichern
      </Button>
    </div>
  );
}

function ScenarioCard({ result, subjects }: { result: AbiResult; subjects: AbiSubject[] }) {
  const exams = subjects.filter((s) => s.exam);
  const [subjectId, setSubjectId] = useState<string>('');
  const [target, setTarget] = useState('1.5');
  const sid = exams.some((s) => s.id === subjectId) ? subjectId : (exams.find((s) => s.core && s.name !== 'Deutsch' && s.name !== 'Mathe')?.id ?? exams[0]?.id ?? '');
  if (exams.length === 0) return null;
  const need = neededExamPoints(result, sid, Number(target));
  const subjectName = exams.find((s) => s.id === sid)?.name ?? '';
  return (
    <Card label="Was brauche ich?" icon={Calculator} ariaLabel="Szenario-Rechner" testId="abi-scenario">
      <div className="stack stack--s">
        <span className="xsmall muted">Prüfungsfach</span>
        <div className="chips" role="group" aria-label="Prüfungsfach für das Szenario">
          {exams.map((s) => (
            <button key={s.id} type="button" className="chip" aria-pressed={s.id === sid} onClick={() => setSubjectId(s.id)}>
              {s.name}
            </button>
          ))}
        </div>
        <span className="xsmall muted">Wunschnote</span>
        <Segmented
          label="Wunschnote"
          value={target}
          onChange={setTarget}
          options={['1.0', '1.3', '1.5', '1.8', '2.0', '2.5'].map((v) => ({ value: v, label: v.replace('.', ',') }))}
        />
        <p className="small" data-testid="abi-scenario-result" style={{ marginTop: 'var(--space-2)' }}>
          {need === null ? (
            <>Für {target.replace('.', ',')} reicht auch eine 15 in {subjectName} nicht – wenn alles andere so bleibt.</>
          ) : (
            <>
              Für <b>{target.replace('.', ',')}</b> brauchst du in {subjectName} mindestens{' '}
              <b className="accent num">{need} Punkte</b>
              {need === 0 ? ' – schon sicher, wenn alles andere so bleibt.' : ' (bei sonst gleichen Werten).'}
            </>
          )}
        </p>
      </div>
    </Card>
  );
}

function HalfYearGrid({ subjects, result }: { subjects: AbiSubject[]; result: AbiResult }) {
  const { openSheet } = useOverlay();
  const all = [...result.included, ...result.excluded];
  const cell = (id: string, sem: Semester) => all.find((h) => h.subjectId === id && h.semester === sem);
  const included = new Set(result.included);
  const rows = subjects.filter((s) => s.role !== 'none');
  return (
    <Card label="Halbjahresleistungen" icon={ListChecks} ariaLabel="Halbjahresleistungen" testId="abi-grid">
      <p className="xsmall faint" style={{ marginBottom: 'var(--space-3)' }}>
        Tippen trägt das Zeugnis ein. <b className="muted">Fett</b> = Zeugnis, normal = aus Noten, blass = Prognose,
        durchgestrichen = nicht eingebracht.
      </p>
      <div className="abi-grid" role="group" aria-label="Halbjahresleistungen je Fach">
        <div className="abi-grid__row abi-grid__head" aria-hidden>
          <span>Fach</span>
          {SEMESTERS.map((s) => (
            <span key={s} className="mono">
              {s}
            </span>
          ))}
        </div>
        {rows.map((s) => (
          <div key={s.id} className="abi-grid__row">
            <span className="abi-grid__name">
              {s.name}
              {s.exam && <span className="accent"> ·A</span>}
            </span>
            {SEMESTERS.map((sem) => {
              const h = cell(s.id, sem);
              return (
                <button
                  key={sem}
                  type="button"
                  className={`abi-cell abi-cell--${h?.kind ?? 'leer'} ${h && !included.has(h) ? 'abi-cell--out' : ''}`}
                  aria-label={`${s.name} ${sem}: ${h ? `${h.points} Punkte (${h.kind}${included.has(h) ? '' : ', nicht eingebracht'})` : 'leer'}`}
                  onClick={() =>
                    openSheet({
                      title: `${s.name} · ${sem}`,
                      render: (close) => <ZeugnisSheet subjectId={s.id} semester={sem} current={h} close={close} />,
                    })
                  }
                >
                  {h ? h.points : '–'}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </Card>
  );
}

function ZeugnisSheet({
  subjectId,
  semester,
  current,
  close,
}: {
  subjectId: string;
  semester: Semester;
  current: HalfYear | undefined;
  close: () => void;
}) {
  const [v, setV] = useState<number | ''>(current?.kind === 'zeugnis' ? current.points : '');
  const { toast } = useOverlay();
  const valid = v !== '' && Number.isInteger(v) && v >= 0 && v <= 15;
  return (
    <div className="form">
      <p className="small muted">
        {current
          ? `Aktuell: ${current.points} Punkte (${current.kind === 'zeugnis' ? 'Zeugnis' : current.kind === 'noten' ? 'aus deinen Noten berechnet' : 'Prognose'}).`
          : 'Noch kein Wert.'}{' '}
        Ein Zeugniswert hat immer Vorrang vor der Berechnung aus Noten.
      </p>
      <NumberField label="Halbjahresleistung laut Zeugnis (0–15)" value={v} onValue={setV} min={0} max={15} />
      <Button
        variant="primary"
        block
        disabled={!valid}
        onClick={() =>
          void setSemesterResult(subjectId, semester, Number(v)).then(() => {
            toast('Zeugnis gespeichert');
            close();
          })
        }
      >
        Speichern
      </Button>
      {current?.kind === 'zeugnis' && (
        <Button
          variant="ghost"
          block
          onClick={() =>
            void setSemesterResult(subjectId, semester, null).then(() => {
              toast('Zeugniswert entfernt');
              close();
            })
          }
        >
          Zeugniswert entfernen
        </Button>
      )}
    </div>
  );
}

function SeminarCard({ settings }: { settings: Settings }) {
  const abi = settings.abi;
  const set = (patch: Partial<Settings['abi']['seminar']>) =>
    void saveSettings({ abi: { ...abi, seminar: { ...abi.seminar, ...patch } } });
  const val = (n: number | null) => (n === null ? '' : n);
  const num = (max: number) => (v: number | '') => {
    if (v === '') return null;
    return Number.isInteger(v) && v >= 0 && v <= max ? v : undefined;
  };
  return (
    <Card label="W-Seminar" icon={BookMarked} ariaLabel="W-Seminar">
      <div className="form-row">
        <NumberField
          label="12/1"
          value={val(abi.seminar.s1)}
          min={0}
          max={15}
          placeholder="8"
          onValue={(v) => {
            const n = num(15)(v);
            if (n !== undefined) set({ s1: n });
          }}
        />
        <NumberField
          label="12/2"
          value={val(abi.seminar.s2)}
          min={0}
          max={15}
          placeholder="8"
          onValue={(v) => {
            const n = num(15)(v);
            if (n !== undefined) set({ s2: n });
          }}
        />
      </div>
      <NumberField
        label="Seminararbeit, Gesamtleistung (0–30)"
        hint="Zählt wie zwei Halbjahresleistungen. Zulassung: mindestens 9."
        value={val(abi.seminar.paper)}
        min={0}
        max={30}
        placeholder="16"
        onValue={(v) => {
          const n = num(30)(v);
          if (n !== undefined) set({ paper: n });
        }}
      />
    </Card>
  );
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'all', label: 'alle 4' },
  { value: 'three', label: '3 von 4' },
  { value: 'free', label: 'frei' },
  { value: 'none', label: 'aus' },
];

function RolesCard({ settings, subjects }: { settings: Settings; subjects: Subject[] }) {
  const { openSheet } = useOverlay();
  return (
    <Card
      label="Einbringung je Fach"
      icon={Info}
      ariaLabel="Einbringung je Fach"
      action={
        <Button
          variant="ghost"
          size="s"
          onClick={() =>
            openSheet({ title: 'Einbringung je Fach', render: () => <RolesSheet settings={settings} subjects={subjects} /> })
          }
        >
          Ändern
        </Button>
      }
    >
      <p className="small muted">
        Standard nach GSO Anlage 10: Deutsch, Mathe, Leistungsfach, Abiturfächer sowie die einzige Fremdsprache und die
        einzige Naturwissenschaft alle 4 Halbjahre; Fremdsprachen, Religion/Ethik, Geschichte, Kunst/Musik und
        Naturwissenschaften 3 von 4; übrige Fächer frei. Sonderfälle bitte selbst einstellen.
      </p>
    </Card>
  );
}

function RolesSheet({ settings, subjects }: { settings: Settings; subjects: Subject[] }) {
  const abi = settings.abi;
  // Automatische Rollen (inkl. einzige Fremdsprache/Naturwissenschaft) als Vorgabe anzeigen.
  const auto = new Map(abiSubjects(subjects, { ...abi, roles: {} }).map((s) => [s.id, s.role]));
  return (
    <div className="form">
      {subjects
        .filter((s) => !s.archived)
        .map((s) => (
          <div key={s.id} className="stack stack--s">
            <span className="small">{s.name}</span>
            <Segmented<Role>
              label={`Einbringung ${s.name}`}
              value={abi.roles[s.id] ?? auto.get(s.id) ?? defaultRole(s, abi.examSubjects)}
              options={ROLE_OPTIONS}
              onChange={(role) => void saveSettings({ abi: { ...abi, roles: { ...abi.roles, [s.id]: role } } })}
            />
          </div>
        ))}
      <Button variant="ghost" block onClick={() => void saveSettings({ abi: { ...abi, roles: {} } })}>
        Auf Standard zurücksetzen
      </Button>
    </div>
  );
}

function RulesCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card
      label="Regeln & Quellen"
      icon={Info}
      ariaLabel="Regeln und Quellen"
      testId="abi-rules"
      action={
        <Button variant="ghost" size="s" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Weniger' : 'Anzeigen'}
        </Button>
      }
    >
      <p className="small muted">
        Grundlage: GSO (Fassung ab 01.08.2026) und gymnasiale-oberstufe.bayern.de. Unsichere Punkte sind markiert. Verbindlich ist die
        Oberstufenkoordination.
      </p>
      {open && (
        <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
          <SectionTitle>Regeln</SectionTitle>
          {Object.entries(ABI_RULES).map(([k, rule]) => (
            <div key={k} className="stack stack--s">
              <Badge tone={CERTAINTY_TONE[rule.certainty]}>{rule.certainty}</Badge>
              <p className="small">{rule.text}</p>
              <p className="xsmall faint">Quelle: {rule.source}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

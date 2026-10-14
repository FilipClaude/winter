import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteSession, saveSession, ValidationError } from '../../db/repo';
import { GYM_SPLITS, SESSION_TYPES, type GymExercise, type GymSplit, type Match, type Session, type SessionType } from '../../db/schemas';
import { detectPRs, GYM_SPLIT_LABEL, normalizeExercise, SESSION_LABEL, sessionLoad, sessionTitle } from '../../lib/calc/training';
import { toISODate, todayISO, type ISODate } from '../../lib/date';
import { parseNumberDE } from '../../lib/number';
import { NumberField, Scale, Segmented, TextArea, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button, IconButton, SectionTitle } from '../../ui/primitives';

const DEFAULT_DURATION: Record<SessionType, number> = { football: 90, match: 80, gym: 60, run: 30, recovery: 20, other: 45 };
const DEFAULT_RPE: Record<SessionType, number> = { football: 6, match: 8, gym: 7, run: 6, recovery: 2, other: 5 };

type NumIn = number | '';
interface SetIn {
  reps: NumIn;
  weightKg: NumIn;
}
interface ExIn {
  name: string;
  sets: SetIn[];
}

const emptyMatch = { opponent: '', goalsFor: 0 as NumIn, goalsAgainst: 0 as NumIn, minutes: 80 as NumIn, goals: 0 as NumIn, assists: 0 as NumIn, shots: 0 as NumIn, rating: 6, reflection: '' };

/** Spiel aus dem BFV-Abgleich, das nach dem Abpfiff eingetragen wird. */
export interface BfvPreset {
  id: string;
  kickoff: string;
  home: boolean;
  opponent: string;
}

export interface SessionSheetProps {
  date?: ISODate | undefined;
  type?: SessionType | undefined;
  session?: Session | undefined;
  bfv?: BfvPreset | undefined;
  close: () => void;
}

export function SessionSheet({ date, type: initialType, session, bfv, close }: SessionSheetProps) {
  const { toast } = useOverlay();
  const templates = useLiveQuery(() => db.exerciseTemplates.orderBy('order').toArray(), []);
  const [type, setType] = useState<SessionType>(session?.type ?? (bfv ? 'match' : undefined) ?? initialType ?? 'football');
  const [day, setDay] = useState<ISODate>(session?.date ?? (bfv ? toISODate(bfv.kickoff) : undefined) ?? date ?? todayISO());
  // BFV-Verknüpfung: bestehend (Bearbeiten) oder neu aus dem Abgleich. Manuelle Werte haben immer Vorrang.
  const bfvLink = session?.bfv ?? (bfv ? { id: bfv.id, kickoff: bfv.kickoff, home: bfv.home, prefilled: ['opponent' as const] } : undefined);
  const [duration, setDuration] = useState<NumIn>(session?.durationMin ?? DEFAULT_DURATION[initialType ?? 'football']);
  const [rpe, setRpe] = useState<number | undefined>(session?.rpe ?? DEFAULT_RPE[initialType ?? 'football']);
  const [note, setNote] = useState(session?.note ?? '');
  const [match, setMatch] = useState(session?.match ? { ...session.match } : bfv ? { ...emptyMatch, opponent: bfv.opponent } : emptyMatch);
  const [exercises, setExercises] = useState<ExIn[]>(session?.gym?.exercises.map((e) => ({ name: e.name, sets: e.sets.map((s) => ({ ...s })) })) ?? []);
  const [customName, setCustomName] = useState('');
  const [split, setSplit] = useState<GymSplit | ''>(session?.split ?? '');
  const [error, setError] = useState<string>();

  function pickType(t: SessionType) {
    setType(t);
    if (!session) {
      setDuration(DEFAULT_DURATION[t]);
      setRpe(DEFAULT_RPE[t]);
    }
  }

  function addExercise(name: string) {
    const clean = name.trim();
    if (!clean) return;
    const t = templates?.find((x) => normalizeExercise(x.name) === normalizeExercise(clean));
    const sets: SetIn[] = t && t.lastSets.length > 0 ? t.lastSets.map((s) => ({ ...s })) : [{ reps: 8, weightKg: '' }];
    setExercises((xs) => [...xs, { name: t?.name ?? clean, sets }]);
    setCustomName('');
  }

  const updateEx = (i: number, f: (e: ExIn) => ExIn) => setExercises((xs) => xs.map((e, j) => (j === i ? f(e) : e)));

  async function submit() {
    setError(undefined);
    try {
      const n = (v: NumIn) => (v === '' ? 0 : v);
      const gym: { exercises: GymExercise[] } | undefined =
        type === 'gym'
          ? { exercises: exercises.map((e) => ({ name: e.name, sets: e.sets.filter((s) => n(s.reps) > 0).map((s) => ({ reps: Math.round(n(s.reps)), weightKg: n(s.weightKg) })) })).filter((e) => e.sets.length > 0) }
          : undefined;
      const m: Match | undefined =
        type === 'match'
          ? {
              opponent: match.opponent.trim(),
              goalsFor: n(match.goalsFor),
              goalsAgainst: n(match.goalsAgainst),
              minutes: n(match.minutes),
              goals: n(match.goals),
              assists: n(match.assists),
              shots: n(match.shots),
              rating: match.rating,
              reflection: match.reflection,
            }
          : undefined;
      const saved = await saveSession({
        ...(session ? { id: session.id, createdAt: session.createdAt } : {}),
        date: day,
        type,
        durationMin: Math.round(n(duration)),
        rpe: rpe ?? 0,
        note,
        ...(m ? { match: m } : {}),
        ...(gym ? { gym } : {}),
        ...(type === 'gym' && split ? { split } : {}),
        ...(type === 'match' && bfvLink ? { bfv: bfvLink, bfvId: bfvLink.id } : {}),
      });
      let msg = `${sessionTitle(saved)} gespeichert · Load ${sessionLoad(saved.durationMin, saved.rpe)}`;
      if (saved.gym) {
        const all = await db.sessions.where('type').equals('gym').toArray();
        const prs = detectPRs(all).filter((p) => p.sessionId === saved.id);
        if (prs.length > 0) {
          const names = [...new Set(prs.map((p) => saved.gym?.exercises[p.exerciseIndex]?.name))].join(', ');
          msg = `Neue Bestleistung: ${names}`;
        }
      }
      toast(msg);
      close();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen');
    }
  }

  const load = typeof duration === 'number' && rpe ? sessionLoad(duration, rpe) : 0;

  return (
    <div className="form">
      <div className="chips" role="group" aria-label="Art der Einheit">
        {SESSION_TYPES.map((t) => (
          <button key={t} type="button" className="chip" aria-pressed={t === type} onClick={() => pickType(t)}>
            {SESSION_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="form-row">
        <TextField label="Datum" type="date" value={day} onValue={(v) => v && setDay(v)} />
        <NumberField label="Dauer (min)" value={duration} onValue={setDuration} min={1} max={600} />
      </div>

      <div className="field">
        <span className="field__label">
          Belastung (RPE) · <span className="mono accent">Load {load}</span>
        </span>
        <Scale label="RPE" value={rpe} min={1} max={10} onChange={(v) => setRpe(v)} fill />
        <span className="field__hint">1 = sehr leicht · 5 = fordernd · 10 = maximal</span>
      </div>

      {type === 'match' && (
        <>
          <SectionTitle>Spiel</SectionTitle>
          <TextField
            label="Gegner"
            value={match.opponent}
            onValue={(v) => setMatch({ ...match, opponent: v })}
            maxLength={80}
            placeholder="z. B. TSV Gräfelfing"
            hint={
              bfvLink
                ? `vom BFV · ${bfvLink.home ? 'Heimspiel' : 'Auswärtsspiel'} · Ergebnis und deine Werte trägst du selbst ein`
                : undefined
            }
          />
          <div className="form-row">
            <NumberField label="Tore wir" value={match.goalsFor} onValue={(v) => setMatch({ ...match, goalsFor: v })} min={0} max={99} />
            <NumberField label="Tore Gegner" value={match.goalsAgainst} onValue={(v) => setMatch({ ...match, goalsAgainst: v })} min={0} max={99} />
          </div>
          <div className="form-row form-row--3">
            <NumberField label="Minuten" value={match.minutes} onValue={(v) => setMatch({ ...match, minutes: v })} min={0} max={130} />
            <NumberField label="Tore" value={match.goals} onValue={(v) => setMatch({ ...match, goals: v })} min={0} max={20} />
            <NumberField label="Assists" value={match.assists} onValue={(v) => setMatch({ ...match, assists: v })} min={0} max={20} />
          </div>
          <NumberField label="Torschüsse" value={match.shots} onValue={(v) => setMatch({ ...match, shots: v })} min={0} max={50} />
          <div className="field">
            <span className="field__label">Eigene Note (1–10)</span>
            <Scale label="Note" value={match.rating} min={1} max={10} onChange={(v) => setMatch({ ...match, rating: v ?? 6 })} fill />
          </div>
          <TextArea label="Was lief gut, was nicht" value={match.reflection} onValue={(v) => setMatch({ ...match, reflection: v })} rows={3} maxLength={4000} />
        </>
      )}

      {type === 'gym' && (
        <>
          <div className="field" data-testid="gym-split">
            <span className="field__label">Split (optional)</span>
            <Segmented<GymSplit | ''>
              label="Split"
              value={split}
              onChange={(v) => setSplit(v === split ? '' : v)}
              options={GYM_SPLITS.map((x) => ({ value: x, label: GYM_SPLIT_LABEL[x] }))}
            />
          </div>
          <SectionTitle>Übungen</SectionTitle>
          {exercises.map((ex, i) => (
            <div key={i} className="card gym-ex" data-testid="gym-exercise">
              <div className="row row--between">
                <strong className="truncate">{ex.name}</strong>
                <IconButton icon={X} label={`${ex.name} entfernen`} onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))} />
              </div>
              <div className="gym-sets">
                <span className="xsmall faint">Satz</span>
                <span className="xsmall faint">Wdh.</span>
                <span className="xsmall faint">kg</span>
                <span />
                {ex.sets.map((s, k) => (
                  <SetRow
                    key={k}
                    index={k}
                    set={s}
                    onChange={(next) => updateEx(i, (e) => ({ ...e, sets: e.sets.map((x, m) => (m === k ? next : x)) }))}
                    onRemove={ex.sets.length > 1 ? () => updateEx(i, (e) => ({ ...e, sets: e.sets.filter((_, m) => m !== k) })) : undefined}
                  />
                ))}
              </div>
              <Button size="s" variant="ghost" icon={Plus} onClick={() => updateEx(i, (e) => ({ ...e, sets: [...e.sets, { ...(e.sets.at(-1) ?? { reps: 8, weightKg: '' }) }] }))}>
                Satz
              </Button>
            </div>
          ))}
          <div className="chips chips--scroll" aria-label="Übungsvorlagen">
            {templates
              ?.filter((t) => !exercises.some((e) => normalizeExercise(e.name) === normalizeExercise(t.name)))
              .map((t) => (
                <button key={t.id} type="button" className="chip" onClick={() => addExercise(t.name)}>
                  <Plus size={14} strokeWidth={1.75} aria-hidden /> {t.name}
                </button>
              ))}
          </div>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="grow">
              <TextField label="Neue Übung" value={customName} onValue={setCustomName} maxLength={60} placeholder="Name" onKeyDown={(e) => e.key === 'Enter' && addExercise(customName)} />
            </div>
            <Button variant="secondary" onClick={() => addExercise(customName)} disabled={!customName.trim()}>
              Hinzufügen
            </Button>
          </div>
        </>
      )}

      <TextArea label="Notiz" value={note} onValue={setNote} rows={2} maxLength={4000} />
      {error && <p className="field__error" role="alert">{error}</p>}
      <Button variant="primary" block onClick={() => void submit()} disabled={!rpe || duration === '' || duration <= 0}>
        Speichern
      </Button>
      {session && (
        <Button
          variant="warn"
          block
          icon={Trash2}
          onClick={() => {
            void deleteSession(session.id).then(() => {
              toast('Einheit gelöscht', { tone: 'warn' });
              close();
            });
          }}
        >
          Einheit löschen
        </Button>
      )}
    </div>
  );
}

function SetRow({ index, set, onChange, onRemove }: { index: number; set: SetIn; onChange: (s: SetIn) => void; onRemove: (() => void) | undefined }) {
  const parse = (v: string): NumIn => parseNumberDE(v) ?? '';
  return (
    <>
      <span className="mono faint">{index + 1}</span>
      <input className="input input--num" inputMode="numeric" aria-label={`Satz ${index + 1} Wiederholungen`} value={set.reps} onChange={(e) => onChange({ ...set, reps: parse(e.target.value) })} />
      <input className="input input--num" inputMode="decimal" aria-label={`Satz ${index + 1} Gewicht`} value={set.weightKg} onChange={(e) => onChange({ ...set, weightKg: parse(e.target.value) })} />
      {onRemove ? <IconButton icon={X} label={`Satz ${index + 1} entfernen`} onClick={onRemove} /> : <span />}
    </>
  );
}

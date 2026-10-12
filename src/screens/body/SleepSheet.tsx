import { useLiveQuery } from 'dexie-react-hooks';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteSleep, saveSleep, ValidationError } from '../../db/repo';
import type { HealthDay, Sleep } from '../../db/schemas';
import { sleepFromWallTimes, sleepMinutes } from '../../lib/calc/sleep';
import { formatHM, toTimeHM, type ISODate } from '../../lib/date';
import { Scale, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Button } from '../../ui/primitives';

/** Schlaf für einen Aufwachtag. Vorausgefüllt aus manuellem Eintrag oder Health-Import. */
export function SleepSheet({ date: initialDate, close }: { date: ISODate; close: () => void }) {
  const [date, setDate] = useState(initialDate);
  const existing = useLiveQuery(
    async () => ({ manual: await db.sleep.where('date').equals(date).first(), health: await db.health.get(date) }),
    [date],
  );
  if (!existing) return <div style={{ minHeight: 360 }} />;
  // key: beim Datumswechsel neu mit den Werten dieses Tages initialisieren
  return <SleepForm key={date} date={date} onDate={setDate} manual={existing.manual} health={existing.health} close={close} />;
}

function initialValues(manual: Sleep | undefined, health: HealthDay | undefined) {
  if (manual) return { bed: toTimeHM(manual.start), wake: toTimeHM(manual.end), quality: manual.quality, source: 'Gespeicherter Eintrag' };
  if (health?.sleepStart && health.sleepEnd) {
    return { bed: toTimeHM(health.sleepStart), wake: toTimeHM(health.sleepEnd), quality: undefined, source: 'Vorausgefüllt aus Health' };
  }
  return { bed: '23:00', wake: '07:00', quality: undefined, source: undefined };
}

function SleepForm({
  date,
  onDate,
  manual,
  health,
  close,
}: {
  date: ISODate;
  onDate: (d: ISODate) => void;
  manual: Sleep | undefined;
  health: HealthDay | undefined;
  close: () => void;
}) {
  const { toast } = useOverlay();
  const init = initialValues(manual, health);
  const [bed, setBed] = useState(init.bed);
  const [wake, setWake] = useState(init.wake);
  const [quality, setQuality] = useState<number | undefined>(init.quality);
  const [error, setError] = useState<string>();

  const valid = /^\d{2}:\d{2}$/.test(bed) && /^\d{2}:\d{2}$/.test(wake);
  const span = valid ? sleepFromWallTimes(date, bed, wake) : null;
  const preview = span ? sleepMinutes(span.start, span.end) : 0;

  async function submit() {
    try {
      await saveSleep(date, bed, wake, quality);
      toast(`Schlaf ${formatHM(preview)} h gespeichert`);
      close();
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen');
    }
  }

  return (
    <div className="form">
      <TextField label="Aufgewacht am" type="date" value={date} onValue={(v) => v && onDate(v)} />
      <div className="form-row">
        <TextField label="Bettzeit" type="time" value={bed} onValue={setBed} />
        <TextField label="Aufwachzeit" type="time" value={wake} onValue={setWake} />
      </div>
      <div className="row row--between">
        <span className="small muted">{init.source ?? 'Dauer'}</span>
        <span className="big big--s num" data-testid="sleep-preview">
          {formatHM(preview)}
          <span className="unit">h</span>
        </span>
      </div>
      <div className="field">
        <span className="field__label">Qualität</span>
        <Scale label="Schlafqualität" value={quality} onChange={setQuality} allowClear fill />
        <span className="field__hint">1 = schlecht · 5 = sehr erholsam</span>
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
      <Button variant="primary" block onClick={() => void submit()} disabled={!valid || preview <= 0}>
        Speichern
      </Button>
      {manual && (
        <Button variant="warn" block icon={Trash2} onClick={() => void deleteSleep(manual.id).then(close)}>
          Manuellen Eintrag löschen
        </Button>
      )}
    </div>
  );
}

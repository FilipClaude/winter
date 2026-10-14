import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteEarning, restoreRow, saveEarning, ValidationError } from '../../db/repo';
import type { Earning } from '../../db/schemas';
import { useSettings } from '../../hooks/useSettings';
import { centsToInput, formatEuro, formatEuroShort, parseEuroToCents, sumCents, weekOf } from '../../lib/calc/earnings';
import { useToday } from '../../hooks/useNow';
import { formatShort, formatWeekdayShort, isoWeekNumber, todayISO, type ISODate } from '../../lib/date';
import { TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { openEarningSheet } from './openEarning';
import { Button, Card, IconButton, ProgressBar } from '../../ui/primitives';

/** Betrag (deutsches Komma, „12,5“ → 12,50 €), Datum (Standard heute), kurze Notiz. Bearbeiten und Löschen. */
export function EarningSheet({ close, date, earning }: { close: () => void; date?: ISODate; earning?: Earning }) {
  const { toast } = useOverlay();
  const [amount, setAmount] = useState(earning ? centsToInput(earning.amountCents) : '');
  const [day, setDay] = useState<ISODate>(earning?.date ?? date ?? todayISO());
  const [note, setNote] = useState(earning?.note ?? '');
  const [error, setError] = useState('');
  const cents = amount.trim() === '' ? null : parseEuroToCents(amount);
  const invalid = amount.trim() !== '' && (cents === null || cents <= 0);
  return (
    <div className="form" data-testid="earning-sheet">
      <TextField
        label="Betrag (€)"
        value={amount}
        onValue={setAmount}
        inputMode="decimal"
        autoComplete="off"
        placeholder="z. B. 12,50"
        autoFocus={!earning}
        error={invalid ? 'Betrag in Euro, z. B. 12,5 oder 40' : undefined}
      />
      {cents !== null && cents > 0 && (
        <p className="xsmall muted" data-testid="earning-preview">
          = {formatEuro(cents)}
        </p>
      )}
      <div className="form-row">
        <TextField label="Datum" type="date" value={day} onValue={(v) => v && setDay(v)} />
        <TextField label="Notiz (optional)" value={note} onValue={setNote} maxLength={80} placeholder="z. B. Nachhilfe" />
      </div>
      {error && <p className="field__error">{error}</p>}
      <Button
        variant="primary"
        block
        disabled={cents === null || cents <= 0}
        onClick={() => {
          if (cents === null) return;
          void saveEarning({
            ...(earning ? { id: earning.id, createdAt: earning.createdAt, ...(earning.demo ? { demo: earning.demo } : {}) } : {}),
            date: day,
            amountCents: cents,
            ...(note.trim() ? { note: note.trim() } : {}),
          })
            .then((e) => {
              toast(`${formatEuro(e.amountCents)} ${earning ? 'gespeichert' : 'eingetragen'}`);
              close();
            })
            .catch((e: unknown) => setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen'));
        }}
      >
        Speichern
      </Button>
      {earning && (
        <Button
          variant="warn"
          block
          icon={Trash2}
          onClick={() =>
            void deleteEarning(earning.id).then((gone) => {
              toast(`${formatEuro(earning.amountCents)} gelöscht`, {
                tone: 'warn',
                ...(gone ? { action: { label: 'Rückgängig', run: () => void restoreRow('earnings', gone) } } : {}),
              });
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

/** Einträge einer Woche: Tap = bearbeiten, Mülleimer = löschen mit Rückgängig. */
export function EarningsList({ rows }: { rows: Earning[] }) {
  const { openSheet, toast } = useOverlay();
  const list = [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  if (list.length === 0) return <p className="small faint">Noch nichts eingetragen – über das Plus.</p>;
  return (
    <div className="list" data-testid="earnings-list">
      {list.map((e) => (
        <div key={e.id} className="list-item">
          <button type="button" className="grow list-row list-row--button" style={{ minHeight: 'var(--touch)' }} onClick={() => openEarningSheet(openSheet, { earning: e })}>
            <span className="list-item__title">{formatEuro(e.amountCents)}</span>
            <br />
            <span className="list-item__meta">
              {formatWeekdayShort(e.date)}, {formatShort(e.date)}
              {e.note ? ` · ${e.note}` : ''}
            </span>
          </button>
          <IconButton
            icon={Trash2}
            label={`${formatEuro(e.amountCents)} vom ${formatShort(e.date)} löschen`}
            onClick={() =>
              void deleteEarning(e.id).then((gone) =>
                toast(`${formatEuro(e.amountCents)} gelöscht`, {
                  tone: 'warn',
                  ...(gone ? { action: { label: 'Rückgängig', run: () => void restoreRow('earnings', gone) } } : {}),
                }),
              )
            }
          />
        </div>
      ))}
    </div>
  );
}

/** Sheet mit den Einträgen der Woche (aus der kleinen Widget-Variante). */
function EarningsWeekSheet({ from, to, date }: { from: ISODate; to: ISODate; date: ISODate }) {
  const { openSheet } = useOverlay();
  const rows = useLiveQuery(() => db.earnings.where('date').between(from, to, true, true).toArray(), [from, to]);
  if (!rows) return null;
  return (
    <div className="form" data-testid="earnings-week-sheet">
      <p className="big big--m num">{formatEuro(sumCents(rows, from, to))}</p>
      <EarningsList rows={rows} />
      <Button variant="primary" block icon={Plus} onClick={() => openEarningSheet(openSheet, { date })}>
        Verdienst eintragen
      </Button>
    </div>
  );
}

/**
 * Widget „Verdienst“: Summe der Woche (Mo–So) des angezeigten Tages, Fortschritt zum Wochenziel (nur mit
 * Ziel), Einträge der Woche – groß als Liste darunter, klein über „n Einträge“ im Sheet.
 */
export function EarningsWidget({ date, compact = false }: { date: ISODate; compact?: boolean }) {
  const settings = useSettings();
  const today = useToday();
  const { openSheet } = useOverlay();
  const week = weekOf(date);
  const loaded = useLiveQuery(() => db.earnings.where('date').between(week.from, week.to, true, true).toArray(), [week.from, week.to]);
  // Beim Laden gleiche Höhe wie leer (kein Layout-Sprung, Lighthouse-Fund)
  const rows = loaded ?? [];
  const goal = settings.earnings.weeklyGoalCents;
  const sum = sumCents(rows, week.from, week.to);
  const current = week.from === weekOf(today).from;
  const which = current ? 'diese Woche' : `KW ${isoWeekNumber(week.from)}`;
  return (
    <Card
      label="Verdienst"
      icon={Wallet}
      ariaLabel={`Verdienst ${which}`}
      testId="earnings-widget"
      action={<IconButton icon={Plus} label="Verdienst eintragen" variant="accent" onClick={() => openEarningSheet(openSheet, { date })} />}
    >
      <div className={compact ? 'big big--s num' : 'big big--m num'} data-testid="earnings-sum">
        {loaded ? formatEuro(sum) : ' '}
      </div>
      <div className="of earnings__of">
        {goal > 0 ? `von ${formatEuroShort(goal)}${compact ? '' : ` · ${which}`}` : which}
      </div>
      {goal > 0 && <ProgressBar value={sum / goal} label="Wochenziel Verdienst" />}
      {compact ? (
        rows.length > 0 && (
          <button
            type="button"
            className="btn btn--ghost btn--s earnings__more"
            data-testid="earnings-more"
            onClick={() => openSheet({ title: `Verdienst ${which}`, render: () => <EarningsWeekSheet from={week.from} to={week.to} date={date} /> })}
          >
            {rows.length} {rows.length === 1 ? 'Eintrag' : 'Einträge'}
          </button>
        )
      ) : (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <EarningsList rows={rows} />
        </div>
      )}
    </Card>
  );
}


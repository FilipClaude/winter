import { Check, Minus, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { formatNumberDE, parseNumberDE } from '../lib/number';
import { IconButton } from './primitives';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tap-Skala für Stimmung, Energie, RPE, Qualität. */
export function Scale({
  value,
  min = 1,
  max = 5,
  onChange,
  label,
  fill = false,
  allowClear = false,
}: {
  value: number | undefined;
  min?: number;
  max?: number;
  onChange: (v: number | undefined) => void;
  label: string;
  /** Werte unterhalb der Auswahl leicht füllen (Balkenwirkung). */
  fill?: boolean;
  allowClear?: boolean;
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="scale" role="group" aria-label={label}>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          aria-label={`${label} ${v}`}
          className={fill && value !== undefined && v < value ? 'scale__fill' : undefined}
          onClick={() => onChange(allowClear && v === value ? undefined : v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  label,
  children,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="stepper">
      <IconButton icon={Minus} label={`${label} verringern`} variant="outline" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} />
      <div className="stepper__value num" aria-live="polite">
        {children ?? value}
      </div>
      <IconButton icon={Plus} label={`${label} erhöhen`} variant="outline" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} />
    </div>
  );
}

/** Checkbox, die beim Abhaken kurz „einfriert“. */
export function FrostCheck({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const [freeze, setFreeze] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`frost-check ${freeze ? 'frost-check--freeze' : ''}`}
      onClick={() => {
        if (!checked) {
          setFreeze(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setFreeze(false), 560);
        }
        onChange(!checked);
      }}
    >
      <span className="frost-check__box">{checked && <Check size={16} strokeWidth={2.5} aria-hidden />}</span>
      <span className="frost-check__burst" aria-hidden>
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <i key={a} style={{ ['--a' as string]: `${a}deg` }} />
        ))}
      </span>
    </button>
  );
}

// ---------- Formularfelder ----------

function FieldShell({ label, hint, error, id, children }: { label: string; hint?: ReactNode; error?: string | undefined; id: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  onValue: (v: string) => void;
};

export function TextField({ label, hint, error, onValue, className, ...rest }: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <input id={id} className={`input ${className ?? ''}`} onChange={(e) => onValue(e.target.value)} {...rest} />
    </FieldShell>
  );
}

export function NumberField({
  label,
  value,
  onValue,
  hint,
  min,
  max,
  decimal,
  placeholder,
}: {
  label: string;
  value: number | '';
  onValue: (v: number | '') => void;
  hint?: ReactNode;
  min?: number;
  max?: number;
  decimal?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  // Eigener Textzustand: "42," muss beim Tippen stehen bleiben dürfen. type=number würde das deutsche
  // Komma (iOS-Dezimaltastatur) verwerfen – deshalb Text mit inputMode und eigener Prüfung.
  const [text, setText] = useState(value === '' ? '' : formatNumberDE(value));
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setText(value === '' ? '' : formatNumberDE(value));
  }
  const n = parseNumberDE(text);
  const error = text !== '' && (n === null || (min !== undefined && n < min) || (max !== undefined && n > max) || (!decimal && n !== null && !Number.isInteger(n)))
    ? `Bitte eine ${decimal ? 'Zahl' : 'ganze Zahl'}${min !== undefined && max !== undefined ? ` von ${min} bis ${max}` : ''} eingeben`
    : undefined;
  return (
    <FieldShell label={label} hint={hint} error={error} id={id}>
      <input
        id={id}
        className="input input--num"
        type="text"
        inputMode={decimal ? 'decimal' : 'numeric'}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          const parsed = parseNumberDE(raw);
          const next = raw.trim() === '' ? '' : parsed === null ? null : parsed;
          if (next !== null) {
            setShown(next);
            onValue(next);
          }
        }}
      />
    </FieldShell>
  );
}

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> & { label: string; onValue: (v: string) => void; hint?: ReactNode };

export function TextArea({ label, onValue, hint, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} id={id}>
      <textarea id={id} className="input" onChange={(e) => onValue(e.target.value)} {...rest} />
    </FieldShell>
  );
}

type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> & {
  label: string;
  options: { value: string; label: string }[];
  onValue: (v: string) => void;
};

export function SelectField({ label, options, onValue, ...rest }: SelectProps) {
  const id = useId();
  return (
    <FieldShell label={label} id={id}>
      <select id={id} className="input" onChange={(e) => onValue(e.target.value)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

import type { LucideIcon } from 'lucide-react';
import { ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Design-System v2: kleine, wiederverwendbare Bausteine mit einheitlichem Verhalten.
 * (Card, Button, Badge, EmptyState … liegen in primitives.tsx, Eingaben in controls.tsx.)
 */

/** Kennzahl mit Label, Einheit und optionalem Trend gegenüber einem Vergleichswert. */
export function StatTile({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  higherIsBetter = true,
  testId,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  /** Veränderung (z. B. gegenüber der Vorwoche). null = kein Vergleich möglich. */
  delta?: number | null;
  deltaLabel?: string;
  higherIsBetter?: boolean;
  testId?: string;
}) {
  const dir = delta === undefined || delta === null ? null : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const good = dir === null || dir === 'flat' ? null : (dir === 'up') === higherIsBetter;
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;
  return (
    <div className="stat-tile" data-testid={testId}>
      <span className="label">{label}</span>
      <span className="stat-tile__value num">
        {value}
        {unit && value !== '–' && <span className="unit">{unit}</span>}
      </span>
      {dir && (
        <span className={`stat-tile__delta ${good === false ? 'warn' : good ? 'accent' : 'faint'}`}>
          <Icon size={14} strokeWidth={1.75} aria-hidden />
          <span className="mono">{deltaLabel ?? String(delta)}</span>
        </span>
      )}
    </div>
  );
}

/** Kleiner Verlauf ohne Achsen (z. B. 7 Tage Schritte). null = Lücke. */
export function Sparkline({
  values,
  height = 28,
  label,
}: {
  values: (number | null)[];
  height?: number;
  label: string;
}) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2)
    return <span className="sparkline sparkline--empty" aria-label={`${label}: zu wenig Daten`} role="img" />;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const w = 100;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * w;
  const y = (v: number) => height - 2 - ((v - min) / Math.max(1e-9, max - min)) * (height - 4);
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
    pen = true;
  });
  const lastIdx = values.length - 1 - [...values].reverse().findIndex((v) => v !== null);
  const last = values[lastIdx];
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      height={height}
      role="img"
      aria-label={label}
    >
      <path d={d.trim()} className="sparkline__line" vectorEffect="non-scaling-stroke" />
      {typeof last === 'number' && <circle cx={x(lastIdx)} cy={y(last)} r={1.8} className="sparkline__dot" />}
    </svg>
  );
}

/** Listenzeile: Icon, Titel, Metazeile, rechts Wert/Aktion. Als Button, wenn onClick gesetzt ist. */
export function ListRow({
  icon: Icon,
  title,
  meta,
  right,
  onClick,
  chevron,
  testId,
  ariaLabel,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  testId?: string;
  ariaLabel?: string;
}) {
  const body = (
    <>
      {Icon && (
        <span className="list-item__icon">
          <Icon size={16} strokeWidth={1.5} aria-hidden />
        </span>
      )}
      <span className="grow list-row__text">
        <span className="list-item__title">{title}</span>
        {meta && <span className="list-item__meta">{meta}</span>}
      </span>
      {right}
      {chevron && <ChevronRight size={16} strokeWidth={1.5} className="faint" aria-hidden />}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="list-item list-row list-row--button"
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel}
    >
      {body}
    </button>
  ) : (
    <div className="list-item list-row" data-testid={testId}>
      {body}
    </div>
  );
}

/** Platzhalter beim Laden statt springendem Layout. */
export function Skeleton({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div
      className="skeleton"
      aria-busy="true"
      aria-label="Lädt"
      style={height ? { minHeight: height } : undefined}
    >
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton__line" style={{ width: `${92 - ((i * 23) % 40)}%` }} />
      ))}
    </div>
  );
}

/** Mehrere Skeleton-Karten für einen ganzen Screen. */
export function ScreenSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div className="screen" data-testid="screen-skeleton">
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="card">
          <Skeleton lines={i === 0 ? 4 : 2} />
        </div>
      ))}
    </div>
  );
}

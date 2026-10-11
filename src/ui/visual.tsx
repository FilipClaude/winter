import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Zahl, die bei Änderungen kurz hochzählt. */
export function NumberTicker({
  value,
  format = (n) => Math.round(n).toLocaleString('de-DE'),
  className = 'num',
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (reduce || from === value) {
      setShown(value);
      return;
    }
    const controls = animate(from, value, { duration: 0.45, ease: [0.2, 0.8, 0.2, 1], onUpdate: setShown });
    return () => controls.stop();
  }, [value, reduce]);
  return <span className={className}>{format(shown)}</span>;
}

/** Ruhiger Fortschrittsring. */
export function Ring({
  value,
  size = 148,
  stroke = 6,
  label,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <div
      className="ring"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${Math.round(v * 100)} %`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={1} />
        <circle
          className="ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ opacity: v === 0 ? 0 : 1 }}
        />
      </svg>
      <div className="ring__center">{children}</div>
    </div>
  );
}

import { useId, useState } from 'react';

/**
 * Tap-Bereiche über einem Chart: Ein Tap zeigt den exakten Wert als Tooltip (nochmal tippen = aus).
 * Für Screenreader ist jeder Punkt ein Button mit vollständiger Beschriftung.
 */
function ChartHits({ items }: { items: { label: string; text: string; full?: string }[] }) {
  // Auswahl gilt nur für genau diese Daten – beim Wechsel des Zeitraums verschwindet der Tooltip.
  const sig = items.map((i) => `${i.label}=${i.text}`).join('|');
  const [state, setState] = useState<{ sig: string; sel: number | null }>({ sig, sel: null });
  if (state.sig !== sig) setState({ sig, sel: null });
  const sel = state.sig === sig ? state.sel : null;
  const n = items.length;
  const cur = sel === null ? null : items[sel];
  const describe = (it: { label: string; text: string; full?: string }) =>
    it.full ?? `${it.label}: ${it.text}`;
  return (
    <>
      <div className="chart__hit">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            aria-label={describe(it)}
            aria-pressed={sel === i}
            onClick={() => setState({ sig, sel: sel === i ? null : i })}
          />
        ))}
      </div>
      {cur && sel !== null && (
        <span
          className="chart__tip mono"
          role="status"
          style={{ left: `${Math.min(88, Math.max(12, ((sel + 0.5) / n) * 100))}%` }}
        >
          {describe(cur)}
        </span>
      )}
    </>
  );
}

export interface BarDatum {
  label: string;
  value: number | null;
  /** hervorheben (z. B. heute, aktuelle Woche) */
  highlight?: boolean;
  /** Warnfarbe (z. B. Überlastung) */
  warn?: boolean;
  title?: string;
}

/** Schlankes Balkendiagramm. Optional mit Ziellinie. Nur Token-Farben. */
export function BarChart({
  data,
  height = 120,
  goal,
  goalLabel,
  format = (n) => String(Math.round(n)),
  label,
  showValues = false,
}: {
  data: BarDatum[];
  height?: number;
  goal?: number | undefined;
  goalLabel?: string;
  format?: (n: number) => string;
  label: string;
  showValues?: boolean;
}) {
  const w = 100;
  const top = showValues ? 14 : 6;
  const bottom = 18;
  const max = Math.max(1, goal ?? 0, ...data.map((d) => d.value ?? 0)) * 1.08;
  const plotH = height - top - bottom;
  const slot = w / Math.max(1, data.length);
  const bw = Math.min(slot * 0.5, 5);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  return (
    <figure className="chart" aria-label={label} role="group">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden>
        <line
          x1={0}
          x2={w}
          y1={top + plotH}
          y2={top + plotH}
          className="chart__axis"
          vectorEffect="non-scaling-stroke"
        />
        {goal !== undefined && goal > 0 && (
          <line
            x1={0}
            x2={w}
            y1={y(goal)}
            y2={y(goal)}
            className="chart__goal"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {data.map((d, i) => {
          const v = d.value ?? 0;
          const h = Math.max(d.value ? 1.5 : 0, (v / max) * plotH);
          const x = i * slot + (slot - bw) / 2;
          return (
            <rect
              key={i}
              x={x}
              y={top + plotH - h}
              width={bw}
              height={h}
              rx={Math.min(1.6, bw / 2)}
              className={`chart__bar ${d.highlight ? 'chart__bar--hi' : ''} ${d.warn ? 'chart__bar--warn' : ''}`}
            >
              <title>{d.title ?? `${d.label}: ${d.value === null ? '–' : format(v)}`}</title>
            </rect>
          );
        })}
      </svg>
      <ChartHits
        items={data.map((d) => ({
          label: d.label,
          text: d.value === null ? 'keine Daten' : format(d.value),
          // Eigener Titel (z. B. Spiel mit Ergebnis) wird vollständig gezeigt, nie zerschnitten.
          ...(d.title ? { full: d.title } : {}),
        }))}
      />
      <div
        className="chart__labels"
        style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}
        aria-hidden
      >
        {data.map((d, i) => (
          <span key={i} className={d.highlight ? 'hi' : undefined}>
            {showValues && d.value !== null && <b>{format(d.value)}</b>}
            {d.label}
          </span>
        ))}
      </div>
      {goal !== undefined && goal > 0 && goalLabel && (
        <figcaption className="chart__caption">– – {goalLabel}</figcaption>
      )}
    </figure>
  );
}

const formatChartNumber = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

/** Linienverlauf (z. B. Stimmung). null = Lücke. */
export function LineChart({
  data,
  min,
  max,
  height = 110,
  label,
  secondary,
}: {
  data: { label: string; value: number | null }[];
  min: number;
  max: number;
  height?: number;
  label: string;
  secondary?: { value: number | null }[];
}) {
  const gid = useId();
  const w = 100;
  const top = 8;
  const bottom = 18;
  const plotH = height - top - bottom;
  const n = Math.max(1, data.length - 1);
  const x = (i: number) => (data.length === 1 ? w / 2 : (i / n) * w);
  const y = (v: number) => top + plotH - ((v - min) / Math.max(1e-9, max - min)) * plotH;
  const path = (vals: (number | null)[]) => {
    let d = '';
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
      pen = true;
    });
    return d.trim();
  };
  const main = data.map((d) => d.value);
  const area = (() => {
    const pts = main.map((v, i) => (v === null ? null : ([x(i), y(v)] as const))).filter((p) => p !== null);
    if (pts.length < 2) return '';
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (!first || !last) return '';
    return `M${first[0]},${top + plotH} ${pts.map((p) => `L${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')} L${last[0]},${top + plotH} Z`;
  })();
  const step = Math.ceil(data.length / 7);
  return (
    <figure className="chart" aria-label={label} role="group">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" className="chart__area-stop" stopOpacity={0.22} />
            <stop offset="1" className="chart__area-stop" stopOpacity={0} />
          </linearGradient>
        </defs>
        {[min, (min + max) / 2, max].map((v) => (
          <line
            key={v}
            x1={0}
            x2={w}
            y1={y(v)}
            y2={y(v)}
            className="chart__grid"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {area && <path d={area} fill={`url(#${gid})`} />}
        {secondary && (
          <path
            d={path(secondary.map((s) => s.value))}
            className="chart__line chart__line--2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path d={path(main)} className="chart__line" vectorEffect="non-scaling-stroke" />
      </svg>
      <ChartHits
        items={data.map((d, i) => ({
          label: d.label,
          text:
            d.value === null
              ? 'keine Daten'
              : `${formatChartNumber(d.value)}${typeof secondary?.[i]?.value === 'number' ? ` · ${formatChartNumber(secondary[i]?.value ?? 0)}` : ''}`,
        }))}
      />
      <div
        className="chart__labels"
        style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}
        aria-hidden
      >
        {data.map((d, i) => (
          <span key={i}>{i % step === 0 ? d.label : ''}</span>
        ))}
      </div>
    </figure>
  );
}

/** Heatmap im GitHub-Stil, Spalten = Wochen (Mo oben). level 0–4 in Eisblau-Abstufungen. */
export function Heatmap({
  weeks,
  label,
}: {
  weeks: { date: string; level: 0 | 1 | 2 | 3 | 4 | null; title: string }[][];
  label: string;
}) {
  return (
    <div className="heatmap" role="img" aria-label={label}>
      {weeks.map((week, i) => (
        <div key={i} className="heatmap__col">
          {week.map((d) => (
            <i
              key={d.date}
              className={d.level === null ? 'heatmap__cell heatmap__cell--off' : `heatmap__cell l${d.level}`}
              title={d.title}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

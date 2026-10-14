import { useLiveQuery } from 'dexie-react-hooks';
import { Wallet } from 'lucide-react';
import { db } from '../../db/db';
import type { Earning } from '../../db/schemas';
import { useToday } from '../../hooks/useNow';
import { useSettings } from '../../hooks/useSettings';
import { formatEuro, formatEuroShort, sumCents, weekOf, weeklyTotals } from '../../lib/calc/earnings';
import { addDays, formatDayMonth, isoWeekNumber, type ISODate } from '../../lib/date';
import { BarChart } from '../../ui/charts';
import { Card } from '../../ui/primitives';
import { EarningsList, EarningsWidget } from '../today/Earnings';

/** Wochensummen der letzten 8 Wochen als Balken, mit Ziellinie (Rückblick und Alltag → Verdienst). */
export function EarningsWeeks({ rows, today, goal }: { rows: Earning[]; today: ISODate; goal: number }) {
  const weeks = weeklyTotals(rows, today, 8);
  const total = weeks.reduce((a, w) => a + w.cents, 0);
  return (
    <Card label="Verdienst · 8 Wochen" icon={Wallet} ariaLabel="Verdienst der letzten 8 Wochen" testId="earnings-weeks">
      <BarChart
        label="Verdienst pro Woche in Euro"
        data={weeks.map((w, i) => ({ label: `KW ${w.kw}`, value: w.cents / 100, highlight: i === weeks.length - 1 }))}
        {...(goal > 0 ? { goal: goal / 100, goalLabel: `Ziel ${formatEuroShort(goal)}` } : {})}
        format={(n) => formatEuroShort(Math.round(n * 100))}
        height={90}
      />
      <p className="xsmall faint" style={{ marginTop: 'var(--space-2)' }}>
        Zusammen {formatEuro(total)} · Ø {formatEuro(Math.round(total / weeks.length))} pro Woche
      </p>
    </Card>
  );
}

/** Höchstens so viele Wochen listet die Übersicht (ältere bleiben in Backup und Rückblick). */
const HISTORY_WEEKS = 26;

/** Alltag → Verdienst: diese Woche, 8-Wochen-Verlauf und alle Einträge nach Wochen (auch ältere bearbeiten). */
export function EarningsPanel() {
  const today = useToday();
  const settings = useSettings();
  const rows = useLiveQuery(() => db.earnings.toArray(), []);
  if (!rows) return null;
  const byWeek = new Map<ISODate, Earning[]>();
  for (const r of rows) {
    const from = weekOf(r.date).from;
    byWeek.set(from, [...(byWeek.get(from) ?? []), r]);
  }
  const weeks = [...byWeek.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, HISTORY_WEEKS);
  return (
    <>
      <EarningsWidget date={today} />
      {rows.length > 0 && <EarningsWeeks rows={rows} today={today} goal={settings.earnings.weeklyGoalCents} />}
      {weeks
        .filter(([from]) => from !== weekOf(today).from)
        .map(([from, list]) => (
          <Card key={from} label={`KW ${isoWeekNumber(from)} · ${formatDayMonth(from)}–${formatDayMonth(addDays(from, 6))}`} ariaLabel={`Verdienst KW ${isoWeekNumber(from)}`}
            testId="earnings-week"
            action={<span className="num">{formatEuro(sumCents(list, from, addDays(from, 6)))}</span>}
          >
            <EarningsList rows={list} />
          </Card>
        ))}
    </>
  );
}

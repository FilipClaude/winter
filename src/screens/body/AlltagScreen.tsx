import { useLiveQuery } from 'dexie-react-hooks';
import { Footprints, HeartPulse, Moon } from 'lucide-react';
import { db } from '../../db/db';
import { useKV, useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { formatDecimal } from '../../lib/calc/insights';
import { effectiveSleep } from '../../lib/calc/sleep';
import { addDays, dateRange, formatDE, formatHM, formatShort, formatWeekdayShort, toISODate, toTimeHM } from '../../lib/date';
import { BarChart } from '../../ui/charts';
import { Segmented } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Button, Card, EmptyState, ScreenHeader, Stat } from '../../ui/primitives';
import { navigate } from '../../router';
import { openHealthSheet } from '../health/openHealth';
import { HabitsPanel } from '../habits/HabitsPanel';
import { EarningsPanel } from './EarningsPanel';
import { SleepSheet } from './SleepSheet';

type Tab = 'habits' | 'schlaf' | 'health' | 'verdienst';
const TABS: Tab[] = ['habits', 'schlaf', 'health', 'verdienst'];

/**
 * v3: Tab „Alltag“ = Habits, Schlaf, Health und Verdienst (bis v2 „Körper“ mit Ernährung und der
 * Habits-Screen ohne eigenen Tab). DECISIONS #96.
 */
export default function AlltagScreen({ tab: param }: { tab?: string | undefined }) {
  const tab: Tab = TABS.find((t) => t === param) ?? 'habits';
  const setTab = (t: Tab) => navigate('alltag', t);
  return (
    <div className="screen">
      <ScreenHeader eyebrow="Gewohnheiten, Erholung, Geld" />
      <h1 className="screen-title">Alltag</h1>
      <Segmented<Tab>
        label="Bereich"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'habits', label: 'Habits' },
          { value: 'schlaf', label: 'Schlaf' },
          { value: 'health', label: 'Health' },
          { value: 'verdienst', label: 'Verdienst' },
        ]}
      />
      {tab === 'habits' && <HabitsPanel />}
      {tab === 'schlaf' && <SleepPanel />}
      {tab === 'health' && <HealthPanel />}
      {tab === 'verdienst' && <EarningsPanel />}
    </div>
  );
}

// ---------- Schlaf ----------

function SleepPanel() {
  const today = useToday();
  const settings = useSettings();
  const { openSheet } = useOverlay();
  const from = addDays(today, -13);
  const data = useLiveQuery(async () => {
    const [manual, health] = await Promise.all([db.sleep.where('date').between(from, today, true, true).toArray(), db.health.where('date').between(from, today, true, true).toArray()]);
    return { manual, health };
  }, [from, today]);
  if (!data) return null;
  const days = dateRange(from, today);
  const nights = days.map((d) => ({ date: d, sleep: effectiveSleep(data.manual.find((m) => m.date === d), data.health.find((h) => h.date === d)) }));
  const last = [...nights].reverse().find((n) => n.sleep);
  const recorded = nights.filter((n) => n.sleep);
  const avg = recorded.length > 0 ? recorded.reduce((a, n) => a + (n.sleep?.minutes ?? 0), 0) / recorded.length : null;
  const q = recorded.map((n) => n.sleep?.quality).filter((x) => x !== undefined);
  const avgQ = q.length > 0 ? q.reduce((a, b) => a + b, 0) / q.length : null;

  return (
    <>
      <Card label="Letzte Nacht" icon={Moon} ariaLabel="Letzte Nacht" action={<Button variant="secondary" size="s" onClick={() => openSheet({ title: 'Schlaf', render: (close) => <SleepSheet date={today} close={close} /> })}>Eintragen</Button>}>
        {last?.sleep ? (
          <div className="row row--between" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="big num">
                {formatHM(last.sleep.minutes)}
                <span className="unit">h</span>
              </div>
              <div className="xsmall faint mono" style={{ marginTop: 4 }}>
                {toTimeHM(last.sleep.start)}–{toTimeHM(last.sleep.end)} · {last.date === today ? 'heute' : formatShort(last.date)}
              </div>
            </div>
            <Badge tone={last.sleep.source === 'health' ? 'muted' : 'accent'}>{last.sleep.source === 'health' ? 'Health' : 'manuell'}</Badge>
          </div>
        ) : (
          <EmptyState icon={Moon} title="Noch kein Schlaf erfasst">
            Bett- und Aufwachzeit eintragen oder per Health-Import übernehmen.
          </EmptyState>
        )}
      </Card>
      <Card label="14 Nächte" ariaLabel="Schlaf der letzten 14 Nächte">
        <BarChart
          label="Schlafdauer pro Nacht"
          data={nights.map((n) => ({ label: n.date.slice(8), value: n.sleep ? n.sleep.minutes / 60 : null, highlight: n.date === today }))}
          goal={settings.goals.sleepH}
          goalLabel={`Ziel ${formatDecimal(settings.goals.sleepH, 1)} h`}
          format={(n) => `${formatDecimal(n, 1)} h`}
        />
        <div className="grid-2" style={{ marginTop: 'var(--space-4)' }}>
          <Stat value={avg === null ? '–' : formatHM(avg)} unit="h" label="Schnitt" />
          <Stat value={formatDecimal(avgQ, 1)} label="Ø Qualität (1–5)" />
        </div>
      </Card>
      <Card ariaLabel="Schlafeinträge">
        <div className="list">
          {[...nights].reverse().filter((n) => n.sleep).slice(0, 10).map((n) => (
            <button key={n.date} type="button" className="list-item" onClick={() => openSheet({ title: 'Schlaf', render: (close) => <SleepSheet date={n.date} close={close} /> })}>
              <span className="grow">
                <span className="list-item__title">
                  {formatWeekdayShort(n.date)}, {formatShort(n.date)}
                </span>
                <br />
                <span className="list-item__meta mono">
                  {n.sleep && `${toTimeHM(n.sleep.start)}–${toTimeHM(n.sleep.end)}`}
                  {n.sleep?.quality ? ` · Qualität ${n.sleep.quality}` : ''}
                </span>
              </span>
              <span className="num">{n.sleep && formatHM(n.sleep.minutes)}</span>
            </button>
          ))}
          {recorded.length === 0 && <p className="small faint">Keine Einträge in den letzten 14 Tagen.</p>}
        </div>
      </Card>
    </>
  );
}

// ---------- Health ----------

function HealthPanel() {
  const today = useToday();
  const settings = useSettings();
  const { openSheet } = useOverlay();
  const lastImport = useKV<string>('lastHealthImport');
  const from = addDays(today, -13);
  const rows = useLiveQuery(() => db.health.where('date').between(from, today, true, true).toArray(), [from, today]);
  if (!rows) return null;
  const days = dateRange(from, today);
  const byDay = new Map(rows.map((r) => [r.date, r]));
  const withSteps = rows.filter((r) => r.steps !== undefined);
  const avgSteps = withSteps.length > 0 ? withSteps.reduce((a, r) => a + (r.steps ?? 0), 0) / withSteps.length : null;

  return (
    <>
      <Card
        label="Apple Health"
        icon={HeartPulse}
        ariaLabel="Health-Import"
        action={
          <Button variant="primary" size="s" onClick={() => openHealthSheet(openSheet, settings.shortcutName)}>
            Health holen
          </Button>
        }
      >
        <p className="small muted">
          Letzter Import: {lastImport ? `${formatDE(toISODate(lastImport))}, ${toTimeHM(lastImport)} Uhr` : 'noch nie'}
        </p>
      </Card>
      <Card label="Schritte · 14 Tage" icon={Footprints} ariaLabel="Schritte der letzten 14 Tage">
        <BarChart
          label="Schritte pro Tag"
          data={days.map((d) => ({ label: d.slice(8), value: byDay.get(d)?.steps ?? null, highlight: d === today }))}
          goal={settings.goals.steps}
          goalLabel={`Ziel ${settings.goals.steps.toLocaleString('de-DE')}`}
          format={(n) => Math.round(n).toLocaleString('de-DE')}
        />
        <div className="grid-2" style={{ marginTop: 'var(--space-4)' }}>
          <Stat value={avgSteps === null ? '–' : Math.round(avgSteps).toLocaleString('de-DE')} label="Ø Schritte" />
          <Stat value={formatDecimal(withSteps.length ? rows.reduce((a, r) => a + (r.distanceKm ?? 0), 0) : null, 1)} unit="km" label="Strecke gesamt" />
        </div>
      </Card>
      <Card ariaLabel="Health-Verlauf">
        {rows.length === 0 ? (
          <EmptyState icon={HeartPulse} title="Noch keine Health-Daten">
            Kurzbefehl einrichten (Anleitung: HEALTH-SHORTCUT.md) und „Health holen“ tippen.
          </EmptyState>
        ) : (
          <div className="list">
            {[...rows].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <div key={r.date} className="list-item">
                <span className="grow">
                  <span className="list-item__title">
                    {formatWeekdayShort(r.date)}, {formatShort(r.date)}
                  </span>
                  <br />
                  <span className="list-item__meta">
                    {[r.distanceKm !== undefined && `${formatDecimal(r.distanceKm, 1)} km`, r.flights !== undefined && `${r.flights} Stockwerke`, r.sleepStart && r.sleepEnd && `Schlaf ${toTimeHM(r.sleepStart)}–${toTimeHM(r.sleepEnd)}`].filter(Boolean).join(' · ') || '–'}
                  </span>
                </span>
                <span className="num">{r.steps?.toLocaleString('de-DE') ?? '–'}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

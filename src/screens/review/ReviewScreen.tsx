import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarRange, ChevronLeft, ChevronRight, ClipboardCopy, FileText, Lightbulb, Share2, TrendingUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import type { Goal } from '../../db/schemas';
import { useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { formatDecimal } from '../../lib/calc/insights';
import { buildInsights, dailySeries, periodSummary, type PeriodSummary, type ReviewData } from '../../lib/calc/review';
import { seasonOf, seasonRange, seasonStats } from '../../lib/calc/training';
import { metricValue, movingAverage, previousRange, TREND_LABEL, yearHeatmap, type TrendMetric } from '../../lib/calc/trends';
import { weeklyFileName, weeklyMarkdown, weeklyReport, type Kpi } from '../../lib/calc/weekly';
import {
  addDays,
  diffDays,
  endOfMonth,
  formatDayMonth,
  formatDE,
  formatHM,
  formatMinutes,
  formatMonth,
  formatWeekdayShort,
  isoWeekNumber,
  startOfMonth,
  startOfWeek,
  type ISODate,
} from '../../lib/date';
import { copyText, saveFile } from '../../lib/download';
import { BarChart, Heatmap, LineChart } from '../../ui/charts';
import { Segmented, TextField } from '../../ui/controls';
import { StatTile } from '../../ui/kit';
import { useOverlay } from '../../ui/overlay-context';
import { Button, Card, EmptyState, IconButton, ScreenHeader, SectionTitle, Stat } from '../../ui/primitives';

type Period = 'woche' | 'monat' | 'frei';

function range(period: 'woche' | 'monat', today: ISODate, offset: number): { from: ISODate; to: ISODate; label: string } {
  if (period === 'woche') {
    const from = addDays(startOfWeek(today), 7 * offset);
    const to = addDays(from, 6);
    return { from, to, label: `KW ${isoWeekNumber(from)} · ${formatDayMonth(from)}–${formatDayMonth(to)}` };
  }
  let m = startOfMonth(today);
  for (let i = 0; i < Math.abs(offset); i++) m = offset < 0 ? startOfMonth(addDays(m, -1)) : addDays(endOfMonth(m), 1);
  return { from: m, to: endOfMonth(m), label: formatMonth(m) };
}

export default function ReviewScreen() {
  const today = useToday();
  const settings = useSettings();
  const [period, setPeriod] = useState<Period>('woche');
  const [offset, setOffset] = useState(0);
  const [custom, setCustom] = useState({ from: addDays(today, -29), to: today });
  const data = useLiveQuery(async () => {
    const [sessions, meals, days, sleep, health, study, exams, habits, checks, goals] = await Promise.all([
      db.sessions.toArray(),
      db.meals.toArray(),
      db.days.toArray(),
      db.sleep.toArray(),
      db.health.toArray(),
      db.studySessions.toArray(),
      db.exams.toArray(),
      db.habits.toArray(),
      db.habitChecks.toArray(),
      db.goals.toArray(),
    ]);
    return { review: { sessions, meals, days, sleep, health, study, exams, habits, checks } satisfies ReviewData, goals };
  }, []);

  const r =
    period === 'frei'
      ? { from: custom.from <= custom.to ? custom.from : custom.to, to: custom.to >= custom.from ? custom.to : custom.from, label: '' }
      : range(period, today, offset);
  const to = r.to > today ? today : r.to;

  return (
    <div className="screen">
      <ScreenHeader eyebrow="Woche · Monat · Trends · Zusammenhänge" />
      <h1 className="screen-title">Rückblick</h1>
      <Segmented<Period>
        label="Zeitraum"
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setOffset(0);
        }}
        options={[
          { value: 'woche', label: 'Woche' },
          { value: 'monat', label: 'Monat' },
          { value: 'frei', label: 'Frei' },
        ]}
      />
      {period === 'frei' ? (
        <div className="form-row" data-testid="custom-range">
          <TextField label="Von" type="date" value={custom.from} max={today} onValue={(v) => v && setCustom({ ...custom, from: v })} />
          <TextField label="Bis" type="date" value={custom.to} max={today} onValue={(v) => v && setCustom({ ...custom, to: v })} />
        </div>
      ) : (
        <div className="period-nav">
          <IconButton icon={ChevronLeft} label="Vorheriger Zeitraum" onClick={() => setOffset(offset - 1)} />
          <span className="period-nav__label" data-testid="period-label">
            {r.label}
          </span>
          <IconButton icon={ChevronRight} label="Nächster Zeitraum" disabled={offset >= 0} onClick={() => setOffset(offset + 1)} />
        </div>
      )}
      {data && r.from <= today ? (
        <PeriodView data={data.review} from={r.from} to={to} label={period === 'monat' ? 'day' : 'weekday'} sleepGoal={settings.goals.sleepH} />
      ) : null}
      {data && period === 'woche' && r.from <= today && <WeekReportCard data={data.review} goals={data.goals} weekStart={r.from} today={today} />}
      {data && <Trends data={data.review} today={today} />}
      {data && <Insights data={data.review} today={today} />}
      {data && <Season data={data.review} today={today} />}
    </div>
  );
}

// ---------- Kennzahlen mit Vergleich ----------

function deltaKpis(s: PeriodSummary, p: PeriodSummary) {
  const d = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);
  return {
    study: d(s.studyMin / 60, p.studyMin / 60),
    load: d(s.load, p.load),
    sleep: d(s.sleepAvgMin === null ? null : s.sleepAvgMin / 60, p.sleepAvgMin === null ? null : p.sleepAvgMin / 60),
    protein: d(s.proteinAvg, p.proteinAvg),
    habits: d(s.habitRate === null ? null : s.habitRate * 100, p.habitRate === null ? null : p.habitRate * 100),
    mood: d(s.moodAvg, p.moodAvg),
  };
}

const signed = (n: number | null, digits: number, unit = '') =>
  n === null ? '' : `${n > 0 ? '+' : n < 0 ? '−' : '±'}${formatDecimal(Math.abs(n), digits)}${unit ? ` ${unit}` : ''}`;

function PeriodView({ data, from, to, label: labelMode, sleepGoal }: { data: ReviewData; from: ISODate; to: ISODate; label: 'day' | 'weekday'; sleepGoal: number }) {
  const s = periodSummary(data, from, to);
  const prev = previousRange(from, to);
  const p = periodSummary(data, prev.from, prev.to);
  const dk = deltaKpis(s, p);
  const series = dailySeries(data, from, to);
  const long = diffDays(from, to) > 31;
  const label = (d: ISODate) => (labelMode === 'weekday' && !long ? formatWeekdayShort(d) : formatDayMonth(d).slice(0, long ? 5 : 2));
  const hasAny = series.some((d) => d.studyMin > 0 || d.load > 0 || d.sleepMin !== null || d.mood !== null || d.proteinG !== null);

  return (
    <>
      <Card ariaLabel="Kennzahlen" testId="review-stats">
        <div className="stat-grid">
          <StatTile label="Lernzeit" value={formatHM(s.studyMin)} unit="h" delta={dk.study} deltaLabel={signed(dk.study, 1, 'h')} />
          <StatTile label={`Load · ${s.sessions} Einh.`} value={s.load.toLocaleString('de-DE')} delta={dk.load} deltaLabel={signed(dk.load, 0)} />
          <StatTile label="Ø Schlaf" value={s.sleepAvgMin === null ? '–' : formatHM(s.sleepAvgMin)} unit="h" delta={dk.sleep} deltaLabel={signed(dk.sleep, 1, 'h')} />
          <StatTile label="Ø Protein" value={s.proteinAvg === null ? '–' : Math.round(s.proteinAvg)} unit="g" delta={dk.protein} deltaLabel={signed(dk.protein, 0, 'g')} />
          <StatTile label="Habit-Quote" value={s.habitRate === null ? '–' : Math.round(s.habitRate * 100)} unit="%" delta={dk.habits} deltaLabel={signed(dk.habits, 0, '%')} />
          <StatTile label="Ø Stimmung" value={formatDecimal(s.moodAvg, 1)} delta={dk.mood} deltaLabel={signed(dk.mood, 1)} />
        </div>
        <p className="xsmall faint" style={{ marginTop: 'var(--space-3)' }}>
          Pfeile: Vergleich mit {formatDE(prev.from)} – {formatDE(prev.to)} (gleich lang davor).
        </p>
      </Card>
      {!hasAny ? (
        <Card ariaLabel="Keine Daten">
          <EmptyState icon={Lightbulb} title="Keine Daten in diesem Zeitraum">
            Sobald du Einträge machst, erscheinen hier Verläufe. Demo-Daten gibt es in den Einstellungen.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card label="Stimmung & Energie" ariaLabel="Stimmungsverlauf">
            <LineChart
              label="Stimmung (Linie) und Energie (gestrichelt), 1 bis 5"
              data={series.map((d) => ({ label: label(d.date), value: d.mood }))}
              secondary={series.map((d) => ({ value: d.energy }))}
              min={1}
              max={5}
            />
            <p className="xsmall faint" style={{ marginTop: 6 }}>
              Linie Stimmung · gestrichelt Energie · Ø Energie {formatDecimal(s.energyAvg, 1)}
            </p>
          </Card>
          <Card label="Lernzeit" ariaLabel="Lernzeit-Verlauf">
            <BarChart label="Lernzeit pro Tag in Stunden" data={series.map((d) => ({ label: label(d.date), value: d.studyMin / 60 }))} format={(n) => `${formatDecimal(n, 1)} h`} height={90} />
            <p className="xsmall faint" style={{ marginTop: 6 }}>
              Gesamt {formatMinutes(s.studyMin)}
            </p>
          </Card>
          <Card label="Trainingslast" ariaLabel="Trainingslast-Verlauf">
            <BarChart label="Load pro Tag" data={series.map((d) => ({ label: label(d.date), value: d.load }))} height={90} />
          </Card>
          <Card label="Schlaf" ariaLabel="Schlaf-Verlauf">
            <BarChart
              label="Schlaf pro Nacht in Stunden"
              data={series.map((d) => ({ label: label(d.date), value: d.sleepMin === null ? null : d.sleepMin / 60 }))}
              goal={sleepGoal}
              goalLabel={`Ziel ${formatDecimal(sleepGoal, 1)} h`}
              format={(n) => `${formatDecimal(n, 1)} h`}
              height={90}
            />
          </Card>
        </>
      )}
    </>
  );
}

// ---------- Wochenbericht ----------

function WeekReportCard({ data, goals, weekStart, today }: { data: ReviewData; goals: Goal[]; weekStart: ISODate; today: ISODate }) {
  const { toast } = useOverlay();
  const r = weeklyReport(data, weekStart, today, goals);
  const md = weeklyMarkdown(r);
  const tile = (k: Kpi) => (
    <StatTile
      key={k.key}
      label={k.label}
      value={k.value === null ? '–' : formatDecimal(k.value, k.digits)}
      unit={k.unit}
      delta={k.delta}
      deltaLabel={signed(k.delta, k.digits, k.unit)}
      higherIsBetter={k.higherIsBetter}
    />
  );
  return (
    <Card label={`Wochenbericht KW ${r.kw}`} icon={FileText} ariaLabel="Wochenbericht" testId="week-report">
      {!r.complete && <p className="small muted" style={{ marginBottom: 'var(--space-3)' }}>Läuft noch – fertig am Sonntag ({formatDE(r.weekEnd)}).</p>}
      {r.empty ? (
        <p className="small faint">Keine Einträge in dieser Woche.</p>
      ) : (
        <div className="stack">
          <div className="stat-grid">{r.kpis.slice(0, 6).map(tile)}</div>
          {r.highlights.length > 0 && (
            <div>
              <SectionTitle>Highlights</SectionTitle>
              <ul className="report-list">
                {r.highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {r.outliers.length > 0 && (
            <div>
              <SectionTitle>Ausreißer</SectionTitle>
              <ul className="report-list report-list--warn">
                {r.outliers.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          {r.goals.length > 0 && (
            <div>
              <SectionTitle>Ziele</SectionTitle>
              <ul className="report-list">
                {r.goals.map((g) => (
                  <li key={g.label} className={g.reached ? 'accent' : ''}>
                    {g.reached ? '✓' : '○'} {g.label}: {g.value} von {g.target}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="row">
            <Button
              variant="secondary"
              size="s"
              icon={Share2}
              data-testid="week-report-file"
              onClick={() => void saveFile(weeklyFileName(r), md, 'text/markdown').then((res) => res !== 'abgebrochen' && toast(`${weeklyFileName(r)} ${res}`))}
            >
              Für Obsidian
            </Button>
            <Button
              variant="ghost"
              size="s"
              icon={ClipboardCopy}
              onClick={() => void copyText(md).then((ok) => toast(ok ? 'Markdown kopiert' : 'Kopieren nicht möglich', ok ? undefined : { tone: 'warn' }))}
            >
              Kopieren
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------- Trends ----------

const TREND_METRICS: TrendMetric[] = ['studyMin', 'load', 'sleepMin', 'mood', 'steps', 'proteinG'];

function Trends({ data, today }: { data: ReviewData; today: ISODate }) {
  const [metric, setMetric] = useState<TrendMetric>('studyMin');
  const meta = TREND_LABEL[metric];
  const from = addDays(today, -89);
  // 28 Tage Vorlauf, damit der 28-Tage-Schnitt schon am Anfang des Fensters gilt
  const series = dailySeries(data, addDays(from, -27), today);
  const values = series.map((d) => {
    const v = metricValue(d, metric);
    return v === null ? null : meta.scale(v);
  });
  // Anzeige ab dem ersten Tag mit Wert (höchstens 90 Tage) – sonst wäre der Großteil leer.
  const firstWithData = values.findIndex((v, i) => i >= 27 && v !== null && v !== 0);
  const start = firstWithData < 0 ? 27 : Math.max(27, Math.min(firstWithData, values.length - 14));
  const ma7 = movingAverage(values, 7).slice(start);
  const ma28 = movingAverage(values, 28).slice(start);
  const shown = series.slice(start);
  const nums = [...ma7, ...ma28].filter((v): v is number => v !== null);
  const year = yearHeatmap(dailySeries(data, addDays(today, -380), today), metric, today);
  const hasYear = year.flat().some((c) => (c.level ?? 0) > 0);
  return (
    <>
      <SectionTitle>Trends</SectionTitle>
      <Card label="Gleitende Durchschnitte · bis 90 Tage" icon={TrendingUp} ariaLabel="Trends" testId="trends">
        <div className="chips chips--scroll" role="group" aria-label="Kennzahl für Trends">
          {TREND_METRICS.map((m) => (
            <button key={m} type="button" className="chip" aria-pressed={metric === m} onClick={() => setMetric(m)}>
              {TREND_LABEL[m].label}
            </button>
          ))}
        </div>
        {nums.length === 0 ? (
          <p className="small faint" style={{ marginTop: 'var(--space-3)' }}>
            Zu wenig Daten für {meta.label}-Trends (nötig: mindestens 4 Tage mit Werten in einer Woche).
          </p>
        ) : (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <LineChart
              label={`${meta.label}: 7-Tage-Schnitt (Linie) und 28-Tage-Schnitt (gestrichelt)`}
              data={shown.map((d, i) => ({ label: formatDayMonth(d.date).slice(0, 5), value: ma7[i] ?? null }))}
              secondary={ma28.map((v) => ({ value: v }))}
              min={Math.max(0, Math.min(...nums) * 0.9)}
              max={Math.max(...nums) * 1.05 || 1}
              height={100}
            />
            <p className="xsmall faint" style={{ marginTop: 6 }}>
              Linie 7-Tage-Schnitt · gestrichelt 28-Tage-Schnitt{meta.unit ? ` · in ${meta.unit}` : ''}
            </p>
          </div>
        )}
      </Card>
      <Card label={`Jahr · ${meta.label}`} icon={CalendarRange} ariaLabel="Jahres-Heatmap" testId="year-heatmap">
        {hasYear ? (
          <div className="heatmap-year">
            <Heatmap
              label={`${meta.label} pro Tag im letzten Jahr, dunkel = nichts, hell = viel`}
              weeks={year.map((w) =>
                w.map((c) => ({
                  date: c.date,
                  level: c.level,
                  title: `${formatDE(c.date)}: ${c.value === null ? '–' : `${formatDecimal(meta.scale(c.value), meta.digits)}${meta.unit ? ` ${meta.unit}` : ''}`}`,
                })),
              )}
            />
          </div>
        ) : (
          <p className="small faint">Noch keine Werte im letzten Jahr.</p>
        )}
      </Card>
    </>
  );
}

// ---------- Zusammenhänge ----------

function Insights({ data, today }: { data: ReviewData; today: ISODate }) {
  const insights = buildInsights(data, today);
  return (
    <>
      <SectionTitle>Zusammenhänge · 90 Tage</SectionTitle>
      {insights.map((i) => (
        <Card key={i.id} label={i.title} icon={Lightbulb} ariaLabel={i.title} testId={`insight-${i.id}`}>
          <div className={`insight ${i.enough ? '' : 'insight--thin'}`}>
            <p className="insight__text">{i.text}</p>
            {i.enough && i.detail && <p className="xsmall faint">{i.detail}</p>}
          </div>
        </Card>
      ))}
      <p className="xsmall faint">
        Korrelation nach Pearson (r von −1 bis 1) mit Anzahl der Datenpunkte (n). Aussagen erst ab 14 Punkten und |r| ≥ 0,3. Zusammenhänge sind keine Ursachen – auch ein deutlicher kann Zufall oder ein dritter Faktor sein.
      </p>
    </>
  );
}

// ---------- Saison ----------

function Season({ data, today }: { data: ReviewData; today: ISODate }) {
  const season = seasonOf(today);
  const r = seasonRange(season);
  const matches = data.sessions.filter((s) => s.type === 'match' && s.date >= r.from && s.date <= r.to).sort((a, b) => a.date.localeCompare(b.date));
  const st = seasonStats(matches);
  return (
    <>
      <SectionTitle>Saison {season} · Fußball</SectionTitle>
      <Card label="Saisonübersicht" icon={Trophy} ariaLabel="Saisonübersicht" testId="review-season">
        {st.games === 0 ? (
          <p className="small faint">Noch keine Spiele in dieser Saison.</p>
        ) : (
          <>
            <div className="stat-grid" style={{ marginBottom: 'var(--space-4)' }}>
              <Stat value={st.games} label="Spiele" />
              <Stat value={`${st.goals}+${st.assists}`} label="Tore + Assists" />
              <Stat value={formatDecimal(st.goalsPer90, 2)} label="Tore / 90" />
            </div>
            <BarChart
              label="Tore und Assists pro Spiel"
              data={matches.slice(-12).map((m) => ({
                label: formatDayMonth(m.date).slice(0, 5),
                value: (m.match?.goals ?? 0) + (m.match?.assists ?? 0),
                title: `${m.match?.opponent ?? 'Spiel'} ${m.match?.goalsFor ?? 0}:${m.match?.goalsAgainst ?? 0} – ${m.match?.goals ?? 0} T, ${m.match?.assists ?? 0} A`,
              }))}
              height={80}
              showValues
            />
            <p className="xsmall faint" style={{ marginTop: 6 }}>
              Tore + Assists pro Spiel · Ø Note {formatDecimal(st.avgRating, 1)} · {st.minutesPerGoal ? `alle ${st.minutesPerGoal} min ein Tor` : 'noch kein Tor'}
            </p>
          </>
        )}
      </Card>
    </>
  );
}

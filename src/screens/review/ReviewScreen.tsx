import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, Lightbulb, Trophy } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { formatDecimal } from '../../lib/calc/insights';
import { buildInsights, dailySeries, periodSummary, type ReviewData } from '../../lib/calc/review';
import { seasonOf, seasonRange, seasonStats } from '../../lib/calc/training';
import {
  addDays,
  endOfMonth,
  formatDayMonth,
  formatHM,
  formatMinutes,
  formatMonth,
  formatWeekdayShort,
  isoWeekNumber,
  startOfMonth,
  startOfWeek,
  type ISODate,
} from '../../lib/date';
import { BarChart, LineChart } from '../../ui/charts';
import { Segmented } from '../../ui/controls';
import { Card, EmptyState, IconButton, ScreenHeader, SectionTitle, Stat } from '../../ui/primitives';

type Period = 'woche' | 'monat';

function range(period: Period, today: ISODate, offset: number): { from: ISODate; to: ISODate; label: string } {
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
  const data = useLiveQuery<ReviewData>(async () => {
    const [sessions, meals, days, sleep, health, study, exams, habits, checks] = await Promise.all([
      db.sessions.toArray(),
      db.meals.toArray(),
      db.days.toArray(),
      db.sleep.toArray(),
      db.health.toArray(),
      db.studySessions.toArray(),
      db.exams.toArray(),
      db.habits.toArray(),
      db.habitChecks.toArray(),
    ]);
    return { sessions, meals, days, sleep, health, study, exams, habits, checks };
  }, []);

  const r = range(period, today, offset);
  const to = r.to > today ? today : r.to;

  return (
    <div className="screen">
      <ScreenHeader eyebrow="Woche · Monat · Zusammenhänge" />
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
        ]}
      />
      <div className="period-nav">
        <IconButton icon={ChevronLeft} label="Vorheriger Zeitraum" onClick={() => setOffset(offset - 1)} />
        <span className="period-nav__label" data-testid="period-label">
          {r.label}
        </span>
        <IconButton icon={ChevronRight} label="Nächster Zeitraum" disabled={offset >= 0} onClick={() => setOffset(offset + 1)} />
      </div>
      {data && r.from <= today ? <PeriodView data={data} from={r.from} to={to} period={period} sleepGoal={settings.goals.sleepH} /> : null}
      {data && <Insights data={data} today={today} />}
      {data && <Season data={data} today={today} />}
    </div>
  );
}

function PeriodView({ data, from, to, period, sleepGoal }: { data: ReviewData; from: ISODate; to: ISODate; period: Period; sleepGoal: number }) {
  const s = periodSummary(data, from, to);
  const series = dailySeries(data, from, to);
  const label = (d: ISODate) => (period === 'woche' ? formatWeekdayShort(d) : d.slice(8));
  const hasAny = series.some((d) => d.studyMin > 0 || d.load > 0 || d.sleepMin !== null || d.mood !== null || d.proteinG !== null);

  return (
    <>
      <Card ariaLabel="Kennzahlen" testId="review-stats">
        <div className="stat-grid">
          <Stat value={formatHM(s.studyMin)} unit="h" label="Lernzeit" />
          <Stat value={s.load.toLocaleString('de-DE')} label={`Load · ${s.sessions} Einh.`} />
          <Stat value={s.sleepAvgMin === null ? '–' : formatHM(s.sleepAvgMin)} unit="h" label="Ø Schlaf" />
          <Stat value={s.proteinAvg === null ? '–' : Math.round(s.proteinAvg)} unit="g" label="Ø Protein" />
          <Stat value={s.habitRate === null ? '–' : Math.round(s.habitRate * 100)} unit="%" label="Habit-Quote" />
          <Stat value={formatDecimal(s.moodAvg, 1)} label="Ø Stimmung" />
        </div>
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
      <p className="xsmall faint">Gegenüberstellungen, keine Ursachen. Auch ein deutlicher Unterschied kann Zufall oder ein dritter Faktor sein.</p>
    </>
  );
}

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

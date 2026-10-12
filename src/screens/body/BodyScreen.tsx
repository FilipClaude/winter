import { useLiveQuery } from 'dexie-react-hooks';
import { Footprints, HeartPulse, Moon, Pencil, Plus, Trash2, Utensils } from 'lucide-react';
import { useState } from 'react';
import { db } from '../../db/db';
import { deleteMeal, deleteMealTemplate, saveMealTemplate, ValidationError } from '../../db/repo';
import type { MealTemplate } from '../../db/schemas';
import { useKV, useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import { formatDecimal } from '../../lib/calc/insights';
import { effectiveSleep } from '../../lib/calc/sleep';
import { addDays, dateRange, formatDE, formatHM, formatShort, formatWeekdayShort, toISODate, toTimeHM } from '../../lib/date';
import { BarChart } from '../../ui/charts';
import { NumberField, Segmented, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Button, Card, EmptyState, IconButton, ProgressBar, ScreenHeader, SectionTitle, Stat } from '../../ui/primitives';
import { openHealthSheet } from '../health/openHealth';
import { MealSheet } from './MealSheet';
import { SleepSheet } from './SleepSheet';

type Tab = 'ernaehrung' | 'schlaf' | 'health';

export default function BodyScreen() {
  const [tab, setTab] = useState<Tab>('ernaehrung');
  return (
    <div className="screen">
      <ScreenHeader eyebrow="Ernährung · Schlaf · Health" />
      <h1 className="screen-title">Körper</h1>
      <Segmented<Tab>
        label="Bereich"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'ernaehrung', label: 'Ernährung' },
          { value: 'schlaf', label: 'Schlaf' },
          { value: 'health', label: 'Health' },
        ]}
      />
      {tab === 'ernaehrung' && <Nutrition />}
      {tab === 'schlaf' && <SleepPanel />}
      {tab === 'health' && <HealthPanel />}
    </div>
  );
}

// ---------- Ernährung ----------

function Nutrition() {
  const today = useToday();
  const settings = useSettings();
  const { openSheet, toast } = useOverlay();
  const from = addDays(today, -6);
  const data = useLiveQuery(async () => {
    const [meals, templates] = await Promise.all([db.meals.where('date').between(from, today, true, true).toArray(), db.mealTemplates.orderBy('order').toArray()]);
    return { meals, templates };
  }, [from, today]);
  if (!data) return null;
  const todays = data.meals.filter((m) => m.date === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const protein = todays.reduce((a, m) => a + m.proteinG, 0);
  const kcal = todays.reduce((a, m) => a + m.kcal, 0);
  const g = settings.goals;
  const days = dateRange(from, today);
  const proteinByDay = days.map((d) => data.meals.filter((m) => m.date === d).reduce((a, m) => a + m.proteinG, 0));
  const daysWithMeals = days.filter((d) => data.meals.some((m) => m.date === d)).length;
  const avgProtein = daysWithMeals > 0 ? proteinByDay.reduce((a, b) => a + b, 0) / daysWithMeals : null;

  return (
    <>
      <Card label="Heute" icon={Utensils} ariaLabel="Ernährung heute" action={<IconButton icon={Plus} label="Mahlzeit eintragen" variant="accent" onClick={() => openSheet({ title: 'Mahlzeit', render: (close) => <MealSheet date={today} close={close} /> })} />}>
        <div className="grid-2">
          <div>
            <div className="big num">
              {Math.round(protein)}
              <span className="unit">g</span>
            </div>
            <div className="xsmall faint" style={{ margin: '4px 0 8px' }}>
              Protein · Ziel {g.proteinG} g
            </div>
            <ProgressBar value={g.proteinG ? protein / g.proteinG : 0} label="Protein" />
          </div>
          <div>
            <div className="big num">{kcal.toLocaleString('de-DE')}</div>
            <div className="xsmall faint" style={{ margin: '4px 0 8px' }}>
              kcal · Ziel {g.kcal.toLocaleString('de-DE')}
            </div>
            <ProgressBar value={g.kcal ? kcal / g.kcal : 0} label="Kalorien" />
          </div>
        </div>
        {todays.length > 0 && (
          <div className="list" style={{ marginTop: 'var(--space-3)' }} data-testid="meal-list">
            {todays.map((m) => (
              <div key={m.id} className="list-item">
                <span className="grow">
                  <span className="list-item__title">{m.name}</span>
                  <br />
                  <span className="list-item__meta">
                    {m.kcal} kcal · {formatDecimal(m.proteinG, m.proteinG % 1 ? 1 : 0)} g Protein
                  </span>
                </span>
                <IconButton
                  icon={Trash2}
                  label={`${m.name} löschen`}
                  onClick={() => {
                    void deleteMeal(m.id);
                    toast(`${m.name} gelöscht`, { tone: 'warn' });
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card label="Protein · 7 Tage" ariaLabel="Protein der letzten 7 Tage">
        <BarChart
          label="Protein pro Tag"
          data={days.map((d, i) => ({ label: formatWeekdayShort(d), value: proteinByDay[i] ?? 0, highlight: d === today }))}
          goal={g.proteinG}
          goalLabel={`Ziel ${g.proteinG} g`}
          format={(n) => `${Math.round(n)} g`}
        />
        <p className="xsmall faint" style={{ marginTop: 'var(--space-2)' }}>
          Schnitt an Tagen mit Einträgen: {avgProtein === null ? '–' : `${Math.round(avgProtein)} g`}
        </p>
      </Card>

      <SectionTitle
        action={
          <Button variant="ghost" size="s" icon={Plus} onClick={() => openSheet({ title: 'Neue Vorlage', render: (close) => <TemplateSheet close={close} /> })}>
            Vorlage
          </Button>
        }
      >
        Mahlzeiten-Vorlagen
      </SectionTitle>
      <Card ariaLabel="Mahlzeiten-Vorlagen">
        {data.templates.length === 0 ? (
          <EmptyState icon={Utensils} title="Keine Vorlagen">
            Häufige Mahlzeiten als Vorlage speichern und mit einem Tap eintragen.
          </EmptyState>
        ) : (
          <div className="list">
            {data.templates.map((t) => (
              <div key={t.id} className="list-item">
                <span className="grow">
                  <span className="list-item__title">{t.name}</span>
                  <br />
                  <span className="list-item__meta">
                    {t.kcal} kcal · {t.proteinG} g Protein
                  </span>
                </span>
                <IconButton icon={Pencil} label={`${t.name} bearbeiten`} onClick={() => openSheet({ title: 'Vorlage bearbeiten', render: (close) => <TemplateSheet close={close} template={t} /> })} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function TemplateSheet({ close, template }: { close: () => void; template?: MealTemplate }) {
  const { toast } = useOverlay();
  const [name, setName] = useState(template?.name ?? '');
  const [kcal, setKcal] = useState<number | ''>(template?.kcal ?? '');
  const [protein, setProtein] = useState<number | ''>(template?.proteinG ?? '');
  const [error, setError] = useState<string>();
  return (
    <div className="form">
      <TextField label="Name" value={name} onValue={setName} maxLength={80} placeholder="z. B. Skyr + Haferflocken" />
      <div className="form-row">
        <NumberField label="Kalorien (kcal)" value={kcal} onValue={setKcal} min={0} max={6000} />
        <NumberField label="Protein (g)" value={protein} onValue={setProtein} min={0} max={500} decimal />
      </div>
      {error && <p className="field__error">{error}</p>}
      <Button
        variant="primary"
        block
        disabled={!name.trim()}
        onClick={() =>
          void saveMealTemplate({
            ...(template ? { id: template.id, createdAt: template.createdAt, order: template.order } : {}),
            name,
            kcal: Math.round(Number(kcal || 0)),
            proteinG: Number(protein || 0),
          })
            .then(() => {
              toast('Vorlage gespeichert');
              close();
            })
            .catch((e: unknown) => setError(e instanceof ValidationError ? e.message : 'Speichern fehlgeschlagen'))
        }
      >
        Speichern
      </Button>
      {template && (
        <Button variant="warn" block icon={Trash2} onClick={() => void deleteMealTemplate(template.id).then(close)}>
          Vorlage löschen
        </Button>
      )}
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

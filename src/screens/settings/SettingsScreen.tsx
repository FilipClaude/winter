import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown,
  ArrowUp,
  Database,
  FileDown,
  FileText,
  FlaskConical,
  GraduationCap,
  HardDrive,
  HeartPulse,
  History,
  Plus,
  Share2,
  Snowflake,
  Target,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { db, SCHEMA_VERSION } from '../../db/db';
import { saveSettings, saveSubject } from '../../db/repo';
import type { Settings, Subject } from '../../db/schemas';
import { useKV, useKVState, useSettings } from '../../hooks/useSettings';
import { useToday } from '../../hooks/useNow';
import {
  backupFileName,
  createBackup,
  listSnapshots,
  markBackupDone,
  previewBackup,
  previewSnapshot,
  restoreBackup,
  saveSafetySnapshot,
  wipeAll,
  type BackupPreview,
} from '../../lib/backup';
import { formatDecimal } from '../../lib/calc/insights';
import { diffDays, formatDE, startOfWeek, toISODate, toTimeHM } from '../../lib/date';
import { insertDemo, removeDemo } from '../../lib/demo';
import { copyText, saveFile } from '../../lib/download';
import { dayMarkdown, weekFileName, weekMarkdown, type MarkdownData } from '../../lib/markdown';
import { NumberField, Segmented, TextField } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Badge, Banner, Button, Card, IconButton, ScreenHeader, SectionTitle } from '../../ui/primitives';
import { openHealthSheet } from '../health/openHealth';

export default function SettingsScreen() {
  const settings = useSettings();
  return (
    <div className="screen">
      <ScreenHeader eyebrow={`Winter · Schema v${SCHEMA_VERSION}`} />
      <h1 className="screen-title">Einstellungen</h1>
      <GoalsCard settings={settings} />
      <SubjectsCard />
      <HealthCard settings={settings} />
      <BackupCard />
      <SnapshotsCard />
      <MarkdownCard />
      <StorageCard />
      <DemoCard />
      <AppearanceCard settings={settings} />
      <DangerCard />
      <p className="xsmall faint" style={{ textAlign: 'center', margin: 'var(--space-6) 0' }}>
        Alle Daten liegen nur auf diesem Gerät. Kein Konto, keine Cloud.
      </p>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, testId, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; testId?: string; disabled?: boolean }) {
  return (
    <label className="toggle-row">
      <span className="grow">
        <span className="list-item__title">{label}</span>
        {hint && <span className="list-item__meta" style={{ display: 'block' }}>{hint}</span>}
      </span>
      <input type="checkbox" role="switch" className="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
    </label>
  );
}

// ---------- Darstellung ----------

type OrientationPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

function AppearanceCard({ settings }: { settings: Settings }) {
  const { toast } = useOverlay();
  return (
    <Card label="Darstellung" icon={Snowflake} ariaLabel="Darstellung" testId="appearance-card">
      <div className="stack">
        <div className="stack stack--s">
          <span className="xsmall muted">Schnee</span>
          <Segmented
            label="Schnee"
            value={settings.snowMode}
            options={[
              { value: 'off', label: 'Aus' },
              { value: 'subtle', label: 'Dezent' },
              { value: 'weather', label: 'Wetter' },
            ]}
            onChange={(snowMode) => void saveSettings({ snowMode, snow: snowMode !== 'off' })}
          />
          <span className="xsmall faint">
            „Wetter“ schneit nur, wenn es in München gerade schneit (Open-Meteo, alle 30 min). Ohne Netz: leicht. Bei „Bewegung reduzieren“ immer aus.
          </span>
        </div>
        <ToggleRow
          label="Alpen bewegen sich mit"
          hint="Leichte Parallaxe beim Neigen des iPhones. iOS fragt einmal nach Zugriff auf die Bewegungssensoren."
          checked={settings.tilt}
          onChange={(on) => {
            if (!on) {
              void saveSettings({ tilt: false });
              return;
            }
            const DOE = (window as unknown as { DeviceOrientationEvent?: OrientationPermission }).DeviceOrientationEvent;
            const ask = DOE?.requestPermission ? DOE.requestPermission() : Promise.resolve('granted' as const);
            void ask
              .then((r) => {
                if (r === 'granted') return saveSettings({ tilt: true });
                toast('Zugriff auf Bewegungssensoren abgelehnt', { tone: 'warn' });
                return undefined;
              })
              .catch(() => toast('Bewegungssensoren nicht verfügbar', { tone: 'warn' }));
          }}
        />
        <div className="stack stack--s">
          <span className="xsmall muted">Tageszeit simulieren (Entwickler)</span>
          <Segmented
            label="Tageszeit simulieren"
            value={settings.skySimulate}
            options={[
              { value: 'auto', label: 'Echt' },
              { value: 'night', label: 'Nacht' },
              { value: 'dawn', label: 'Morgen' },
              { value: 'day', label: 'Tag' },
              { value: 'dusk', label: 'Abend' },
            ]}
            onChange={(skySimulate) => void saveSettings({ skySimulate })}
          />
        </div>
      </div>
    </Card>
  );
}

// ---------- Ziele ----------

function GoalsCard({ settings }: { settings: Settings }) {
  const { openSheet } = useOverlay();
  const g = settings.goals;
  return (
    <Card label="Tagesziele" icon={Target} ariaLabel="Tagesziele" action={<Button variant="ghost" size="s" onClick={() => openSheet({ title: 'Tagesziele', render: (close) => <GoalsSheet settings={settings} close={close} /> })}>Ändern</Button>}>
      <p className="small muted">
        {g.proteinG} g Protein · {g.kcal.toLocaleString('de-DE')} kcal · {g.waterGlasses} Gläser à {settings.glassMl} ml · {g.studyMin} min Lernen · {formatDecimal(g.sleepH, 1)} h Schlaf · {g.steps.toLocaleString('de-DE')} Schritte
      </p>
    </Card>
  );
}

function GoalsSheet({ settings, close }: { settings: Settings; close: () => void }) {
  const { toast } = useOverlay();
  const [g, setG] = useState(settings.goals);
  const [glassMl, setGlassMl] = useState<number | ''>(settings.glassMl);
  const [ring, setRing] = useState(settings.ring);
  const num = (k: keyof typeof g) => (v: number | '') => setG({ ...g, [k]: v === '' ? 0 : v });
  return (
    <div className="form">
      <div className="form-row">
        <NumberField label="Protein (g)" value={g.proteinG} onValue={num('proteinG')} min={0} max={500} />
        <NumberField label="Kalorien (kcal)" value={g.kcal} onValue={num('kcal')} min={0} max={8000} />
      </div>
      <div className="form-row">
        <NumberField label="Wasser (Gläser)" value={g.waterGlasses} onValue={num('waterGlasses')} min={0} max={40} />
        <NumberField label="Glasgröße (ml)" value={glassMl} onValue={setGlassMl} min={50} max={1000} />
      </div>
      <div className="form-row">
        <NumberField label="Lernen (min)" value={g.studyMin} onValue={num('studyMin')} min={0} max={1440} />
        <NumberField label="Schlaf (h)" value={g.sleepH} onValue={num('sleepH')} min={0} max={14} decimal />
      </div>
      <NumberField label="Schritte" value={g.steps} onValue={num('steps')} min={0} max={100000} />
      <SectionTitle>Im Tagesring</SectionTitle>
      {(['habits', 'protein', 'water', 'study', 'sleep'] as const).map((k) => (
        <ToggleRow key={k} label={{ habits: 'Habits', protein: 'Protein', water: 'Wasser', study: 'Lernzeit', sleep: 'Schlaf' }[k]} checked={ring[k]} onChange={(v) => setRing({ ...ring, [k]: v })} />
      ))}
      <Button
        variant="primary"
        block
        onClick={() =>
          void saveSettings({ goals: { ...g, steps: Math.round(g.steps), proteinG: Math.round(g.proteinG), kcal: Math.round(g.kcal), waterGlasses: Math.round(g.waterGlasses), studyMin: Math.round(g.studyMin) }, glassMl: Math.round(Number(glassMl || 250)), ring })
            .then(() => {
              toast('Ziele gespeichert');
              close();
            })
            .catch((e: unknown) => toast(e instanceof Error ? e.message : 'Ungültige Werte', { tone: 'warn' }))
        }
      >
        Speichern
      </Button>
    </div>
  );
}

// ---------- Fächer ----------

function SubjectsCard() {
  const { openSheet } = useOverlay();
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), []);
  const active = subjects?.filter((s) => !s.archived) ?? [];
  return (
    <Card label="Fächer" icon={GraduationCap} ariaLabel="Fächer" action={<Button variant="ghost" size="s" onClick={() => openSheet({ title: 'Fächer', render: () => <SubjectsSheet /> })}>Bearbeiten</Button>}>
      <div className="chips">
        {active.map((s) => (
          <span key={s.id} className="chip" style={{ cursor: 'default' }}>
            {s.name}
            {s.major && <span className="faint xsmall">LF</span>}
          </span>
        ))}
      </div>
    </Card>
  );
}

function SubjectsSheet() {
  const subjects = useLiveQuery(() => db.subjects.orderBy('order').toArray(), []) ?? [];
  const [name, setName] = useState('');
  const move = async (i: number, dir: -1 | 1) => {
    const a = subjects[i];
    const b = subjects[i + dir];
    if (!a || !b) return;
    await db.transaction('rw', db.subjects, async () => {
      await saveSubject({ ...a, order: b.order });
      await saveSubject({ ...b, order: a.order });
    });
  };
  return (
    <div className="form">
      <div className="list">
        {subjects.map((s, i) => (
          <SubjectRow key={s.id} subject={s} first={i === 0} last={i === subjects.length - 1} onMove={(d) => void move(i, d)} />
        ))}
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow">
          <TextField label="Neues Fach" value={name} onValue={setName} maxLength={40} />
        </div>
        <Button
          variant="secondary"
          icon={Plus}
          disabled={!name.trim()}
          onClick={() =>
            void saveSubject({ name, short: name.trim().slice(0, 3), order: (subjects.at(-1)?.order ?? 0) + 1, archived: false }).then(() => setName(''))
          }
        >
          Fach
        </Button>
      </div>
      <p className="xsmall faint">Archivierte Fächer verschwinden aus der Auswahl, ihre Lernzeiten und Noten bleiben erhalten.</p>
    </div>
  );
}

function SubjectRow({ subject, first, last, onMove }: { subject: Subject; first: boolean; last: boolean; onMove: (d: -1 | 1) => void }) {
  const [name, setName] = useState(subject.name);
  return (
    <div className="list-item" style={{ gap: 'var(--space-1)' }}>
      <input
        className="input"
        style={{ minHeight: 40, flex: 1, minWidth: 0, opacity: subject.archived ? 0.5 : 1 }}
        aria-label={`Name ${subject.name}`}
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== subject.name && void saveSubject({ ...subject, name })}
      />
      <IconButton icon={ArrowUp} label={`${subject.name} nach oben`} disabled={first} onClick={() => onMove(-1)} />
      <IconButton icon={ArrowDown} label={`${subject.name} nach unten`} disabled={last} onClick={() => onMove(1)} />
      <Button variant="ghost" size="s" onClick={() => void saveSubject({ ...subject, archived: !subject.archived })}>
        {subject.archived ? 'Aktiv' : 'Archiv'}
      </Button>
    </div>
  );
}

// ---------- Health ----------

function HealthCard({ settings }: { settings: Settings }) {
  const { openSheet } = useOverlay();
  const [name, setName] = useState(settings.shortcutName);
  const last = useKV<string>('lastHealthImport');
  return (
    <Card label="Apple Health" icon={HeartPulse} ariaLabel="Apple Health">
      <div className="form">
        <TextField
          label="Name des Kurzbefehls"
          value={name}
          onValue={setName}
          onBlur={() => name.trim() && name !== settings.shortcutName && void saveSettings({ shortcutName: name.trim() })}
          hint="Muss exakt so heißen wie in der Kurzbefehle-App. Anleitung: HEALTH-SHORTCUT.md"
        />
        <div className="row row--between">
          <span className="small muted">Letzter Import: {last ? `${formatDE(toISODate(last))}, ${toTimeHM(last)}` : 'noch nie'}</span>
          <Button variant="secondary" size="s" onClick={() => openHealthSheet(openSheet, settings.shortcutName)}>
            Health holen
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ---------- Backup ----------

function BackupCard() {
  const { toast, openSheet } = useOverlay();
  const lastBackup = useKV<string>('lastBackupAt');
  const today = useToday();
  const [prepared, setPrepared] = useState<{ name: string; json: string; total: number } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const age = lastBackup ? diffDays(toISODate(lastBackup), today) : null;

  return (
    <Card label="Backup" icon={Database} ariaLabel="Backup" testId="backup-card">
      <div className="stack">
        {age === null || age > 7 ? (
          <Banner icon={HardDrive} tone="warn">
            {age === null ? 'Noch nie gesichert.' : `Letztes Backup vor ${age} Tagen.`} iOS kann Website-Daten löschen – regelmäßig sichern.
          </Banner>
        ) : (
          <p className="small muted">
            Letztes Backup: {formatDE(toISODate(lastBackup ?? ''))} {age === 0 ? '(heute)' : `(vor ${age} ${age === 1 ? 'Tag' : 'Tagen'})`}
          </p>
        )}
        {prepared ? (
          <div className="stack stack--s">
            <p className="small">
              <span className="mono">{prepared.name}</span> · {prepared.total} Einträge
            </p>
            <Button
              variant="primary"
              block
              icon={Share2}
              data-testid="backup-save"
              onClick={() =>
                void saveFile(prepared.name, prepared.json, 'application/json').then(async (r) => {
                  if (r === 'abgebrochen') return;
                  await markBackupDone();
                  toast(r === 'geteilt' ? 'Backup geteilt' : 'Backup heruntergeladen');
                  setPrepared(null);
                })
              }
            >
              Sichern / Teilen
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            block
            icon={FileDown}
            onClick={() =>
              void createBackup().then((b) => {
                const total = Object.values(b.tables).reduce((a, rows) => a + rows.length, 0);
                setPrepared({ name: backupFileName(b.exportedAt), json: JSON.stringify(b), total });
              })
            }
          >
            Backup erstellen
          </Button>
        )}
        <Button variant="secondary" block icon={Upload} onClick={() => fileInput.current?.click()}>
          Backup importieren
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="backup-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            void f.text().then((text) => {
              const r = previewBackup(text);
              if (!r.ok) {
                toast(r.error, { tone: 'warn' });
                return;
              }
              openSheet({ title: 'Backup importieren', render: (close) => <ImportPreview preview={r.preview} close={close} /> });
            });
          }}
        />
      </div>
    </Card>
  );
}

function ImportPreview({ preview, close, snapshot = false }: { preview: BackupPreview; close: () => void; snapshot?: boolean }) {
  const { toast } = useOverlay();
  const [busy, setBusy] = useState(false);
  return (
    <div className="form" data-testid="import-preview">
      <p className="big big--m num">
        {preview.total}
        <span className="unit">Einträge</span>
      </p>
      <p className="small muted">
        {preview.total} Einträge werden {snapshot ? 'wiederhergestellt' : 'importiert'} (Stand vom {formatDE(toISODate(preview.backup.exportedAt))}, {toTimeHM(preview.backup.exportedAt)} Uhr)
        {preview.demo > 0 ? `, davon ${preview.demo} Demo-Einträge` : ''}.
      </p>
      <div className="list">
        {preview.counts
          .filter((c) => c.count > 0)
          .map((c) => (
            <div key={c.table} className="row row--between small" style={{ minHeight: 32 }}>
              <span className="muted">{c.label}</span>
              <span className="mono">{c.count}</span>
            </div>
          ))}
      </div>
      <Banner icon={Database} tone="warn">
        Ersetzt alle aktuellen Daten auf diesem Gerät. Der jetzige Stand wird vorher als „vor Import“ gesichert.
      </Banner>
      <Button
        variant="primary"
        block
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void saveSafetySnapshot()
            .then(() => restoreBackup(preview.backup, { countsAsBackup: !snapshot }))
            .then((n) => {
              toast(`${n} Einträge wiederhergestellt`);
              close();
            })
            .catch((e: unknown) => {
              setBusy(false);
              toast(e instanceof Error ? e.message : 'Import fehlgeschlagen', { tone: 'warn' });
            });
        }}
      >
        {snapshot ? 'Ersetzen und wiederherstellen' : 'Ersetzen und importieren'}
      </Button>
      <Button variant="ghost" block onClick={close}>
        Abbrechen
      </Button>
    </div>
  );
}

const SNAPSHOT_LABEL: Record<string, string> = {
  'vor-v2': 'Vor dem Update auf v2',
  'vor-import': 'Vor dem letzten Import',
};

function SnapshotsCard() {
  const { toast, openSheet } = useOverlay();
  const list = useLiveQuery(() => listSnapshots(), []);
  return (
    <Card label="Automatische Sicherungen" icon={History} ariaLabel="Automatische Sicherungen" testId="snapshots-card">
      <p className="small muted">
        Einmal täglich legt Winter auf diesem Gerät eine Sicherung an (die letzten 7 bleiben). Sie ersetzt kein Backup als Datei, weil sie mit den Website-Daten verloren gehen kann.
      </p>
      {list && list.length > 0 ? (
        <div className="list">
          {list.map((s) => (
            <div key={s.id} className="list-item">
              <span className="grow">
                <span className="list-item__title">{SNAPSHOT_LABEL[s.id] ?? formatDE(s.id)}</span>
                <br />
                <span className="list-item__meta mono">
                  {formatDE(toISODate(s.createdAt))} {toTimeHM(s.createdAt)} · {s.rows} Einträge
                </span>
              </span>
              <Button
                size="s"
                variant="secondary"
                onClick={() =>
                  void previewSnapshot(s.id).then((r) => {
                    if (!r.ok) {
                      toast(r.error, { tone: 'warn' });
                      return;
                    }
                    openSheet({ title: 'Sicherung wiederherstellen', render: (close) => <ImportPreview preview={r.preview} close={close} snapshot /> });
                  })
                }
              >
                Ansehen
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="small faint">Noch keine Sicherung.</p>
      )}
    </Card>
  );
}

// ---------- Markdown ----------

async function loadMarkdownData(): Promise<MarkdownData> {
  const [days, sessions, todos, deadlines, modules, subjects, study, meals, sleep, health] = await Promise.all([
    db.days.toArray(),
    db.sessions.toArray(),
    db.todos.toArray(),
    db.deadlines.toArray(),
    db.modules.toArray(),
    db.subjects.toArray(),
    db.studySessions.toArray(),
    db.meals.toArray(),
    db.sleep.toArray(),
    db.health.toArray(),
  ]);
  return { days, sessions, todos, deadlines, modules, subjects, study, meals, sleep, health };
}

function MarkdownCard() {
  const { openSheet } = useOverlay();
  return (
    <Card label="Obsidian-Export" icon={FileText} ariaLabel="Markdown-Export" action={<Button variant="ghost" size="s" onClick={() => openSheet({ title: 'Markdown-Export', render: () => <MarkdownSheet /> })}>Öffnen</Button>}>
      <p className="small muted">Tag oder Woche als Markdown mit Frontmatter (datum, tags) und den Abschnitten Aufgaben, Notizen, Training.</p>
    </Card>
  );
}

function MarkdownSheet() {
  const today = useToday();
  const { toast } = useOverlay();
  const [kind, setKind] = useState<'tag' | 'woche'>('tag');
  const [date, setDate] = useState(today);
  const [out, setOut] = useState<{ name: string; md: string } | null>(null);

  useEffect(() => {
    let alive = true;
    void loadMarkdownData().then((data) => {
      if (!alive) return;
      if (kind === 'tag') setOut({ name: `${date}.md`, md: dayMarkdown(data, date) });
      else setOut({ name: weekFileName(startOfWeek(date)), md: weekMarkdown(data, startOfWeek(date)) });
    });
    return () => {
      alive = false;
    };
  }, [kind, date]);

  return (
    <div className="form">
      <Segmented<'tag' | 'woche'> label="Umfang" value={kind} onChange={setKind} options={[{ value: 'tag', label: 'Tag' }, { value: 'woche', label: 'Woche' }]} />
      <TextField label={kind === 'tag' ? 'Datum' : 'Ein Tag der Woche'} type="date" value={date} onValue={(v) => v && setDate(v)} />
      {out && (
        <>
          <pre className="md-preview" data-testid="md-preview">{out.md}</pre>
          <div className="form-row">
            <Button variant="secondary" onClick={() => void copyText(out.md).then((ok) => toast(ok ? 'Kopiert – in Obsidian einfügen' : 'Kopieren nicht erlaubt', { tone: ok ? 'accent' : 'warn' }))}>
              Kopieren
            </Button>
            <Button variant="primary" icon={Share2} onClick={() => void saveFile(out.name, out.md, 'text/markdown').then((r) => r !== 'abgebrochen' && toast(`${out.name} ${r}`))}>
              Datei
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Speicher ----------

function StorageCard() {
  const [state, setState] = useState<{ persisted: boolean | null; usage: number | null }>({ persisted: null, usage: null });
  const refresh = () => {
    const s = navigator.storage;
    void Promise.all([s?.persisted?.() ?? Promise.resolve(null), s?.estimate?.() ?? Promise.resolve(null)]).then(([persisted, est]) =>
      setState({ persisted: persisted ?? null, usage: est?.usage ?? null }),
    );
  };
  useEffect(refresh, []);
  return (
    <Card label="Speicher" icon={HardDrive} ariaLabel="Speicher" testId="storage-card">
      <div className="stack">
        <div className="row row--between">
          <span className="small">Dauerhafter Speicher</span>
          {state.persisted === null ? <Badge tone="muted">unbekannt</Badge> : state.persisted ? <Badge>gewährt</Badge> : <Badge tone="warn">nicht gewährt</Badge>}
        </div>
        {state.usage !== null && <p className="small muted">Belegt: {(state.usage / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB</p>}
        {state.persisted === false && (
          <>
            <Button variant="secondary" size="s" onClick={() => void navigator.storage.persist().then(refresh)}>
              Erneut anfragen
            </Button>
            <p className="xsmall faint">Safari entscheidet selbst. Als Homescreen-App sind die Chancen höher. Backups bleiben trotzdem wichtig.</p>
          </>
        )}
      </div>
    </Card>
  );
}

// ---------- Demo ----------

function DemoCard() {
  // Erst schalten lassen, wenn der echte Zustand geladen ist – sonst stünde der Schalter kurz auf „aus“.
  const demo = useKVState<boolean>('demoActive');
  const active = demo.value === true;
  const { toast } = useOverlay();
  // Zielzustand sofort zeigen, solange geschrieben wird (optimistisch). Erst wenn die Datenbank-Abfrage
  // den neuen Zustand liefert, wird wieder `active` angezeigt – sonst springt der Schalter kurz zurück.
  const [op, setOp] = useState<{ target: boolean; done: boolean } | null>(null);
  if (op?.done && active === op.target) setOp(null);
  return (
    <Card label="Demo-Daten" icon={FlaskConical} ariaLabel="Demo-Daten">
      <ToggleRow
        label="4 Wochen Beispieldaten"
        hint="Markiert und getrennt von echten Daten. Ausschalten löscht sie vollständig."
        checked={op ? op.target : active}
        disabled={op !== null || !demo.loaded}
        testId="demo-toggle"
        onChange={(on) => {
          if (op !== null) return;
          setOp({ target: on, done: false });
          void (on ? insertDemo() : removeDemo())
            .then((n) => {
              toast(on ? `${n} Demo-Einträge angelegt` : `${n} Demo-Einträge gelöscht`);
              setOp({ target: on, done: true });
            })
            .catch((e: unknown) => {
              console.error('Demo-Daten', e);
              toast(`Demo-Daten fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, { tone: 'warn' });
              setOp(null);
            });
        }}
      />
    </Card>
  );
}

// ---------- Gefahrenzone ----------

function DangerCard() {
  const { openSheet } = useOverlay();
  return (
    <Card label="Daten löschen" icon={Trash2} ariaLabel="Daten löschen">
      <Button variant="warn" block onClick={() => openSheet({ title: 'Alle Daten löschen', render: (close) => <WipeSheet close={close} /> })}>
        Alle Daten löschen
      </Button>
    </Card>
  );
}

function WipeSheet({ close }: { close: () => void }) {
  const { toast } = useOverlay();
  const [word, setWord] = useState('');
  return (
    <div className="form">
      <p className="small">Löscht alle Einträge und Einstellungen auf diesem Gerät. Standardfächer und -vorlagen werden neu angelegt. Das lässt sich nur mit einem Backup rückgängig machen.</p>
      <TextField label="Zur Bestätigung LÖSCHEN eingeben" value={word} onValue={setWord} autoCapitalize="characters" autoComplete="off" />
      <Button
        variant="warn"
        block
        disabled={word.trim().toUpperCase() !== 'LÖSCHEN'}
        onClick={() =>
          void wipeAll().then(() => {
            toast('Alle Daten gelöscht', { tone: 'warn' });
            close();
          })
        }
      >
        Endgültig löschen
      </Button>
    </div>
  );
}

import { AlertTriangle, ClipboardPaste, FileUp, HeartPulse, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { moveHealthDay } from '../../db/repo';
import type { HealthDay } from '../../db/schemas';
import { formatDE, formatHM, minutesBetween, relativeDayName } from '../../lib/date';
import { ClipboardSource, FileSource, importFrom, shortcutUrl, TextSource, type HealthImportResult, type HealthSource } from '../../lib/health/source';
import { TextArea } from '../../ui/controls';
import { useOverlay } from '../../ui/overlay-context';
import { Banner, Button, SectionTitle } from '../../ui/primitives';

export function HealthSheet({ shortcutName }: { shortcutName: string }) {
  const { toast } = useOverlay();
  const [returned, setReturned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HealthImportResult | null>(null);
  const [manual, setManual] = useState('');
  const [showManual, setShowManual] = useState(false);
  const launched = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Nach der Rückkehr aus der Kurzbefehle-App erscheint „Werte einfügen“ (iOS verlangt dafür einen Tap).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && launched.current) setReturned(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  async function run(source: HealthSource) {
    setBusy(true);
    const r = await importFrom(source);
    setBusy(false);
    setResult(r);
    if (r.ok && !r.stale) toast(r.saved.length === 1 ? 'Health-Werte übernommen' : `${r.saved.length} Tage übernommen`);
  }

  async function saveForToday() {
    if (!result?.ok || !result.stale || !result.saved[0]) return;
    const { today, previous } = result.stale;
    setBusy(true);
    try {
      const row = await moveHealthDay(result.saved[0], today, previous);
      setResult({ ok: true, saved: [row], warnings: [] });
      toast('Für heute gespeichert');
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Speichern fehlgeschlagen' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <p className="small muted">
        Der Kurzbefehl <strong className="accent">„{shortcutName}“</strong> liest Schritte, Strecke, Stockwerke und Schlaf aus Apple Health und kopiert sie als JSON in die
        Zwischenablage. Danach hierher zurückwechseln und einfügen.
      </p>

      <Button
        variant={returned ? 'secondary' : 'primary'}
        block
        icon={Play}
        onClick={() => {
          launched.current = true;
          window.location.href = shortcutUrl(shortcutName);
        }}
      >
        1 · Kurzbefehl starten
      </Button>
      <Button variant={returned ? 'primary' : 'secondary'} block icon={ClipboardPaste} disabled={busy} onClick={() => void run(new ClipboardSource())} data-testid="health-paste">
        2 · Werte einfügen
      </Button>

      {result && <ImportResult result={result} busy={busy} onSaveForToday={() => void saveForToday()} />}

      <SectionTitle>Alternativen</SectionTitle>
      {showManual ? (
        <div className="stack">
          <TextArea label="JSON einfügen" value={manual} onValue={setManual} rows={5} placeholder='{"v":1,"date":"2026-10-11","steps":8423}' spellCheck={false} autoCapitalize="off" autoCorrect="off" data-testid="health-text" />
          <Button variant="secondary" block disabled={busy || manual.trim() === ''} onClick={() => void run(new TextSource(manual))}>
            Text importieren
          </Button>
        </div>
      ) : (
        <Button variant="ghost" block onClick={() => setShowManual(true)}>
          JSON von Hand einfügen
        </Button>
      )}
      <Button variant="ghost" block icon={FileUp} onClick={() => fileInput.current?.click()}>
        Datei wählen (z. B. aus iCloud Drive)
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,.txt,application/json,text/plain"
        hidden
        data-testid="health-file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void run(new FileSource(f));
          e.target.value = '';
        }}
      />
      <p className="xsmall faint">Ein erneuter Import am selben Tag ersetzt nur die Health-Werte. Manuelle Einträge bleiben unverändert.</p>
    </div>
  );
}

function ImportResult({ result, busy, onSaveForToday }: { result: HealthImportResult; busy: boolean; onSaveForToday: () => void }) {
  if (!result.ok) {
    return (
      <Banner icon={AlertTriangle} tone="warn" testId="health-error">
        {result.error}
      </Banner>
    );
  }
  const stale = result.stale;
  return (
    <div className="stack stack--s" data-testid="health-result">
      {stale && (
        <Banner icon={AlertTriangle} tone="warn" testId="health-stale">
          <strong>Nicht von heute:</strong> Die Werte sind vom {relativeDayName(stale.date, stale.today) ?? formatDE(stale.date)} und stehen deshalb dort, nicht bei heute.
          <br />
          <span className="small">
            {stale.fixedDate
              ? 'Der Kurzbefehl schickt seit Tagen dasselbe Datum. In „Datum formatieren“ muss „Aktuelles Datum“ stehen, kein fest gewähltes Datum.'
              : 'Meist lag noch der alte Inhalt in der Zwischenablage: erst „1 · Kurzbefehl starten“, dann einfügen. Oder im Kurzbefehl ist bei „Datum formatieren“ ein festes Datum eingestellt.'}
          </span>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" size="s" disabled={busy} onClick={onSaveForToday} data-testid="health-move-today">
              Für heute speichern
            </Button>
          </div>
        </Banner>
      )}
      {result.saved.slice(-3).map((d) => (
        <Banner key={d.date} icon={HeartPulse} tone="accent">
          <strong>{formatDE(d.date)}</strong>
          <br />
          <span className="small muted">{summary(d)}</span>
        </Banner>
      ))}
      {result.saved.length > 3 && <p className="xsmall faint">… und {result.saved.length - 3} weitere Tage</p>}
      {result.warnings.map((w) => (
        <p key={w} className="xsmall warn">
          {w}
        </p>
      ))}
    </div>
  );
}

function summary(d: HealthDay): string {
  const parts: string[] = [];
  if (d.steps !== undefined) parts.push(`${d.steps.toLocaleString('de-DE')} Schritte`);
  if (d.distanceKm !== undefined) parts.push(`${d.distanceKm.toLocaleString('de-DE')} km`);
  if (d.flights !== undefined) parts.push(`${d.flights} Stockwerke`);
  if (d.sleepStart && d.sleepEnd) parts.push(`Schlaf ${formatHM(minutesBetween(d.sleepStart, d.sleepEnd))} h`);
  return parts.join(' · ') || 'keine Werte';
}

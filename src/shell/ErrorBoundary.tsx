import { AlertTriangle, RotateCw, Share2 } from 'lucide-react';
import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { backupFileName, createBackup, markBackupDone } from '../lib/backup';
import { saveFile } from '../lib/download';
import { Button } from '../ui/primitives';

interface State {
  error: Error | null;
}

/**
 * Fängt Fehler eines Screens ab. Die übrige App (Tab-Leiste, andere Screens) bleibt bedienbar, und
 * die Daten lassen sich trotzdem sichern – ein Fehler darf nie den Zugang zu den Daten blockieren.
 */
export class ScreenBoundary extends Component<{ children: ReactNode; name: string }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Fehler im Bereich ${this.props.name}`, error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return <ErrorPanel error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}

/**
 * Test-Sonde für die E2E-Tests der Fehlergrenze: wirft, wenn `sessionStorage['winter:crash']` den
 * Bereichsnamen enthält. Im normalen Betrieb ohne Wirkung.
 */
export function CrashProbe({ name }: { name: string }) {
  let flag: string | null = null;
  try {
    flag = sessionStorage.getItem('winter:crash');
  } catch {
    // Speicher gesperrt: nichts tun
  }
  if (flag === name) throw new Error(`Testfehler im Bereich ${name}`);
  return null;
}

function ErrorPanel({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [prepared, setPrepared] = useState<{ name: string; json: string } | null>(null);
  const [status, setStatus] = useState('');
  return (
    <div className="screen error-panel" role="alert" data-testid="error-boundary">
      <AlertTriangle size={28} strokeWidth={1.5} aria-hidden className="warn" />
      <h1 className="screen-title">Hier ist etwas schiefgelaufen</h1>
      <p className="muted">
        Deine Daten sind nicht betroffen. Lade den Bereich neu. Hilft das nicht, sichere zuerst ein Backup.
      </p>
      <p className="xsmall faint mono error-panel__msg">{error.message}</p>
      <div className="stack stack--s">
        <Button variant="primary" icon={RotateCw} block onClick={onRetry}>
          Bereich neu laden
        </Button>
        <Button variant="secondary" block onClick={() => window.location.reload()}>
          App neu starten
        </Button>
        {prepared ? (
          <Button
            variant="secondary"
            icon={Share2}
            block
            onClick={() =>
              void saveFile(prepared.name, prepared.json, 'application/json').then(async (r) => {
                if (r !== 'abgebrochen') await markBackupDone();
                setStatus(r === 'abgebrochen' ? '' : `Backup ${r}.`);
              })
            }
          >
            Backup teilen
          </Button>
        ) : (
          <Button
            variant="secondary"
            block
            onClick={() =>
              void createBackup()
                .then((b) => setPrepared({ name: backupFileName(b.exportedAt), json: JSON.stringify(b) }))
                .catch((e: unknown) => setStatus(`Backup fehlgeschlagen: ${String(e)}`))
            }
          >
            Backup erstellen
          </Button>
        )}
        {status && <p className="small muted">{status}</p>}
      </div>
    </div>
  );
}

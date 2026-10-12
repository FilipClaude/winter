import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { db } from '../db/db';
import { rawExport } from '../lib/rescue';

/**
 * Letzte Fehlergrenze um die ganze App – greift, wenn sogar die Datenbank nicht öffnet (z. B. Speicher
 * voll, „Verbindung zu IndexedDB verloren“ in Safari). Bewusst ohne Dexie, Overlay und Design-Komponenten:
 * nur reines React, damit diese Seite selbst nicht an derselben Ursache scheitert. Die Rettungs-Sicherung
 * liest IndexedDB direkt aus.
 */
export class RootBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Winter konnte nicht starten', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return <DbGate>{this.props.children}</DbGate>;
    return <Rescue error={this.state.error} />;
  }
}

/**
 * Prüft ausdrücklich, ob die Datenbank öffnet. Ohne diese Prüfung blieben Live-Abfragen bei einem
 * Öffnungsfehler still im Ladezustand hängen (gefunden per E2E-Test) – die App wirkte eingefroren.
 */
function DbGate({ children }: { children: ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let alive = true;
    db.open().catch((e: unknown) => {
      if (alive) setError(e instanceof Error ? e : new Error(String(e)));
    });
    return () => {
      alive = false;
    };
  }, []);
  return error ? <Rescue error={error} /> : children;
}

function Rescue({ error }: { error: Error }) {
  const [status, setStatus] = useState('');
  const [file, setFile] = useState<File | null>(null);
  return (
    <main className="app rescue" role="alert" data-testid="root-error">
      <h1 className="screen-title">Winter startet gerade nicht</h1>
      <p className="muted">
        Deine Daten liegen weiter auf diesem Gerät. Meist hilft Neuladen. Klappt das nicht, sichere zuerst die
        Rohdaten und melde den Fehler.
      </p>
      <p className="xsmall faint mono rescue__msg">
        {error.name}: {error.message}
      </p>
      <button type="button" className="btn btn--primary btn--block" onClick={() => window.location.reload()}>
        Neu laden
      </button>
      {file ? (
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => {
            const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
            if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
              void nav.share({ files: [file], title: file.name }).catch(() => undefined);
              return;
            }
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            a.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
          }}
        >
          Rohdaten teilen
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--secondary btn--block"
          onClick={() => {
            setStatus('Lese Rohdaten …');
            void rawExport()
              .then((r) => {
                setFile(new File([r.json], r.name, { type: 'application/json' }));
                setStatus(`${r.rows} Einträge gelesen. Jetzt teilen oder sichern.`);
              })
              .catch((e: unknown) => setStatus(`Rohdaten nicht lesbar: ${String(e)}`));
          }}
        >
          Rohdaten sichern
        </button>
      )}
      {status && <p className="small muted">{status}</p>}
    </main>
  );
}

import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Banner, Button } from '../ui/primitives';

/** Hinweis, wenn eine neue App-Version bereitliegt. Aktualisiert erst nach Tap (keine verlorenen Eingaben). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Stündlich nach Updates schauen, solange die App offen ist.
      if (reg) window.setInterval(() => void reg.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="update-prompt">
      <Banner
        icon={RefreshCw}
        tone="accent"
        action={
          <div className="row" style={{ gap: 0 }}>
            <Button variant="ghost" size="s" onClick={() => setNeedRefresh(false)}>
              Später
            </Button>
            <Button
              variant="ghost"
              size="s"
              className="accent"
              onClick={() => void updateServiceWorker(true)}
            >
              Aktualisieren
            </Button>
          </div>
        }
      >
        Neue Version verfügbar.
      </Banner>
    </div>
  );
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/ui.css';
import './styles/screens.css';
import { App } from './App';
import { archiveRetiredGoals } from './db/repo';
import { ensureDailySnapshot, ensureMigrationSnapshot } from './lib/backup';
import { RootBoundary } from './shell/RootBoundary';

// Dauerhaften Speicher anfragen, damit iOS/Browser die Daten nicht bei Speicherdruck verwerfen.
void navigator.storage?.persist?.().catch(() => undefined);

// Automatische Tages-Sicherung (max. 1 pro Tag, die letzten 7 bleiben). Läuft nach dem ersten Rendern,
// und erneut, wenn die App nach längerer Zeit wieder in den Vordergrund kommt (iOS hält PWAs tagelang offen).
const snapshot = () =>
  void ensureMigrationSnapshot()
    // erst nach der Sicherung „vor-v3“: Ziele entfallener Kennzahlen (Protein) archivieren
    .then(() => archiveRetiredGoals())
    .then(() => ensureDailySnapshot())
    .catch((e: unknown) => console.warn('Snapshot fehlgeschlagen', e));
window.setTimeout(snapshot, 1500);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') snapshot();
});

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </StrictMode>,
);

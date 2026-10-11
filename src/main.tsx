import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/ui.css';
import './styles/screens.css';
import { App } from './App';

// Dauerhaften Speicher anfragen, damit iOS/Browser die Daten nicht bei Speicherdruck verwerfen.
void navigator.storage?.persist?.().catch(() => undefined);

const root = document.getElementById('root');
if (!root) throw new Error('#root fehlt in index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

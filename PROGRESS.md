# PROGRESS

## Phase 0 – Planung ✓
- `PLAN.md` mit Phasen, Datenmodell, Komponentenbaum, Risiken.

## Phase 1 – Setup ✓
**Fertig:** Vite 8 + React 19 + TS 6 (strict, `noUncheckedIndexedAccess`), ESLint 10 (typescript-eslint strict, react-hooks, `--max-warnings 0`), Prettier, Vitest 5 (+ fake-indexeddb), Playwright 1.64 (Chromium, 390×844, de-DE, Europe/Berlin), vite-plugin-pwa (Manifest, generateSW, Prompt-Update), Icons + 10 iPhone-Splashscreens, lokale Schriften, `tokens.css`, `base.css` (Verlauf, Frost-Rauschen), `DESIGN.md`.

**Geprüft:** typecheck ✓ · lint ✓ · test ✓ (21 Kontrast-Tests) · build ✓ · E2E ✓ (Manifest, Start) · Screenshot `01-setup` angesehen.

**Gefundene und behobene Fehler:**
- Splash-Screen zeigte ein sichtbares Quadrat, weil der Icon-Verlauf nicht in `--color-bg` auslief. Verlauf korrigiert, neu generiert, geprüft.
- `--color-text-3` auf `--color-surface-3` lag unter 4.5:1. Der Token wurde aufgehellt, der Kontrast-Test fängt das künftig ab.
- Test- und E2E-Dateien liefen im falschen tsconfig-Kontext. Dafür gibt es jetzt ein eigenes `tsconfig.test.json`, Node-Config auf `bundler`.

**Offen:** –

## Phase 2 – Datenschicht ✓
**Fertig:** Dexie-Schema v1 (16 Tabellen, Indizes, Seed: Fächer, Übungen, Mahlzeitvorlage), Zod-Schemas für alle Entitäten + Einstellungen, Repositories mit Validierung (deutsche Fehlermeldungen), Datumslogik Europe/Berlin, Berechnungen: Session-Load, akute/chronische Last, PR-Erkennung (Gewicht + Epley-1RM), Saisonstatistik, Schlafdauer, Notenschnitt/Punkte→Note, Fristen-Warnstufen, Streaks, Habit-Quote, Heatmap-Stufen, Tagesring, Gruppenvergleich/Korrelation. `ARCHITECTURE.md`.

**Geprüft:** typecheck ✓ · lint ✓ · test ✓ (77 Tests, u. a. DST-Nächte März/Oktober, Mitternacht, Silvester, Schaltjahr, Timer über Mitternacht + Neuladen, Health überschreibt keine manuellen Daten) · build ✓ · E2E unverändert grün (keine neue UI in dieser Phase).

**Gefundene und behobene Fehler:**
- `stamp()`-Generics: Objektliterale scheiterten in TS 6 an der Prüfung auf überzählige Properties gegen `Partial<Meta>`. Das Generic ist jetzt `V extends object`, die Typprüfung übernimmt `validate`.
- Non-null-Assertions in Tests durch explizite Guards ersetzt.

**Selbst-Review:** Randfälle abgedeckt: leere Listen (Schnitt/Statistik → null statt NaN), Division durch 0, Ende vor Start, zukünftige Einheiten zählen nicht zur Last, erste Gym-Einheit ist Basis statt Fake-PR.


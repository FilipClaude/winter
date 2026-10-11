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

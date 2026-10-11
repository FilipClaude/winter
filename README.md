# Winter

Persönliche Daily-Tracking-App für Filip: Training & Fußball, Schule & FernUni, Ernährung & Schlaf, Habits, Stimmung, Journal und Rückblick. Sie läuft als **PWA** auf dem iPhone, **offline-first** (IndexedDB), ohne Konto und ohne Cloud. Gestaltung: dunkel, winterlich, schlicht, eine Akzentfarbe (Eisblau).

## Start

Voraussetzung: Node.js ≥ 20.19 (getestet mit 24 LTS), Windows/macOS/Linux.

```bash
npm install
```

```bash
npm run dev
```

Öffnet <http://localhost:5173>. Für den iPhone-Viewport in den Browser-Entwicklertools 390×844 wählen. Zum Ausprobieren: **Einstellungen → Demo-Daten** einschalten.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Typecheck + Produktions-Build mit Service Worker nach `dist/` |
| `npm run preview` | Build lokal ausliefern (Port 4173) |
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint, keine Warnungen erlaubt |
| `npm run format` | Prettier |
| `npm run test` | Vitest: Logik, Datenschicht, Kontrast, Token-Farben |
| `npm run e2e` | Build + alle Playwright-Tests (iPhone-Viewport, Offline, Barrierefreiheit) |
| `npm run screens` | Build + nur die Screenshot-Tests → `screens/` |
| `npm run icons` | Icons und Splashscreens aus `public/icon.svg` neu erzeugen |
| `npm run check` | typecheck + lint + test + build |

Beim ersten Mal für die E2E-Tests den Browser installieren: `npx playwright install chromium`.

## Struktur

```
src/
  App.tsx, main.tsx, router.ts     Shell, Hash-Router
  db/                              Dexie-Schema, Zod-Schemas, Repositories, Seed
  lib/
    date.ts                        Europe/Berlin, Zeitumstellung, Mitternacht
    calc/                          reine Berechnungen (Load, ACWR, PRs, Streaks, Noten, Ring, Zusammenhänge)
    health/                        HealthSource-Interface, JSON-Parser
    backup.ts, markdown.ts, demo.ts, download.ts
  screens/                         today, training, school, body, habits, review, settings, quickadd, health
  shell/                           Tab-Leiste, Update-Hinweis, Schneefall
  ui/                              Bausteine, Charts, Sheets/Toasts
  styles/                          tokens.css (einzige Farbquelle), base, ui, screens
e2e/                               Playwright-Tests
public/                            Icons, Splashscreens, _headers
```

## Dokumente

- [PLAN.md](PLAN.md): Phasen, Datenmodell, Komponentenbaum, Risiken
- [DESIGN.md](DESIGN.md): Design-System und Tokens
- [ARCHITECTURE.md](ARCHITECTURE.md): Datenmodell, Zeitlogik, Migrationen, Health-Anbindung
- [DECISIONS.md](DECISIONS.md): getroffene Entscheidungen mit Begründung
- [PROGRESS.md](PROGRESS.md): Fortschritt, Prüfungen, gefundene Fehler, ehrliche Zusammenfassung
- [DEPLOY.md](DEPLOY.md): kostenlos mit HTTPS hosten und am iPhone installieren
- [HEALTH-SHORTCUT.md](HEALTH-SHORTCUT.md): iOS-Kurzbefehl für Apple-Health-Daten

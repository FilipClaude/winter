# Winter

Persönliche Daily-Tracking-App für Filip: Training & Fußball (mit BFV-Spielplan und Tabelle), Schule (Noten, Klausuren, Abi-Rechner, Lernplan, Stundenplan) & FernUni, Ernährung & Schlaf, Habits, Stimmung, Journal, Rückblick mit Wochenbericht. Sie läuft als **PWA** auf dem iPhone, **offline-first** (IndexedDB), ohne Konto und ohne Cloud. Gestaltung: ein Winterhimmel nach echter Tageszeit in München, Glas-Karten, eine Akzentfarbe (Eisblau).

Live: <https://filipclaude.github.io/winter/> (GitHub Pages, Deploy bei jedem Push nach grüner CI).

## Start

Voraussetzung: Node.js ≥ 20.19 für App und Build, ≥ 22.18 für die TypeScript-Skripte in `scripts/` (BFV-Abgleich, Startbildschirme; Node führt sie direkt aus). Getestet mit 24 LTS, Windows/macOS/Linux.

```bash
npm install
```

```bash
npm run dev
```

Öffnet <http://localhost:5173>. Für den iPhone-Viewport in den Browser-Entwicklertools 390×844 wählen. Beim ersten Start erscheint die Einführung; dort oder unter **Einstellungen → Demo-Daten** lässt sich alles mit Beispieldaten ausprobieren.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Typecheck + Produktions-Build mit Service Worker nach `dist/` (mit `BASE_PATH=/winter/` wie live) |
| `npm run preview` | Build lokal ausliefern (Port 4173) |
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint, keine Warnungen erlaubt |
| `npm run format` | Prettier |
| `npm run test` | Vitest: Logik, Datenschicht, Migration v1 → v2, BFV-Parser, Kontrast |
| `npm run e2e` | Build + alle Playwright-Tests (Chromium, WebKit, Offline, visuell) |
| `npm run screens` | Build + nur die Screenshot-Tests → `screens/` |
| `npm run icons` | Icons und Nachthimmel-Startbildschirme aus `public/icon.svg` bzw. `scripts/splash.ts` |
| `npm run lighthouse` | Build + Lighthouse (mobil) |
| `npm run check` | typecheck + lint + test + build |
| `node scripts/bfv-sync.ts` | BFV-Abgleich lokal (schreibt `public/data/bfv.json`) |

Beim ersten Mal für die E2E-Tests die Browser installieren: `npx playwright install chromium webkit`. Visuelle Referenzbilder nach gewollten Änderungen: `npx playwright test visual --update-snapshots=all`, danach ansehen.

## Struktur

```
src/
  App.tsx, main.tsx, router.ts     Shell, Hash-Router
  db/                              Dexie-Schema (v2), Zod-Schemas, Repositories, Seed
  lib/
    date.ts                        Europe/Berlin, Zeitumstellung, Mitternacht
    calc/                          reine Berechnungen (Load, Abi, Lernplan, Ferien, Ziele, Trends, Wochenbericht …)
    bfv/                           BFV-Parser (iCal, Tabelle) und App-Logik
    sky/                           Sonne, Mond, Himmelsphasen
    health/                        HealthSource-Interface, JSON-Parser
    backup.ts, rescue.ts, markdown.ts, demo.ts, download.ts
  screens/                         today, training, school, body, habits, review, settings, quickadd, health
  shell/                           Himmel, Fehlergrenzen, Einführung, Tab-Leiste, Update-Hinweis
  ui/                              Bausteine, Charts, Sheets/Toasts, Motion-Tokens
  styles/                          tokens.css (einzige Farbquelle), base, ui, screens
scripts/                           BFV-Abgleich, Startbildschirme, Lighthouse
e2e/                               Playwright-Tests (+ visuelle Referenzbilder)
public/                            Icons, Startbildschirme, data/bfv.json
.github/workflows/                 pages.yml (CI + Deploy), bfv-sync.yml (BFV täglich)
```

## Dokumente

- [PLAN-v2.md](PLAN-v2.md) / [PLAN.md](PLAN.md): Phasen, Risiken, Migrationsplan
- [DESIGN.md](DESIGN.md): Design-System, Tokens, Himmel
- [ARCHITECTURE.md](ARCHITECTURE.md): Datenmodell v2, Zeitlogik, Migrationen, Health, BFV
- [DECISIONS.md](DECISIONS.md): getroffene Entscheidungen mit Begründung
- [PROGRESS.md](PROGRESS.md): Fortschritt, Prüfungen, gefundene Fehler, ehrliche Zusammenfassung
- [docs/BFV.md](docs/BFV.md): BFV-Abgleich, Grenzen, Reparaturanleitung
- [DEPLOY.md](DEPLOY.md): Hosting und Installation am iPhone
- [HEALTH-SHORTCUT.md](HEALTH-SHORTCUT.md): iOS-Kurzbefehl für Apple-Health-Daten

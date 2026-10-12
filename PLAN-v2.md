# PLAN v2 – „Winter“ vom Prototyp zur professionellen App

Auftrag: `Persönlich/Daily-App Prompt v2.md` (Obsidian). Ausgangsstand: v1 live unter `https://filipclaude.github.io/winter/`, Filip nutzt die App mit **echten Daten**.

## Phasen und Zeitbudget (≈ 5 h)

| # | Phase | Budget | Ergebnis |
|---|---|---|---|
| 0 | Bestandsaufnahme | 15 min | v1-Referenz-Screenshots (`screens/v1-ref`), dieser Plan |
| 1 | Sicherheitsnetz | 30 min | v1-Fixture + Migrationstests, CI mit E2E (Chromium + WebKit) als Deploy-Schranke, Error Boundary, Auto-Snapshots |
| 2 | Design-System v2 | 25 min | Tokens (Typo-Skala, Motion, Glas-Elevation), Komponenten: StatTile, Sparkline, ListRow, Skeleton, Chart-Tooltip |
| 3 | Winterhimmel | 35 min | Sonnen-/Mondberechnung (Tests), Himmelsphasen, Alpen, Schnee in 3 Ebenen, Wetter-Option, Phasen-Glas mit AA-Tests, CPU-Messung |
| 4 | Abi-Rechner | 35 min | Regelrecherche (Quellen), konfigurierbare Regeln, Einbringungs-Optimierung, Szenario, Warnungen, handgerechnete Tests |
| 5 | Noten, Klausuren, Lernplan, Stundenplan, Ferien | 35 min | Leistungsnachweise mit Gewichtung, Klausur-Detail (Themen-Checkliste, Reflexion), Lernplan-Generator (Spaced Repetition), Pomodoro, Stundenplan A/B, Ferien Bayern 2026/27 |
| 6 | FernUni-Ausbau | 15 min | EA-Punkte, Prüfungsberechtigung pro Modul, Eskalation, Notizen |
| 7 | Dashboard | 30 min | Widgets anordnen/ausblenden/2 Größen, Tagesbriefing, Ziele |
| 8 | Insights & Wochenbericht | 25 min | Pearson r + n + Klartext, gleitende Ø, Jahres-Heatmap, Wochenbericht + Markdown |
| 9 | BFV | 35 min | Erkundung (`docs/BFV.md`), `scripts/bfv-sync.ts`, Action, App-Integration, Saisonstatistik |
| 10 | Feinschliff | 20 min | Onboarding, Leerzustände, Icon/Splash Nachthimmel |
| 11 | Abschluss-Audit | 20 min | CI, Live-Prüfung, Lighthouse, axe, CPU, ehrliche Zusammenfassung |

Nach jeder Phase: Selbstkontrolle laut Auftrag (Checks, E2E Chromium + WebKit, Screenshots ansehen, Daten-Check, Selbst-Review, `PROGRESS.md`, Commit, Push erst bei Grün, Workflow + Live-Seite prüfen). Nach jeder zweiten Phase: unabhängiger Reviewer-Subagent.

## Migrationsplan (Dexie v1 → v2)

Grundsatz: **nur hinzufügen**. Bestehende Tabellen und Felder bleiben, neue Felder sind optional oder bekommen im Upgrade einen Standardwert.

| Änderung | Art | Upgrade |
|---|---|---|
| `grades` (Leistungsnachweise: Fach, Halbjahr, Art, Punkte, Gewicht, Datum) | neue Tabelle | – |
| `abi` (Halbjahresergebnisse pro Fach/Halbjahr, Prüfungsfächer, Prüfungspunkte) | neue Tabelle | – |
| `studyBlocks` (Lerneinheiten aus dem Lernplan: Datum, Fach, Klausur, Thema, Art, Minuten, erledigt) | neue Tabelle | – |
| `lessons` (Stundenplan: Wochentag, Stunde, Fach, Raum, Woche A/B/beide) | neue Tabelle | – |
| `goals` (Wochen-/Monatsziele: Kennzahl, Zielwert, Zeitraum) | neue Tabelle | – |
| `snapshots` (automatische Tages-Sicherungen, max. 7) | neue Tabelle, **nicht** im Backup | – |
| `bfvLinks` / Spiel-Felder `bfvId`, `prefill` | optionale Felder an `sessions` | – |
| `exams`: `topicList`, `reflection`, `semester` | optionale Felder | – |
| `todos`: `priority`, `repeat` | optionale Felder | – |
| `modules`: `rule`, `note` / `deadlines`: `points`, `maxPoints` | optionale Felder | – |

- `SCHEMA_VERSION` 1 → 2. `migrateBackup()` hebt v1-Backups an (fehlende Tabellen = leer). Import alter Backups bleibt dauerhaft möglich.
- **Beweis per Test:** v1-Fixture (`src/test/fixtures/backup-v1.json`, erzeugt **vor** jeder Schemaänderung aus den Demo-Daten mit dem v1-Code) → (a) in eine echte v1-Dexie-DB schreiben, mit v2 öffnen, alles noch da; (b) v1-Backup in v2 importieren, alles da; (c) v2-Roundtrip identisch.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Datenverlust bei Filip durch Migration | Nur additive Änderungen, Fixture-Tests, Auto-Snapshots vor dem ersten v2-Start, CI-Schranke |
| Abi-Regeln falsch | Nur belegte Werte, Regeln als Datenstruktur, unsichere Werte in UI + `DECISIONS.md` markiert, Quellen |
| BFV ändert Seite / verbietet Abruf | Validierung, alte Datei behalten, Workflow rot, manueller Fallback, ehrliche Doku |
| Himmel kostet Akku | Eine Canvas, 30 fps, Pause bei `visibilitychange`, DPR ≤ 2, statisch bei reduzierter Bewegung, CPU gemessen |
| Kontrast auf hellem Taghimmel | Phasenabhängige Glas-Tönung, automatischer AA-Test pro Phase |
| WebKit unter Windows weicht vom iPhone ab | Trotzdem als Annäherung in CI (Linux-WebKit), Grenzen dokumentiert |
| Zeit reicht nicht für alles | Reihenfolge nach Wert; Unfertiges ehrlich in `PROGRESS.md` |

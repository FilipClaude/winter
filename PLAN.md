# PLAN – „Winter“

Persönliche Daily-Tracking-PWA für Filip. Offline-first, iPhone-first (390×844), komplett deutsch.

## Phasen

| # | Phase | Ergebnis | Prüfung |
|---|---|---|---|
| 0 | Planung | `PLAN.md` | – |
| 1 | Setup | Vite + React + TS strict, ESLint, Prettier, Vitest, Playwright, PWA-Grundgerüst, Icons, Fonts lokal, `tokens.css`, `DESIGN.md` | typecheck/lint/test/build, Screenshot leerer Shell |
| 2 | Datenschicht | Dexie-Schema v1 + Migrationsgerüst, Zod-Schemas, Repositories, Berechnungs-Module + Unit-Tests | Unit-Tests für Load, ACWR, Streaks, Schlaf über Mitternacht/Zeitumstellung, Notenschnitt, Datumsgrenzen, Fristen |
| 3 | App-Shell | Tab-Leiste, Router, Header mit Einstellungen, Heute-Screen, Schnellerfassung (Bottom-Sheet) | E2E: Navigation, Wasser/Protein über Schnellerfassung, Tag wischen; Screenshots |
| 4 | Training & Körper | Einheiten, Spiel, Gym mit Vorlagen + PR, Belastung, Wochenplan, Mahlzeiten + Vorlagen, Wasser, Schlaf | E2E: Gym-Einheit → Verlauf → PR, Spiel → Saisonstatistik, Mahlzeit-Vorlage |
| 5 | Schule | Fächer, Lern-Timer (persistente Startzeit), To-dos, Klausuren + Noten, FernUni-Module + Fristen (14/7/2 Tage) | E2E: Timer übersteht Reload, Frist erscheint als Warnung auf Heute |
| 6 | Habits, Stimmung, Journal, Rückblick | Habits + Streaks + Heatmap, Stimmung/Energie, Tagesnotiz, Woche/Monat, Zusammenhänge, Saisonübersicht | E2E: Habit abhaken → Streak, Journal speichern; Screenshots Charts |
| 7 | Health, Backup, Einstellungen, Demo | `HealthSource`-Interface, Clipboard/Text/Datei-Import, Backup JSON Export/Import mit Vorschau, Markdown-Export, persist(), Demo-Daten | E2E: Health-JSON einfügen, Backup → löschen → Import → alles da, Demo an/aus |
| 8 | Feinschliff | Animationen, Leerzustände, Performance, a11y, Schneefall | Screenshots aller Screens, Kontrastprüfung |
| 9 | Abschluss-Audit | Alle E2E, frischer Start, Lighthouse, Offline-Test im Preview, ehrliche Zusammenfassung | `PROGRESS.md` |

Nach jeder Phase: Prüfzyklus (typecheck, lint, test, build, E2E, Screenshots ansehen, Selbst-Review, `PROGRESS.md`) und git-Commit.

## Datenmodell (Kurzfassung, Details in `ARCHITECTURE.md`)

Alle Einträge: `id` (UUID), `date` (`YYYY-MM-DD`, Kalendertag in Europe/Berlin), `createdAt`, `updatedAt` (ISO-Instant), optional `demo: 1`.

| Tabelle | Inhalt |
|---|---|
| `sessions` | Trainingseinheit: `type` (football/match/gym/run/recovery/other), `durationMin`, `rpe`, `note`, optional `match` {Gegner, Ergebnis, Minuten, Tore, Assists, Schüsse, Note}, optional `gym` {Übungen → Sätze (Wdh., kg)} |
| `exerciseTemplates` | Übungsvorlagen (Name, zuletzt verwendete Sätze) |
| `meals` | Mahlzeit: Name, kcal, Protein |
| `mealTemplates` | Mahlzeiten-Vorlagen |
| `days` | Tageswerte, die einmal pro Tag existieren: Wasser (Gläser), Stimmung, Energie, Tagesnotiz, Gut lief/Besser machen/Morgen wichtig |
| `sleep` | Manueller Schlaf: Bettzeit, Aufwachzeit (Instants), Qualität 1–5; `date` = Aufwachtag |
| `health` | Importierte Health-Werte pro Tag (Schritte, km, Stockwerke, Schlaf), getrennt von manuellen Einträgen |
| `subjects` | Fächer (editierbar, sortierbar) |
| `studySessions` | Lernzeit: Fach, Start, Ende, Minuten |
| `todos` | Hausaufgaben/To-dos: Fach, Fälligkeit, erledigt |
| `exams` | Klausuren/Kurzarbeiten: Fach, Datum, Themen, Lernstand %, Punkte 0–15 |
| `modules` | FernUni-Module |
| `deadlines` | Einsendearbeiten/Prüfungstermine: Modul, Fälligkeit, erledigt |
| `habits` | Habit: Name, Rhythmus (täglich / Wochentage), Reihenfolge, archiviert |
| `habitChecks` | Abhaken: Habit + Datum |
| `kv` | Einstellungen, Ziele, Wochenplan, laufender Timer, letztes Backup |

## Komponentenbaum

```
App
├─ UpdatePrompt (Service-Worker-Update)
├─ Snowfall (optional)
├─ Screen (Router: #/heute, #/training, #/schule, #/koerper, #/rueckblick, #/einstellungen, #/habits …)
│  ├─ TodayScreen: DateHeader, DayRing, HealthCard, NutritionCard, DeadlineCard, TrainingCard, HabitList, MoodCard, JournalCard
│  ├─ TrainingScreen: LoadPanel, WeekPlan, SessionList, SeasonStats  → SessionSheet (GymEditor, MatchFields)
│  ├─ SchoolScreen: StudyTimer, DeadlineList, ExamList, TodoList, SubjectStats, GradeTable → Sheets
│  ├─ BodyScreen: NutritionPanel, MealTemplates, SleepPanel, HealthHistory → Sheets
│  ├─ ReviewScreen: PeriodSwitch, Kennzahlen, Charts, Zusammenhänge, Saison
│  ├─ HabitsScreen: Heatmap, Streaks, Verwaltung
│  └─ SettingsScreen: Ziele, Fächer, Wochenplan, Health, Backup, Markdown, Speicher, Demo, Darstellung
├─ TabBar + QuickAddButton
└─ QuickAddSheet → Formular-Sheets
UI-Bausteine: Card, Button, IconButton, Sheet, Field, Stepper, Segmented, Rating, NumberTicker, Ring, FrostCheck, Charts (Bar, Line, Heatmap, Compare), EmptyState, Toast
```

## Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| iOS löscht Website-Daten (7-Tage-Regel ohne Nutzung, Speicherdruck) | `storage.persist()`, Backup-Erinnerung nach 7 Tagen, einfacher Export über Teilen-Menü |
| Kurzbefehl → URL öffnet Safari statt der PWA (getrennter Speicher) | Datenübergabe nur über Zwischenablage / Datei, nie per URL |
| `clipboard.readText()` braucht Nutzergeste, kann verweigert werden | Extra-Tap „Werte einfügen“, Fallback Textfeld und Datei-Import |
| Zeitzonen/Zeitumstellung (25.10.2026, 29.03.2026) | Kalendertage als String, Rechnen über UTC-Mittag; Zeitpunkte als Instants; Tests für DST-Nächte |
| Paketversionen neuer als bekanntes Wissen (TS 7, Vite 8, Zod 4) | Offizielles Vite-Template als Basis, Abweichungen in `DECISIONS.md` |
| Echter Kurzbefehl und iOS-Verhalten nicht testbar auf Windows | Parser robust (Komma-Dezimalen, Strings, fehlende Werte), ehrlich dokumentiert |
| Schema-Änderungen später | Dexie-Versionen ab v1, Backup trägt `schemaVersion`, Import migriert |
| Charts ohne Bibliothek | Kleine eigene SVG-Komponenten, nur Token-Farben |

# PLAN v3 – „Winter“ umbauen, entschlacken, schärfen

Auftrag: `Persönlich/Daily-App Prompt v3.md` (Obsidian). Ausgangsstand: v2 „Winterhimmel“ live unter `https://filipclaude.github.io/winter/`, Filip nutzt die App täglich mit **echten Daten**. Basis vor dem Umbau: Typecheck, Lint, **1050 Unit-Tests**, E2E (Chromium + WebKit) grün; Referenzbilder v2 in `screens/v2-ref/` (7 Screens × Nacht/Tag + Einführung).

## Phasen und Zeitbudget (≈ 3 h)

| # | Phase | Budget | Ergebnis |
|---|---|---|---|
| 0 | Bestandsaufnahme | 15 min | dieser Plan, Fundstellen, Basis-Tests, v2-Referenzbilder |
| 1 | Sicherheitsnetz | 20 min | eingefrorene v2-Fixture (Protein, Wasser, Mahlzeiten, Vorlagen, FernUni-Module/-Fristen/-Lernzeit, Ziele mit `avgProtein`, eigenes Dashboard), Dexie v3 additiv, Tests: Migration, Backup-Roundtrip, Import v1 + v2 |
| 2 | FernUni und Ernährung raus | 30 min | UI, Briefing, Hinweise, Widgets, Export, Ziele, Einstellungen, Demo; Test „kein Uni-/Ernährungstext“ |
| 3 | Nächste Klausur | 20 min | Widget auf Heute (+ Layout-Migration), Hero-Karte im Schule-Tab, Countdown-Tests (Mitternacht, 25.10.2026) · **Review 1** |
| 4 | Probe-Klausuren | 20 min | Tabelle `mockExams`, Sheet, %/NP mit anpassbarer Tabelle, Trend je Klausur und Fach |
| 5 | Gym-Split | 10 min | `split` an Sessions, Segment im Sheet, überall sichtbar, Verteilung im Rückblick |
| 6 | Verdienst | 25 min | Tabelle `earnings`, Widget + Sheet, Wochenziel, Ziel-Metrik, Wochenbericht, Rückblick 8 Wochen · **Review 2** |
| 7 | Tagesring neu | 10 min | Habits, Lernen, Schlaf, Training, Verdienst; Settings-Migration |
| 8 | Großes Aufräumen | 20 min | Screen für Screen, Tab-Struktur (Körper), Standard-Reihenfolge, Leerzustände, Bundle vorher/nachher · **Review 3** |
| 9 | Abschluss-Audit + Obsidian | 15 min | CI, Live, Offline, Lighthouse, axe, ehrliche Zusammenfassung, README-Anleitung, Vault |

Nach jeder Phase die Selbstkontrolle aus dem Auftrag (Checks, E2E Chromium + WebKit, Screenshots 390 × 844 Nacht/Tag mit Daten und leer ansehen, Daten-Check, Selbst-Review, `PROGRESS.md`, Commit, Push nur bei Grün, Workflow + Live prüfen).

## Migrationsplan (Dexie v2 → v3)

Grundsatz wie in v2: **nur hinzufügen**, nichts löschen, im `upgrade` nichts schreiben (DECISIONS #25, #35).

| Änderung | Art | Upgrade |
|---|---|---|
| `earnings` (id, date, amountCents, note?) | neue Tabelle, Index `date, demo` | – |
| `mockExams` (Probe-Durchgänge: id, date, examId, subjectId, points, maxPoints, durationMin?, note?) | neue Tabelle, Index `date, examId, subjectId, demo` | – |
| `sessions.split` (`push`/`pull`/`legs`) | optionales Feld | – |
| Einstellungen: `ring.training`, `ring.earnings`, `earnings.weeklyGoalCents`, `npScale` | neue Schlüssel mit Standardwert (`parseSettings` ergänzt sie) | – |
| Einstellungen: `ring.protein`, `ring.water`, `goals.proteinG/kcal/waterGlasses`, `glassMl` | **bleiben im Schema**, werden nicht mehr angezeigt | – |
| Dashboard: `nutrition`, `deadlines` fallen aus der Anzeige, `nextExam`, `earnings` kommen dazu | gespeicherte Anordnung wird beim Lesen angepasst (alte IDs bleiben gültig) | – |
| `meals`, `mealTemplates`, `modules`, `deadlines`, `days.water`, FernUni-Fach | **bleiben** in DB, Backup, Rettungs-Export und Snapshots | – |
| Ziele mit `avgProtein` | werden archiviert (`archived: true`), nicht gelöscht | beim Lesen bzw. einmalig nach dem Öffnen |

- `SCHEMA_VERSION` 2 → 3. `migrateBackup()` hebt v1/v2-Backups an (neue Tabellen leer).
- Sicherung „vor-v3“ nach dem ersten Öffnen (wie „vor-v2“), 30 Tage aufbewahrt.
- **Beweis per Test:** v2-Fixture `src/test/fixtures/backup-v2.json`, erzeugt **vor** der Schemaänderung mit dem v2-Code → (a) echte v2-Dexie-DB mit v3 öffnen, jeder Datensatz identisch; (b) v2-Backup in v3 importieren, alles da; (c) v3-Roundtrip identisch; (d) v1-Backup weiterhin importierbar; (e) Backup nach v3 enthält Mahlzeiten, Wasser, Module und Fristen unverändert.

## Fundstellen (grep vor dem Umbau)

**FernUni** (`fernuni|einsende|modul|deadline|Prüfungsberechtig`, 237 Treffer in 23 Dateien ohne Tests):
`db/db.ts`, `db/repo.ts`, `db/schemas.ts`, `db/seed.ts` (Fach „FernUni“), `lib/backup.ts`, `lib/calc/abi-setup.ts`, `lib/calc/briefing.ts`, `lib/calc/fernuni.ts`, `lib/calc/school.ts` (Fristen-Warnstufen), `lib/demo.ts`, `lib/markdown.ts`, `screens/quickadd/QuickAddSheet.tsx` (FernUni-Frist), `screens/school/AbiView.tsx`, `DeadlineAlerts.tsx`, `GradesView.tsx`, `PlanView.tsx`, `school-utils.ts`, `SchoolScreen.tsx` (Tab FernUni, Module, Eyebrow „Frühstudium“), `SchoolSheets.tsx` (DeadlineSheet), `screens/settings/SettingsScreen.tsx`, `screens/today/TodayScreen.tsx` (Hinweise & Fristen, Nächster Termin), `widget-meta.ts` (kritische Fristen), `widgets.tsx` (Briefing).

**Ernährung** (`protein|meal|mahlzeit|kcal|water|wasser|glass|ernährung|nutrition`, 246 Treffer in 24 Dateien ohne Tests):
`db/db.ts`, `db/repo.ts`, `db/schemas.ts`, `db/seed.ts` (Mahlzeit-Vorlage), `lib/backup.ts`, `lib/calc/goals.ts` (`avgProtein`), `review.ts`, `ring.ts`, `trends.ts`, `weekly.ts`, `lib/demo.ts`, `lib/markdown.ts`, `screens/body/BodyScreen.tsx`, `MealSheet.tsx`, `screens/quickadd/QuickAddSheet.tsx`, `screens/review/ReviewScreen.tsx`, `screens/settings/SettingsScreen.tsx`, `screens/today/Reminders.tsx`, `TodayScreen.tsx`, `useDayData.ts`, `widget-meta.ts`, `widgets.tsx`, `shell/Sky.tsx` (nur `glass` der Himmelsphasen – kein Treffer im Sinne der Ernährung).

E2E mit betroffenen Abläufen: `body`, `dashboard`, `data`, `habits-review`, `offline`, `safety`, `school`, `school-v2`, `today`.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Datenverlust (Mahlzeiten, Wasser, FernUni) beim Umbau | Tabellen und Felder bleiben, Fixture-Tests mit echten v2-Strukturen, Sicherung „vor-v3“, CI-Schranke |
| Gespeichertes Dashboard enthält entfallene IDs → Zod verwirft die ganze Anordnung | Schema akzeptiert alte IDs weiter; Normalisierung entfernt sie nur aus der Anzeige; Test mit eigenem v2-Layout |
| Zod entfernt unbekannte Einstellungsfelder beim Speichern | Alte Felder (`ring.protein`, `glassMl` …) bleiben im Schema |
| Uni-Text rutscht irgendwo durch (Fach „FernUni“ in Auswahllisten, Lernzeit nach Fach) | zentrale Funktion `isUniSubject`, E2E-Suche über alle Screens/Sheets mit FernUni-Daten |
| NP-Umrechnung weicht vom Schulschlüssel ab | Tabelle anpassbar, sichtbar als „Schätzung“, Begründung in DECISIONS |
| Wochen- und Zeitgrenzen (So 23:59 / Mo 00:00, KW 1, 25.10.2026) | reine Funktionen auf Berliner Kalendertagen, eigene Tests |
| Körper-Tab wird zu dünn | Phase 8 entscheidet über die Aufteilung, Routen bleiben erreichbar (alte Lesezeichen) |
| Zeit reicht nicht | Reihenfolge nach Wert; Unfertiges ehrlich in `PROGRESS.md` |

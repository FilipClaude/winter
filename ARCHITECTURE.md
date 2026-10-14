# ARCHITECTURE – „Winter“

## Überblick

```
React-UI (src/screens, src/ui)
   │  liest per useLiveQuery (dexie-react-hooks) – Änderungen erscheinen sofort überall
   │  schreibt nur über Repositories
   ▼
Repositories (src/db/repo.ts)  ── validieren jede Eingabe mit Zod (src/db/schemas.ts)
   ▼
Dexie / IndexedDB (src/db/db.ts)  ── versioniertes Schema, Seed beim Erststart
   ▲
Reine Berechnungen (src/lib/calc/*)  ── ohne DB-Zugriff, vollständig unit-getestet
Datum/Zeit (src/lib/date.ts)          ── Europe/Berlin, Zeitumstellung
Health (src/lib/health/*)             ── HealthSource-Interface, Parser, Quellen
Backup/Export (src/lib/backup.ts, markdown.ts)
```

Kein Backend, kein Login. Alles liegt im IndexedDB des Geräts. Der Service Worker (Workbox, `generateSW`) precacht App-Shell, Schriften und Icons. Danach läuft die App komplett offline.

### v2: Shell und Sicherheitsnetz

```
main.tsx
 └─ RootBoundary (src/shell/RootBoundary.tsx)   ── fängt alles ab, Rettungs-Export direkt aus IndexedDB
     └─ DbGate                                  ── prüft db.open() ausdrücklich (sonst hinge die App still)
         └─ App (src/App.tsx)
             ├─ Sky (src/shell/Sky.tsx)         ── zwei Canvas: Himmel (selten neu) + Schnee (Animation)
             ├─ ScreenBoundary pro Screen       ── „Bereich neu laden“, Backup-Export
             ├─ TabBar, UpdatePrompt, Toasts
             └─ Onboarding (src/shell/Onboarding.tsx) ── nur echter Erststart (needsOnboarding)
```

- **Automatische Sicherungen** (`src/lib/backup.ts`, Tabelle `snapshots`, Index in `kv.snapshotIndex`): täglich (letzte 7), `vor-v2` bzw. `vor-v3` (nach einem Schema-Update, 30 Tage), `vor-import-*` (letzte 3); ausgesetzt bei > 50 % Speicherbelegung.
- **Himmel** (`src/lib/sky/*`): Sonnen-/Mondstand für München, 4 Phasen weich gemischt, Paletten-Tokens mit 582 Kontrasttests.
- **BFV** (siehe `docs/BFV.md`):

```
GitHub Action bfv-sync.yml (täglich)
  └─ scripts/bfv-sync.ts ── iCal-Export + Tabellen-HTML → src/lib/bfv/bfv.ts (parse, merge, Zod)
       └─ public/data/bfv.json (nur bei Änderung committet) → Deploy
App: useBfv() ── fetch (Netz zuerst, SW-Cache „winter-bfv“) → kv.bfv → BfvCard, Widget, Eintragen-Hinweis
```

## Zeit und Datum

- **Kalendertag** (`date`, `"2026-10-11"`) ist immer der Tag in **Europe/Berlin**, auch wenn das Gerät in einer anderen Zone ist. Rechnen (Tage addieren, Differenzen, Wochen) läuft über UTC-Mittag. Dadurch verschiebt eine Zeitumstellung nie einen Tag.
- **Zeitpunkte** (`createdAt`, `updatedAt`, Schlaf `start`/`end`, Lernzeit `start`/`end`) sind ISO-Instants in UTC. Dauern sind Differenzen von Instants. Die Nacht der Zeitumstellung hat dadurch korrekt 1 h mehr oder weniger.
- Wandzeiten aus Eingaben (`"23:30"`) werden mit `zonedToInstant` umgerechnet. Nicht existierende Zeiten (März) werden nach vorne verschoben, doppelte (Oktober) nehmen die erste.
- Lernzeit über Mitternacht wird an der Berliner Mitternacht auf zwei Tage aufgeteilt (`splitAtMidnight`).

## Datenmodell (Dexie-Schema v3)

Schema v1 ist in `V1_STORES` eingefroren, v2 (`V2_STORES`) ergänzt nur neue Tabellen und den Index `sessions.bfvId`, v3 (`V3_STORES`) nur die Tabellen `earnings` und `mockExams`. Alle neuen Felder an alten Tabellen sind optional – ältere Datensätze sind unverändert gültig.

**v3: ausgeblendet, nicht gelöscht.** `meals`, `mealTemplates`, `days.water`, `modules`, `deadlines` und das Fach „FernUni“ samt Lernzeiten, Klausuren, Aufgaben und Stunden bleiben vollständig in DB, Backup, Rettungs-Export und Snapshots. Die Oberfläche zeigt sie nicht mehr (`RETIRED_TABLES`, `isUniSubject`/`withoutUni` in `src/lib/calc/subjects.ts`); Ziele mit `avgProtein` werden nach dem Start archiviert.

Gemeinsame Felder aller Einträge: `id` (UUID bzw. Datum bei Tages-Datensätzen), `createdAt`, `updatedAt`, optional `demo: 1`. Einträge mit Tagesbezug haben `date`.

| Tabelle | Schlüssel / Indizes | Felder | Hinweis |
|---|---|---|---|
| `sessions` | id, date, type, demo | type, durationMin, rpe, note, match?, gym? | Load = Dauer × RPE wird berechnet, nicht gespeichert |
| `exerciseTemplates` | id, &name, order | name, lastSets, order | Wird beim Speichern einer Gym-Einheit aktualisiert |
| `meals` | id, date, demo | time?, name, kcal, proteinG, templateId? | |
| `mealTemplates` | id, order | name, kcal, proteinG, order | |
| `days` | id (= date), &date, demo | water, mood?, energy?, note, good, better, tomorrow | ein Datensatz pro Tag |
| `sleep` | id, date, demo | start, end, quality? | manuell, `date` = Aufwachtag |
| `health` | id (= date), &date, demo | steps?, distanceKm?, flights?, sleepStart?, sleepEnd?, source, importedAt | **nur** Importe |
| `subjects` | id, order | name, short, order, archived, major? | Seed: 11 Fächer (bis v2 zusätzlich „FernUni“, seit v3 ausgeblendet) |
| `studySessions` | id, date, subjectId, demo | start, end, minutes | |
| `todos` | id, date, due, subjectId, demo | title, done, doneAt? | `date` = angelegt |
| `exams` | id, date, subjectId, demo | kind, topics, progress, points? (0–15) | `date` = Termin |
| `modules` | id, demo | name, number, archived | FernUni – seit v3 ausgeblendet |
| `deadlines` | id, date, moduleId, demo | kind, title, time?, done | `date` = fällig |
| `habits` | id, order, demo | name, schedule, order, archived, startDate | schedule: täglich oder Wochentage |
| `habitChecks` | id, [habitId+date], date, habitId, demo | | ein Eintrag = abgehakt |
| `kv` | key | value | settings, timer, lastBackupAt, lastHealthImport, demoActive; v2 zusätzlich bfv, snapshotIndex, weather |
| **v2** `grades` | id, date, subjectId, semester, demo | size (groß/klein), type, points, weight, note, examId? | Klausur mit Punkten erzeugt/aktualisiert ihre Note |
| **v2** `semesterResults` | id (= `fach:halbjahr`), subjectId, semester, demo | points | Zeugnis überschreibt den berechneten Halbjahreswert |
| **v2** `studyBlocks` | id, date, subjectId, examId, demo | topic, kind (lernen/wiederholen), minutes, done | Lernplan-Generator |
| **v2** `lessons` | id, weekday, subjectId, demo | period, room, week (AB/A/B) | Stundenplan |
| **v2** `goals` | id, period, demo | metric, target, archived | Wochen-/Monatsziele |
| **v2** `snapshots` | id, createdAt | reason, schemaVersion, rows, data | automatische Sicherungen, nicht im Export |
| **v3** `earnings` | id, date, demo | amountCents (Ganzzahl > 0), note? | Verdienst, Woche = Mo–So (Berlin) |
| **v3** `mockExams` | id, date, examId, subjectId, demo | points, maxPoints (BE, Kommazahlen), durationMin?, note? | Probe-Durchgänge; Fach folgt der Klausur |

Neue optionale Felder in v3: `sessions.split` (push/pull/legs). Neue Einstellungen in v3: `ring.training`, `ring.earnings`, `earnings.weeklyGoalCents`, `npScale` (15 Schwellen Prozent → Punkte); `ring.protein/water`, `goals.proteinG/kcal/waterGlasses`, `glassMl` bleiben im Schema (ohne Wirkung), damit sie beim Speichern nicht verloren gehen.

Neue optionale Felder in v2: `sessions.bfv`/`bfvId`, `todos.priority`/`repeat`, `exams.topicList`/`reflection`/`semester`, `modules.rule`/`note`, `deadlines.points`/`maxPoints`. Einstellungen werden pro Schlüssel (und pro Unterfeld) geprüft; fehlende Schlüssel aus v1 bekommen Standardwerte, `onboarded` gilt bei vorhandenen Einstellungen als `true`.

### Regeln

- **Health vs. manuell:** Importe schreiben ausschließlich in `health`. Angezeigt wird beim Schlaf der manuelle Eintrag, wenn vorhanden, sonst der Health-Wert (`effectiveSleep`). Ein erneuter Import am selben Tag ersetzt nur die `health`-Zeile.
- **Lern-Timer:** `kv.timer = { subjectId, startedAt }`. Die laufende Zeit wird aus `startedAt` berechnet. Der Timer übersteht dadurch Schließen, Neuladen und Neustart.
- **Demo-Daten:** Alle Demo-Einträge tragen `demo: 1` (indiziert). Löschen läuft über `where('demo').equals(1).delete()` in jeder Tabelle. Echte Daten bleiben unberührt.
- **Validierung:** Jede Schreiboperation läuft durch das passende Zod-Schema. Fehler werden als `ValidationError` mit deutscher Meldung geworfen und in der UI als Hinweis gezeigt.

### Migrationen

`SCHEMA_VERSION` in `src/db/db.ts`. Eine neue Version wird **unter** der alten angehängt:

```ts
this.version(3).stores({ ...V2_STORES, neueTabelle: 'id, date, demo' }).upgrade((tx) => {
  // nur Markierungen setzen – keine schweren Schreibzugriffe (siehe unten)
});
```

Alte Versionen werden nie verändert. Backups enthalten `schemaVersion`. `migrateBackup()` in `src/lib/backup.ts` hebt ältere Backups vor dem Import an.

**Praxis seit v2 (DECISIONS #25, #35):** Migrationen sind rein additiv. Im `upgrade` wird nichts Großes geschrieben – scheitert ein Upgrade (z. B. Speicher voll), bliebe die App sonst bei jedem Start hängen. Die Sicherung „vor-v2“ entsteht *nach* dem Öffnen in einer normalen Transaktion (`ensureMigrationSnapshot`). Abgesichert durch eingefrorene Fixtures (`src/test/fixtures/backup-v1.json`, `backup-v2.json` mit Ernährung, FernUni und eigenem Dashboard), Migrationstests auf echten v1-/v2-Datenbanken und die E2E-Tests „Start mit echten v1-/v2-Daten“.

## Health-Anbindung

```
HealthSource (Interface)                       src/lib/health/source.ts
 ├─ ClipboardSource  – navigator.clipboard.readText() nach Rückkehr aus Kurzbefehle
 ├─ TextSource       – manuell eingefügter Text
 └─ FileSource       – JSON-Datei (iCloud Drive)
        │  liefert Rohtext
        ▼
parseHealthPayload (Zod, Schema v1, tolerant: "6,1", Strings, fehlende Felder)
        ▼
upsertHealthDay (nur Tabelle health)
```

Neue Quellen (Sync-Server, Uhr) implementieren `HealthSource.read(): Promise<string>` bzw. liefern direkt ein `HealthPayload`.

## UI-Schicht

- `src/App.tsx`: Shell mit Router (Hash-basiert), Tab-Leiste, Schnellerfassung, Update-Hinweis, Schneefall.
- `src/screens/*`: ein Ordner pro Bereich.
- `src/ui/*`: Bausteine (Card, Button, Sheet, Stepper, Ring, Charts …). Sie nutzen ausschließlich Tokens.
- `src/hooks/*`: `useSettings`, `useToday`, `useNow` (Minutentakt, Mitternachtswechsel), `useBfv`.
- `src/screens/today/widgets.tsx` + `widget-meta.ts`: Dashboard-Widgets (`DASHBOARD_WIDGETS`), Anordnung in den Einstellungen.
- `src/lib/calc/*` (v2): `abi` (GSO Anlage 10, Regeln mit Quelle in `ABI_RULES`), `studyplan`, `calendar-by` (Ferien/Feiertage Bayern), `briefing`, `goals`, `trends`, `weekly`, `review` (Pearson + t-Test). v3: `exams` (nächste Klausur, Countdown, Probe-Klausuren, Prozent → Punkte), `earnings` (Euro-Eingabe in Cent, Wochen), `subjects` (Uni ausblenden), `ring` (fünf Segmente).

## Tests

- **Unit** (Vitest + fake-indexeddb): Rechenlogik, Migration, Backups, Snapshots, BFV-Parser auf echten Fixtures, Kontrast aller Himmelsphasen.
- **E2E** (Playwright, gegen den `/winter/`-Build): Chromium im iPhone-Viewport, WebKit, Offline mit echtem Service Worker. Einführung wird per Fixture übersprungen (`onboarding`-Option).
- **Visuell** (`e2e/visual.spec.ts`, nur lokal): 7 Screens × Nacht/Tag + Einführung, 390 × 844.

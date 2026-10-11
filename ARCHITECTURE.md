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

## Zeit und Datum

- **Kalendertag** (`date`, `"2026-10-11"`) ist immer der Tag in **Europe/Berlin**, auch wenn das Gerät in einer anderen Zone ist. Rechnen (Tage addieren, Differenzen, Wochen) läuft über UTC-Mittag. Dadurch verschiebt eine Zeitumstellung nie einen Tag.
- **Zeitpunkte** (`createdAt`, `updatedAt`, Schlaf `start`/`end`, Lernzeit `start`/`end`) sind ISO-Instants in UTC. Dauern sind Differenzen von Instants. Die Nacht der Zeitumstellung hat dadurch korrekt 1 h mehr oder weniger.
- Wandzeiten aus Eingaben (`"23:30"`) werden mit `zonedToInstant` umgerechnet. Nicht existierende Zeiten (März) werden nach vorne verschoben, doppelte (Oktober) nehmen die erste.
- Lernzeit über Mitternacht wird an der Berliner Mitternacht auf zwei Tage aufgeteilt (`splitAtMidnight`).

## Datenmodell (Dexie-Schema v1)

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
| `subjects` | id, order | name, short, order, archived, major? | Seed: 11 Fächer + FernUni |
| `studySessions` | id, date, subjectId, demo | start, end, minutes | |
| `todos` | id, date, due, subjectId, demo | title, done, doneAt? | `date` = angelegt |
| `exams` | id, date, subjectId, demo | kind, topics, progress, points? (0–15) | `date` = Termin |
| `modules` | id, demo | name, number, archived | FernUni |
| `deadlines` | id, date, moduleId, demo | kind, title, time?, done | `date` = fällig |
| `habits` | id, order, demo | name, schedule, order, archived, startDate | schedule: täglich oder Wochentage |
| `habitChecks` | id, [habitId+date], date, habitId, demo | | ein Eintrag = abgehakt |
| `kv` | key | value | settings, timer, lastBackupAt, lastHealthImport, demoActive |

### Regeln

- **Health vs. manuell:** Importe schreiben ausschließlich in `health`. Angezeigt wird beim Schlaf der manuelle Eintrag, wenn vorhanden, sonst der Health-Wert (`effectiveSleep`). Ein erneuter Import am selben Tag ersetzt nur die `health`-Zeile.
- **Lern-Timer:** `kv.timer = { subjectId, startedAt }`. Die laufende Zeit wird aus `startedAt` berechnet. Der Timer übersteht dadurch Schließen, Neuladen und Neustart.
- **Demo-Daten:** Alle Demo-Einträge tragen `demo: 1` (indiziert). Löschen läuft über `where('demo').equals(1).delete()` in jeder Tabelle. Echte Daten bleiben unberührt.
- **Validierung:** Jede Schreiboperation läuft durch das passende Zod-Schema. Fehler werden als `ValidationError` mit deutscher Meldung geworfen und in der UI als Hinweis gezeigt.

### Migrationen

`SCHEMA_VERSION` in `src/db/db.ts`. Eine neue Version wird **unter** der alten angehängt:

```ts
this.version(2).stores({ sessions: 'id, date, type, demo, newIndex' }).upgrade(async (tx) => {
  await tx.table('sessions').toCollection().modify((s) => { s.newField ??= 'default'; });
});
```

Alte Versionen werden nie verändert. Backups enthalten `schemaVersion`. `migrateBackup()` in `src/lib/backup.ts` hebt ältere Backups vor dem Import an.

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
- `src/hooks/*`: `useSettings`, `useToday`, `useNow` (Minutentakt, Mitternachtswechsel).

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

## Phase 3 – App-Shell, Heute, Schnellerfassung ✓
**Fertig:**
- Shell: Hash-Router, Tab-Leiste (5 Tabs) und zentraler Schnellerfassungs-Button. Bottom-Sheets federn und lassen sich wegwischen. Toasts mit „Rückgängig“, Update-Hinweis (Service Worker), Schneefall (abschaltbar, respektiert reduced-motion).
- Heute-Screen: großes Datum, Tagesring mit Teilzielen, Fristen-Warnungen, Health-Hinweis, Schritte, Schlaf, Protein, Wasser, nächster Termin, Training laut Wochenplan, Habits mit Frost-Checkbox, Stimmung/Energie, Tagesnotiz. Vor- und Folgetag per Wischen oder Buttons (URL `#/heute/JJJJ-MM-TT`).
- Schnellerfassung mit 12 Einträgen: Wasser in 2 Taps, Mahlzeit-Vorlage in 3 Taps.
- Vorgezogen: Formulare für Training, Schlaf, Schule und den Health-Import.

**Geprüft:** typecheck ✓ · lint ✓ · 80 Unit-Tests ✓ · build ✓ · 12 E2E ✓ (Navigation, Wasser, Mahlzeit-Vorlage, eigene Mahlzeit mit Komma, Stimmung bleibt nach Neuladen, Tagesnotiz, Vortag/Folgetag per Button und Wischen, Sheet schließen). Screenshots angesehen: Heute leer (Viewport und ganze Seite), Schnellerfassung.

**Gefundene und behobene Fehler:**
- **Bug:** `type=number` verwirft „42,5“. Das Zahlenfeld wurde umgebaut, dazu kommen der Parser `parseNumberDE` und ein Unit-Test.
- Lint: setState im Effect (Schlaf-Formular) → jetzt Initialisierung per `key`. Hilfsfunktionen aus Komponentendateien ausgelagert (Fast Refresh). Literal-Sonderzeichen in Regex durch Escapes ersetzt.
- Visuell: Die Mono-Schrift machte „l“ und „1“ verwechselbar (bei „0 l“ und „kcal“) → Geist mit Tabellenziffern. Das unpassende Buch-Icon bei geplantem Training ist jetzt ein gestrichelter Kreis.

**Offen:** Training, Schule, Körper, Rückblick, Habits und Einstellungen sind noch Platzhalter (Phasen 4–7).

## Phase 4 – Training & Körper ✓
**Fertig:**
- Training: Einheit anlegen, bearbeiten und löschen (6 Typen, Dauer, RPE, Notiz, Load live). Für Spiele: Gegner, Ergebnis, Minuten, Tore, Assists, Schüsse, Note, Reflexion.
- Gym-Editor: Übungsvorlagen als Chips, die letzten Werte sind vorausgefüllt, neue Übungen werden automatisch zur Vorlage. PR-Erkennung mit Toast und Badge, Bestleistungen-Liste (Epley-1RM).
- Belastungskarte: Load 7 Tage, akut:chronisch, 8-Wochen-Chart mit Ø-Linie, Status mit Warnung und Hinweis „grobe Orientierung“. Wochenplan (pro Tag mehrere Typen, erledigt = Eisblau), Saisonstatistik (Tore/Assists pro 90, Chancenverwertung, Ø Note, S-U-N), Verlauf mit Filter.
- Körper: Ernährung (Tagessummen, Mahlzeiten löschen, 7-Tage-Protein-Chart mit Ziel, Vorlagen anlegen, bearbeiten, löschen). Schlaf (letzte Nacht, Quelle manuell/Health, 14 Nächte mit Ziellinie, Schnitt, Ø Qualität, Liste mit Bearbeiten). Health (letzter Import, Schritte 14 Tage, Verlauf).
- Eigene SVG-Charts (Balken, Linie, Heatmap), nur Token-Farben.

**Geprüft:** typecheck ✓ · lint ✓ · 80 Unit-Tests ✓ · build ✓ · 21 E2E ✓ (u. a. Gym → Verlauf → PR → Vorbelegung 90 kg; Spiel → 2,00 Tore/90, 50 %, 1-0-0; Bearbeiten/Löschen; Wochenplan; Mahlzeit/Vorlage; Schlaf 23:30–07:00 = 7:30). Screenshots angesehen: Training leer und mit Daten, Gym- und Spiel-Sheet, Körper (Ernährung, Schlaf, Health leer).

**Gefundene und behobene Fehler:**
- Typfehler: Status-Map nach Typverengung ohne „hoch“ → expliziter Typ `LoadStatus`.
- Visuell: Das Fußball-Icon („Goal“) war nicht als Ball erkennbar → Ball-Icon. Belastungsstatus gestapelt statt gequetscht. Balken bei wenigen Datenpunkten zu breit → maximale Breite begrenzt.
- Toter Platzhalter-Code im Körper-Screen entfernt.

**Offen:** Die Last-Warnung „hoch“ ist nur per Unit-Test geprüft. Der E2E-Test folgt mit den Demo-Daten (Phase 7).

## Phase 5 – Schule & FernUni ✓
**Fertig:**
- Lern-Timer: Karte oben, läuft über die gespeicherte Startzeit weiter, Stopp speichert, an Mitternacht geteilt. Lernzeit lässt sich auch nachtragen.
- Aufgaben: offen/erledigt, Fälligkeit, überfällig in Warnfarbe, Frost-Checkbox.
- Klausuren: anstehend mit Countdown und Lernstand, Fortschrittsbalken in Warnfarbe bei ≤ 3 Tagen und < 60 %. Notenschnitt pro Fach und gesamt in Punkten, mit Note mit Tendenz und Notenschnitt nach KMK-Formel.
- FernUni: Module mit Nummer, Fristen (Einsendearbeit/Prüfung/sonstige, optional Uhrzeit), Warn-Badges, erledigt/wieder öffnen. Modul löschen mit Rückfrage.
- Lernzeit-Statistik: Woche, Ø 4 Wochen, 14-Tage-Chart, Verteilung nach Fach.
- Heute-Screen: Fristen-Karten in drei Warnstufen (≤ 14 Tage Eisblau-Rand, ≤ 7 Tage Warnrand, ≤ 2 Tage und überfällig Warnfläche, überfällig pulsiert, `role=alert`), direkt abhakbar.

**Geprüft:** typecheck ✓ · lint ✓ · build ✓ · 6 neue E2E ✓ (Timer übersteht Neuladen; Lernzeit nachtragen → pro Fach 1 h 15 min; vier Fristen → genau 3 Warnungen in den richtigen Stufen, 30 Tage noch nicht; Abhaken entfernt die Warnung; überfällige Frist bleibt sichtbar; Notenschnitt 10,7 und 12,0; Countdown auf Heute; Aufgabe anlegen/abhaken). Screenshots angesehen: Heute mit Fristen, Timer, Klausuren, Lernzeit, FernUni, Aufgaben.

**Gefundene Fehler:** keine in dieser Phase.

**Selbst-Review:** Überfällige Fristen bleiben bis zum Abhaken dauerhaft oben auf Heute; es gibt keinen Weg, sie unbemerkt verschwinden zu lassen. Klausuren ohne Punkte, deren Datum vorbei ist, erscheinen unter „Vergangen“ mit dem Hinweis „Punkte offen“.

## Phase 6 – Habits, Stimmung, Journal, Rückblick ✓
**Fertig:**
- Habits: täglich oder an Wochentagen, Starttag, Streak (aktuell und Rekord), Heatmap über 18 Wochen in 4 Eisblau-Stufen mit Legende, 30-Tage-Quote, Archivieren und Löschen.
- Stimmung/Energie und Journal (seit Phase 3 auf Heute, plus Schnellerfassung).
- Rückblick: Woche/Monat mit Blättern; Kennzahlen (Lernzeit, Load, Ø Schlaf, Ø Protein, Habit-Quote, Ø Stimmung); Verläufe: Stimmung/Energie (Linie), Lernzeit, Load, Schlaf mit Ziel.
- Zusammenhänge über 90 Tage: Schlaf ↔ Stimmung (Schwelle 7,5 h), Load ↔ Energie am Folgetag (Median-Schwelle), Lernzeit 14 Tage vor einer Klausur ↔ Punkte. Mindestens 4 Punkte je Gruppe, sonst ein ehrlicher Hinweis mit den tatsächlichen Zahlen. Korrelation wird nur in Worten eingeordnet und erst ab n ≥ 8. Dazu der Hinweis „keine Ursachen“.
- Saisonübersicht Fußball mit Toren und Assists pro Spiel.

**Geprüft:** typecheck ✓ · lint ✓ · 85 Unit-Tests ✓ (neu: Tagesreihen mit null statt 0, Periodensummen, die drei Zusammenhänge inkl. exakter Formulierung) · build ✓ · 4 neue E2E ✓. Screenshots angesehen: Habits leer und mit Daten, Rückblick leer.

**Gefundene und behobene Fehler:**
- Test zählte die Legende als Heatmap-Zellen mit → Selektor eingegrenzt.
- Visuell: Leere Kennzahlen zeigten Einheiten hinter „–“ → werden jetzt ausgeblendet.

## Phase 7 – Health, Backup/Export, Einstellungen, Demo ✓
**Fertig:**
- Health: `HealthSource`-Interface mit drei Quellen (Zwischenablage, Text, Datei). Toleranter Parser für JSON v1 (Strings, Komma, Tausenderpunkt, deutsches Datum, typografische Anführungszeichen, Meter, mehrere Tage), klare deutsche Fehlermeldungen. „Werte einfügen“ wird nach `visibilitychange` hervorgehoben. Import schreibt nur die Health-Tabelle. `HEALTH-SHORTCUT.md` mit ehrlich markierten Unsicherheiten.
- Backup: Export in zwei Schritten (erstellen → teilen/herunterladen, wegen der iOS-Nutzergeste), Import mit vollständiger Zod-Prüfung jedes Datensatzes, Vorschau „X Einträge werden importiert“ und Ersetzen in einer Transaktion. Migrationsgerüst (`migrateBackup`), Schutz vor Sicherungen aus neueren Versionen. Erinnerung nach 7 Tagen auf Heute und in den Einstellungen.
- Markdown-Export für Obsidian: Tag (`JJJJ-MM-TT.md`, wie die täglichen Notizen im Vault) und Woche (`JJJJ-KWnn.md`), Frontmatter `datum`/`tags`, Abschnitte Aufgaben/Notizen/Training (Gym als Tabelle wie in der Vault-Vorlage), dazu Zahlen. Vorschau, Kopieren, Datei.
- Einstellungen: Ziele (inkl. Glasgröße und Tagesring-Bausteine), Fächer (umbenennen, sortieren, archivieren, neu), Kurzbefehl-Name, Speicherstatus mit `persist()`-Anfrage und Belegung, Demo-Schalter, Schneefall, „Alle Daten löschen“ mit Bestätigung durch Eingabe.
- Demo-Daten: deterministisch (Seed), 4 Wochen, 298 Einträge, jeder mit `demo: 1`, jeder besteht die Zod-Prüfung. Echte Health-/Tageswerte werden nicht überschrieben. Ausschalten löscht exakt die Demo-Einträge. Hinweis „Demo-Daten aktiv“ auf Heute.

**Geprüft:** typecheck ✓ · lint ✓ · 101 Unit-Tests ✓ · build ✓ · 38 E2E ✓ (neu: Health per Text, Zwischenablage und Datei; Re-Import überschreibt nur Health, manueller Schlaf bleibt; kaputte Daten → Meldung; **Backup → alles löschen → Import → alles wieder da**; fremde Datei abgelehnt; Markdown Tag/Woche + Download; Demo an → alle Screens → aus = alles weg). Screenshots aller Screens mit Demo-Daten angesehen.

**Gefundene und behobene Fehler:**
- **Bug:** Nach dem Wiederherstellen eines Backups kam die Erinnerung „Noch kein Backup“. Jetzt übernimmt der Import den Backup-Zeitpunkt, mit Unit-Test.
- **Bug:** Der Health-Hinweis widersprach angezeigten Health-Werten. Er prüft jetzt, ob für heute tatsächlich Health-Daten existieren.
- **Bug (beim Selbst-Review):** Der Wochen-Dateiname nutzte das Kalenderjahr statt des ISO-Wochenjahrs (30.12.2024 = 2025-KW01). Erledigte Aufgaben wurden nach UTC- statt nach Berliner Tag zugeordnet. Beides behoben, mit Tests.
- **Bug:** Körpergewichtsübungen zeigten „0,0 kg 1RM“ und konnten keine PRs erzeugen. Jetzt gibt es einen Wiederholungs-PR (`wdh`) und den Bestwert in Wdh., mit Test.
- UI: Der Demo-Schalter reagierte erst nach dem Schreiben → jetzt optimistisch. Bei Fristen auf Heute wurde der Titel vom langen Modulnamen abgeschnitten → Titel zuerst, Modul darunter.

## Phase 8 – Feinschliff ✓
**Fertig:**
- Animationen: Screen-Wechsel mit kurzer Überblendung (200 ms), Tagesring füllt sich beim Laden, Zahlen zählen hoch, Frost-Checkbox, federnde Sheets. Alles aus bei „Bewegung reduzieren“.
- Barrierefreiheit: axe-Audit (WCAG 2.1 AA) für alle 7 Screens plus Schnellerfassung und Trainings-Sheet, alle mit Demo-Daten, ohne schwere Verstöße. Seitentitel pro Screen. Fokus kehrt nach dem Schließen eines Sheets zurück. Segment-Buttons auf 44 px.
- Design-Disziplin automatisiert: Ein Test durchsucht den gesamten UI-Code nach Hex-, rgb()- und hsl()-Farben außerhalb von `tokens.css`.
- Layout: Desktop zentriert (≤ 480 px Spalte, getestet), kein horizontales Scrollen bei 320 px auf allen Screens (getestet). Tagesring bei schmalen Geräten verkleinert.
- Hosting-Konfiguration (`vercel.json`, `public/_headers`: `sw.js` nie cachen), `DEPLOY.md`, `README.md`.

**Geprüft:** typecheck ✓ · lint ✓ · 162 Unit-Tests ✓ · build ✓ · 42 E2E ✓ (neu: axe, Seitentitel, Desktop, 320 px). Screenshots angesehen: Desktop, 320 px.

**Gefundene und behobene Fehler:**
- Fallback-Farbe `'white'` im Schneefall (vom neuen Farb-Test gefunden) → entfernt.
- Bei 320 px brachen die Werte im Tagesring um → nowrap, kleinerer Ring.
- Karten-Buttons zentrierten ihren Inhalt vertikal (Schlaf-Label tiefer als Schritte) → Flex-Spalte oben ausgerichtet.
- axe meldete einen Kontrastverstoß, der nur während der Überblendung auftrat (halbe Deckkraft). Der Audit misst jetzt mit reduzierter Bewegung, die Tokens selbst sind per Kontrast-Test abgesichert.

**Performance:** Haupt-JS ca. 134 kB gzip plus 71 kB gemeinsamer Chunk (React, motion, Zod, Dexie). Die Screens laden lazy (je 2–12 kB gzip). Precache ca. 840 KiB inkl. Schriften und Icons. Nach dem ersten Laden kommt alles aus dem Cache.

## Phase 9 – Abschluss-Audit ✓
**Durchgeführt:**
- Kompletter Lauf: typecheck ✓ · lint (0 Warnungen) ✓ · Prettier ✓ · **162 Unit-Tests** ✓ · Build ✓ · **44 E2E-Tests** ✓ (43 iPhone-Viewport + 1 Offline). Jeder E2E-Test startet in einem frischen Browserkontext, also **ohne Daten**. Die Leerzustände aller Screens sind damit abgedeckt und per Screenshot geprüft.
- **Offline-Test** (Projekt `offline`, echter Service Worker gegen `vite preview`): Seite wird vom Service Worker kontrolliert → Netz aus → Neuladen → alle Tabs inkl. lazy geladener Screens → Wasser eintragen → Neuladen ohne Netz → Wert bleibt → Schriften aus dem Cache. ✓
- **Installierbarkeit** über das Chrome-DevTools-Protokoll: `Page.getInstallabilityErrors` leer, Manifest ohne Fehler. ✓ (Lighthouse 12 hat keine eigene PWA-Kategorie mehr.)
- **Lighthouse** (mobil, gedrosseltes 4G, `npm run lighthouse`): Performance **94** · Barrierefreiheit **100** · Best Practices **100** · SEO 91 (nur `robots.txt`; jetzt bewusst „nicht indexieren“, siehe DECISIONS #18). FCP 2,3 s, LCP 2,6 s, TBT 60 ms, CLS 0,015. Das gilt für den ersten Aufruf; danach kommt alles aus dem Cache.
- **axe WCAG 2.1 AA:** alle Screens und zwei Sheets ohne schwere Verstöße.
- `npm audit --omit=dev`: 0 Schwachstellen.

**Letzter Fund im Selbst-Review:** Ein vergessener Lern-Timer hätte tagelange Lernzeit gebucht → Warnung ab 6 h mit „Verwerfen“, E2E-Test.

## Deployment (12.10.2026) ✓
- Hosting auf **GitHub Pages**: <https://filipclaude.github.io/winter/> (Repository `FilipClaude/winter`, öffentlich, nur Code). Build per GitHub Actions bei jedem Push (Typecheck + Unit-Tests vorab).
- App läuft im Unterordner `/winter/` (`BASE_PATH`), lokal weiter unter `/`. Offline-Test unter `/winter/` lokal bestanden; live geprüft: Service Worker aktiv mit Scope `/winter/`, Manifest-`start_url` `/winter/#/heute`.
- **Fund beim ersten CI-Build:** `.gitignore` enthielt `screens` (gemeint: Screenshot-Ordner) und schloss damit auch `src/screens/` aus. Die Screens waren nie committet, lokal fiel es nicht auf. Regel auf `/screens/` verankert, Screens nachgetragen, frischer Klon baut fehlerfrei.
- Habit-E2E war wochentagsabhängig (DECISIONS #24), korrigiert.

---

## Ehrliche Zusammenfassung

### Was funktioniert (getestet)
- Alle Module aus dem Auftrag: Heute (Tagesring, Karten, Wischen), Training (Load, akut:chronisch, Gym mit Vorlagen und PRs, Spiele und Saisonstatistik, Wochenplan), Körper (Ernährung mit Vorlagen, Wasser, Schlaf, Health-Verlauf), Schule (Timer, Aufgaben, Klausuren, Notenschnitt, FernUni-Fristen mit 14/7/2-Tage-Warnung), Habits (Streaks, Heatmap), Stimmung/Energie, Journal, Rückblick (Woche/Monat, Zusammenhänge, Saison), Einstellungen, Backup/Import, Markdown-Export, Demo-Daten.
- Offline-Betrieb, Installierbarkeit (Chromium), Update-Hinweis.
- Zeitlogik inklusive Zeitumstellung, Mitternacht, Jahreswechsel und ISO-Wochen (Unit-Tests).
- Health-Import-Logik und alle drei Wege (Zwischenablage, Text, Datei) im Browser.

### Was ich nicht testen konnte
- **Den echten Kurzbefehl am iPhone.** Die deutschen Aktionsnamen in `HEALTH-SHORTCUT.md` sind teils als *unsicher* markiert. Ob ein Wörterbuch beim Kopieren wirklich als JSON in der Zwischenablage landet, zeigt erst der Test am Gerät. Der Parser ist deshalb bewusst tolerant, und es gibt Textfeld und Datei als Ausweg.
- **Safari/WebKit auf iOS:** Getestet wurde in Chromium mit iPhone-Viewport. Nicht geprüft sind Standalone-Modus, Splashscreens, Safe-Areas an einer echten Notch, das „Einfügen“-Popup von iOS, das Teilen-Menü beim Backup, `storage.persist()` und die Rückkehr aus der Kurzbefehle-App (`visibilitychange`).
- Verhalten bei sehr großen Datenmengen über Jahre. Der Rückblick lädt alle Einträge; bei ein paar tausend Einträgen ist das unkritisch, nach mehreren Jahren sollte man es beobachten.

### Bekannte Grenzen
- iOS kann Website-Daten löschen, wenn die App lange nicht genutzt wird oder der Speicher knapp ist. Gegenmaßnahmen: `persist()`, Backup-Erinnerung nach 7 Tagen. Ein Backup-Export bleibt trotzdem Pflicht.
- Daten hängen an der Domain. Ein Hosting-Wechsel heißt: Backup exportieren und an der neuen Adresse importieren.
- Der Backup-Import ersetzt alles, er führt nicht zusammen.

### Ideen für Version 2
1. **Automatisches Backup** in iCloud Drive über einen zweiten Kurzbefehl (z. B. wöchentlich per Automation).
2. Health-Import **per Automation**: Der Kurzbefehl läuft z. B. morgens automatisch und legt eine Datei ab, Winter liest sie beim Öffnen ein.
3. **Benachrichtigungen** für Fristen (Web Push ist auf iOS ab 16.4 für Homescreen-Apps möglich, braucht aber einen kleinen Push-Server).
4. Sync zwischen Geräten (verschlüsselt, z. B. über einen eigenen kleinen Server hinter `HealthSource`-ähnlichem Interface).
5. Trainingsplan-Vorlagen (Gym-Splits) und Satz-Timer.
6. Obsidian-Export direkt in den Vault-Ordner (über die Obsidian-URL-Schemes oder einen Kurzbefehl).
7. Bundle verkleinern: `zod/mini` statt Zod für die Laufzeitvalidierung und motion nur in den Sheets laden.
8. WebKit-Lauf der E2E-Tests (`npx playwright install webkit`) als zusätzliche Annäherung an Safari.


---

# v2 – „Winterhimmel“ (Auftrag: Obsidian `Persönlich/Daily-App Prompt v2.md`, Plan: `PLAN-v2.md`)

## v2 · Phase 0 – Bestandsaufnahme ✓
- Code und Doku gelesen, alle Tests grün (162 Unit, 44 E2E), Ist-Screenshots als Referenz in `screens/v1-ref/`.
- `PLAN-v2.md` mit Phasen, Zeitbudget, Risiken und Migrationsplan.

## v2 · Phase 1 – Sicherheitsnetz ✓
**Fertig**
- **Schema v2** (rein additiv, DECISIONS #25): neue Tabellen für Noten, Halbjahre, Lernplan, Stundenplan, Ziele, Snapshots; optionale Felder für Klausur-Themen, Aufgaben-Priorität/-Wiederholung, FernUni-Regeln/-Punkte, BFV-Spiele. Einstellungen v2 (Himmel, Schnee-Modus, Stundenplan, Pomodoro, Dashboard, Abi, BFV, Onboarding).
- **v1-Fixture** `src/test/fixtures/backup-v1.json` (390 Datensätze, mit dem v1-Code erzeugt, eingefroren).
- **Migrationstests:** echte v1-Dexie-DB → v2 öffnen → jeder Datensatz identisch, Einstellungen erhalten, Snapshot „vor-v2“; v1-Backup-Import; v2-Roundtrip mit neuen Tabellen; neuere Backups werden abgelehnt.
- **E2E „Start mit v1-Daten“:** legt im Browser eine IndexedDB im v1-Layout an (wie auf Filips iPhone) und startet v2 darauf – Chromium und WebKit.
- **Automatische Sicherungen** (DECISIONS #26): täglich (letzte 7), „vor-v2“, „vor-import“; Karte in den Einstellungen mit Vorschau und Wiederherstellen.
- **Fehlergrenze** pro Screen mit „Bereich neu laden“, „App neu starten“ und Backup-Export.
- **CI als Qualitätsschranke:** Typecheck, Lint, Format, Unit, E2E (Chromium + WebKit, Report als Artefakt bei Fehlern), erst dann Build und Deploy. Actions aktualisiert (Node-20-Warnung behoben), Runner fest `ubuntu-24.04`.
- Einstellungen werden pro Schlüssel geprüft (DECISIONS #27).

**Geprüft:** typecheck, lint, Prettier, 172 Unit-Tests, 93 E2E-Tests (Chromium, WebKit, Offline). Screenshot der Fehlergrenze angesehen → oberer Abstand fehlte, ergänzt.

**Gefundene und behobene Fehler**
- **WebKit-Fund (betrifft Safari):** Nach dem Ausschalten der Demo-Daten sprang der Schalter kurz zurück auf „an“, bis die Datenbank-Abfrage nachzog. Ein zweiter Tap in diesem Moment hätte die Demo-Daten erneut angelegt. Jetzt bleibt der Zielzustand sichtbar, bis die Daten ihn bestätigen; der Schalter ist währenddessen gesperrt. Regressionstest ergänzt.
- Fehler beim Anlegen/Löschen der Demo-Daten wurden verschluckt (kein Hinweis). Jetzt Meldung.
- Demo-Löschen per Tabellen-Scan war in WebKit sehr langsam → über den Index (DECISIONS #29).
- v1 verwarf bei einem ungültigen Einstellungswert alle Einstellungen (DECISIONS #27).

**Offen:** –

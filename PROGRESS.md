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

## v2 · Phase 2 + 3 – Design-System v2 und Winterhimmel ✓
(Zusammen umgesetzt, weil das Glas-Design der Karten vom Himmel abhängt.)

**Fertig**
- **Winterhimmel** nach echter Tageszeit (München): 4 Phasen weich gemischt, Sterne, Mond in echter Phase, Horizontlicht nach Sonnenstand, Alpen in 3 Ebenen mit Parallaxe (Scroll, optional Neigung), Schnee in 3 Tiefen, Modus „echtes Wetter“ (Open-Meteo). Entwickler-Schalter „Tageszeit simulieren“.
- Eigene Sonnen-/Mondberechnung mit Tests (Auf-/Untergang ±3 min, Zeitumstellung, Mondphasen, stetige Übergänge).
- **Glas-Karten** mit phasenabhängiger Deckkraft. **582 automatische Kontrastprüfungen** (jede Textfarbe × jede Himmelsstelle × jede Phase, direkt und auf Glas).
- **Design-System v2:** Typo-Skala, Elevation, Motion-Tokens (`src/ui/motion.ts`), neue Bausteine `StatTile`, `Sparkline`, `ListRow`, `Skeleton`/`ScreenSkeleton`, Chart-Tooltip per Tap (für alle Balken- und Liniencharts, mit Screenreader-Beschriftung), Tap-Feedback.
- `DESIGN.md` überarbeitet.

**Geprüft:** typecheck, lint, Prettier, 750 Unit-Tests, 100 E2E (Chromium + WebKit + Offline). Screenshots aller vier Himmelsphasen angesehen.

**Leistung (gemessen):** Hauptthread im Leerlauf 3,4 % mit Schnee, 0 % ohne (Chromium, 10 s). Vorher (eine Canvas) 12,5 % → auf zwei Ebenen aufgeteilt (DECISIONS #33). Ohne Schnee und bei „Bewegung reduzieren“ läuft keine Dauerschleife (E2E-Test zählt Frames).

**Gefundene und behobene Fehler**
- Mond wurde als dunkle Scheibe gezeichnet (Schatten in Himmelsfarbe statt ausgeschnitten) → Schattenteil wird jetzt transparent herausgeschnitten.
- **WebKit-Fund:** Demo-Schalter zeigte beim Öffnen kurz „aus“, obwohl aktiv → gesperrt, bis geladen (DECISIONS #34).
- Nahe Schneeflocken wirkten als unscharfe Flecken → kleiner.

**Ehrlich offen:** Die GPU-Last der Glas-Unschärfe über bewegtem Schnee kann ich unter Windows nicht messen. Falls das iPhone warm wird oder der Akku leidet: Schnee auf „Aus“ (dann 0 % Dauerlast).

## v2 · Unabhängiges Review 1 (nach Phase 2+3) – Funde abgearbeitet ✓
Ein Subagent hat den Diff seit Beginn von v2 ohne meine Begründungen geprüft (14 Funde).
- **Kritisch (war live!):** Schreibzugriff im Dexie-Upgrade hätte bei Speicherproblemen die App dauerhaft blockiert → behoben (DECISIONS #35). Beim Nachtesten zusätzlich gefunden: Öffnungsfehler ließen die App still hängen → ausdrückliche Prüfung + Rettungsseite mit Rohdaten-Export. Neuer E2E-Test simuliert „Speicher voll“.
- Mittel: Snapshot-Speicher und -Liste, Datenschutz beim Löschen, Import-Sicherungen, Lern-Timer, Spiel-Tooltip, CI testet jetzt den echten Live-Build (DECISIONS #36, #37, #40).
- Gering: leere Canvas, Wetter beim Zurückkehren neu laden, Schneekuppen-Farbe aus Token, Einstellungen pro Unterfeld, Chart-Auswahl, CPU-Test nur lokal, `cancel-in-progress: false`.
- Tests verschärft: Migration im Browser vergleicht jetzt jede ID jeder Tabelle (vorher nur „erste Zeile sichtbar“); 8 neue Unit-Tests für Snapshots/Einstellungen.
- **Nicht übernommen:** Fund 14a (Zeitumstellungs-Test bei der Sonne „prüft nur Intl“) – der Test sichert ab, dass Auf-/Untergang in Wandzeit korrekt angezeigt werden; bleibt. Fund 12a (Tap-Ziele im Monats-Chart < 44 px): Tooltips sind Zusatz, alle Werte stehen auch als Text/Kennzahl im Rückblick; beobachten.
- **CI-Fund:** Der Lauf nach Phase 2+3 war rot (WebKit ohne GPU, DECISIONS #38) – die Schranke hat gegriffen, nichts Kaputtes ging live.

**Geprüft:** 786 Unit-Tests, 102 E2E (Chromium, WebKit, Offline) gegen den `/winter/`-Build.

## v2 · Phase 4 – Abi-Rechner ✓
- Regelrecherche in der GSO (Anlage 10, §§ 44, 53, 54; Fassung ab 01.08.2026) und auf gymnasiale-oberstufe.bayern.de. Regeln als Daten mit Quelle und Sicherheitsstufe, in der App unter „Regeln & Quellen“ (DECISIONS #41).
- Halbjahresleistung aus Noten (groß : klein = 1 : 1) oder Zeugnis (Vorrang), Einbringungs-Optimierung (Pflicht nach Rolle, Rest bestmöglich bis 40), W-Seminar + Seminararbeit, Block I/II, Durchschnittsnote, Prognose fehlender Werte (markiert), Szenario „Was brauche ich in Prüfung X für Note Y?“, Warnungen nach § 44/§ 54 (Unterkurse, 0 Punkte, Mindestsummen, Prüfungsbedingungen, Optionsregel).
- 26 Unit-Tests mit von Hand nachgerechneten Beispielen (u. a. 823 P = 1,0 / 822 P = 1,1, 1 : 1-Schnitt, Streichung des schwächsten Halbjahrs, Szenario 12 Punkte für 2,2).
- **Fund beim Ansehen des Screenshots:** Standardrollen zu streng (42 Pflicht-HJL, Optionsregel-Warnung) und Prognoseanteil „102 %“ → korrigiert, Regressionstest mit Filips Fächern.
- **Unsicher (ehrlich):** Rundung der Halbjahresleistung, Umrechnungstabelle Anlage 13, nicht modellierte Sonderfälle. Verbindlich bleibt die Oberstufenkoordination.

## v2 · Phase 5 – Noten, Klausuren, Lernplanung, Stundenplan, Ferien ✓
- Noten: große/kleine Leistungsnachweise je Fach und Halbjahr, Gewicht, Halbjahresschnitt, Notenverlauf-Chart.
- Klausur-Detail: Themen-Checkliste mit Lernstand (offen/angefangen/sitzt/wiederholt), Reflexion nach der Rückgabe, bewertete Klausur wird automatisch Note (DECISIONS #44).
- Lernplan-Generator mit Spaced Repetition (DECISIONS #45), Einheiten abhakbar unter Schule → Plan (auf „Heute“ ab Phase 7).
- Pomodoro (25/5, einstellbar) im Lern-Timer: zeigt Phase und Restzeit, bucht nur Fokuszeit; Schutz vor vergessenen Timern bleibt.
- Stundenplan mit A/B-Wochen, Ferien Bayern 2026/27 mit Quelle, Feiertage berechnet, schulfreie Tage im Lernplan berücksichtigt.
- Hausaufgaben mit Priorität (Sortierung: überfällig/heute → Priorität → Fälligkeit) und Wiederholung (wöchentlich/zweiwöchentlich, genau eine Folgeaufgabe).
- **Gefunden & behoben:** Abi-Raster-Zellen waren für Screenreader keine Buttons (ARIA-Tabellenrolle überschrieb sie) → Rollen entfernt, Beschriftungen bleiben.

## v2 · Phase 6 – FernUni ✓
- Einsendearbeiten mit erreichten/maximalen Punkten, Prüfungsberechtigung je Modul nach einstellbarer Regel (inkl. „nicht mehr erreichbar“), Modul-Notiz (z. B. Wiederholerkennzeichen). Fristen-Eskalation 14/7/2 Tage wie bisher; „rot und ganz oben“ auf dem Dashboard folgt in Phase 7.

**Geprüft (Phasen 4–6):** typecheck, lint, Prettier, 807 Unit-Tests, E2E (Chromium + WebKit) inkl. 6 neuer Schul-Abläufe; CI-Lauf nach Phase 4+5 komplett grün und deployt. Screenshots Abi, Noten, Plan, Klausur-Themen, FernUni angesehen.

## v2 · Unabhängiges Review 2 (Phasen 4–6) – Funde abgearbeitet ✓
17 Funde, davon 3 kritisch (Datenintegrität Klausur ↔ Note): doppelte Klausuren, verwaiste Note nach Fachwechsel, Doppelzählung nach Notenbearbeitung → behoben mit Transaktion, Suche über alle Fächer, gemerkter ID, erhaltener Verknüpfung (DECISIONS #52). Weiter behoben: Block I > 40 HJL, Bio als einzige Naturwissenschaft „alle 4“, Kurzarbeit = klein, Halbjahr der Klausur einstellbar, Kommazahl-Punkte sperren das Speichern, wiederkehrende Aufgaben bei Überfälligkeit und Dubletten, Lernplan-Reihenfolge und Neuplanung, Ferien bis 2030 aus dem amtlichen PDF, ältere überfällige Lerneinheiten sichtbar, FernUni-Fehlalarm, Prognose-Gewichtung, Fehlerhinweis im Modul-Sheet, Löschen mit Rückfrage, ARIA-Gruppe. Tests, die das Fehlverhalten festgeschrieben hatten, wurden korrigiert und verschärft; 14 neue Regressionstests (`src/db/review2.test.ts`).

## v2 · Phase 7 – Dashboard ✓
- Heute-Screen als **anpassbares Dashboard**: 15 Widgets (Briefing, Tagesring, Hinweise, nächste Termine, Lernen heute, Training, nächstes Spiel, Schritte, Schlaf, Ernährung, Habits, Stimmung, Abi-Schnitt, Ziele, Tagesnotiz), Drag & Drop + Pfeile, ein-/ausblenden, zwei Größen, „Standard wiederherstellen“ (DECISIONS #49).
- **Tagesbriefing** regelbasiert (DECISIONS #50), Beispiel aus dem Auftrag als Test.
- **Ziele** (Woche/Monat): Lernzeit, Gym/Training, Ø Protein/Schlaf/Schritte, Habit-Quote, Abi-Schnitt (DECISIONS #51).
- Kritische Fristen „rot und ganz oben“ (Phase 6 nachgeholt). Demo-Daten enthalten jetzt Noten.

**Geprüft:** 835 Unit-Tests, 122 E2E (Chromium + WebKit + Offline, gegen `/winter/`-Build), Dashboard-Screenshots angesehen.

## v2 · Phase 8 – Insights & Wochenbericht ✓
- **Zusammenhänge** mit Pearson-r, n und Klartext; unter 14 Punkten oder |r| < 0,3 ausdrücklich „noch kein belastbarer Zusammenhang“ (DECISIONS #56). Paare: Schlaf ↔ Stimmung, Lernzeit vor Klausuren ↔ Punkte, Trainingslast ↔ Energie am Folgetag, Schritte ↔ Schlaf.
- **Wochenbericht** im Rückblick: Kennzahlen gegen Vorwoche mit Pfeilen, Highlights (Lernrekord, Spiele, Klausuren, Stimmung), Ausreißer (kurzer/sehr langer Schlaf, sehr hohe Last), Wochenziele erreicht/verfehlt, Export als Markdown für Obsidian (DECISIONS #57).
- **Trends:** 7-/28-Tage-Schnitt je Kennzahl, Jahres-Heatmap, **freier Zeitraum** mit Vergleich zum gleich langen Zeitraum davor; alle Kennzahlen mit Trendpfeil gegenüber dem Vergleichszeitraum.
- **Gefunden & behoben:** Achsenbeschriftung langer Linien-Charts war unlesbar (90 Spalten) → frei positionierte Beschriftungen; Trend startet erst ab ersten Daten.

**Geprüft:** 97 Rechen-Tests in `src/lib/calc` (u. a. Wochenbericht mit KW 53 über den Jahreswechsel), E2E Rückblick (Demo, Download, freier Zeitraum), Screenshot Rückblick/Trends angesehen.

**CI-Fund:** WebKit ersetzte Leerzeichen im Download-Dateinamen durch `_` → Dateiname jetzt `Wochenbericht-JJJJ-KWnn.md`.

## v2 · Unabhängiges Review 3 (Phasen 7–8) – Funde abgearbeitet ✓
11 Funde. Behoben: Zusammenhänge zusätzlich mit Signifikanztest (DECISIONS #63); laufende Woche/Monat fair verglichen, freier Zeitraum begrenzt (#64); wiederkehrende Aufgaben ohne Dubletten (#65); Abi-Warnungen über alle Pflicht-Halbjahre (#66); Dashboard-Editor verliert bei schnellen Änderungen nichts mehr (lokaler Zustand, Speichern nach dem Ziehen); Briefing zählt nur heute fällige Habits; Protein gerundet; Klausur-Highlight mit Datum statt Fachkürzel; Abi-Ziel im Wochenbericht nur mit bekanntem Schnitt; doppelte React-Keys; Trend-Berechnung memoisiert. 4 neue Regressionstests.

## v2 · Phase 9 – BFV ✓
- **Recherche** (Playwright, `scripts/bfv-explore.mjs`): Mannschaftsseite von SV Planegg-Krailling, offizieller iCal-Export des Spielplans, Tabelle im HTML. Ergebnisse sind per Schriftart verschleiert → bewusst nicht ausgelesen (DECISIONS #59, #60). Alles in `docs/BFV.md` inkl. Reparaturanleitung.
- **Abgleich** `scripts/bfv-sync.ts` (3 Versuche mit Backoff, Zeitlimit, Zod-Prüfung, schreibt nur bei Änderung) in der Action `bfv-sync.yml`; bei Änderung Commit + Deploy. Keepalive gegen das 60-Tage-Pausieren (#62). Lokal erfolgreich: 21 Spiele, 14 Tabellenplätze.
- **App:** Karte „BFV“ im Training (nächstes Spiel, Formkurve S/U/N, Tabelle mit eigener Zeile hervorgehoben), Widget „Nächstes Spiel“ mit Tabellenplatz, Hinweis „Spiel eintragen“ nach Abpfiff auf Heute und im Training (Gegner, Heim/Auswärts vorbefüllt und als „vom BFV“ markiert), Saisonvergleich mit Vorsaison, Scorerpunkte. Daten offline per Service Worker (NetworkFirst).
- **Tests:** 11 Unit-Tests auf echten Fixtures (iCal, Tabellen-HTML), 3 E2E (Chromium + WebKit) mit gemockten Daten.
- **Gefunden & behoben:** Tabellenspalten klebten aneinander (Screenshot); axe meldete unerlaubtes `aria-label` an der Formkurve → `role="img"`.

**Geprüft:** typecheck, lint, Prettier, 863 Unit-Tests, 133 E2E (Chromium + WebKit + Offline) gegen den `/winter/`-Build. CI grün und deployt; `bfv.json` live erreichbar (21 Spiele); BFV-Action auf GitHub manuell gestartet → erfolgreich.

## v2 · Phase 10 – Feinschliff ✓
- **Einführung** beim echten Erststart (DECISIONS #67): 4 Schritte über dem Himmel, überspringbar, erneut aufrufbar in den Einstellungen, optional mit Demo-Daten. Erscheint nie vor vorhandenen Daten (Unit-Tests für v1-Einstellungen, vorhandene Einträge, „gesehen“).
- **Icon & Startbildschirme** im Nachthimmel-Stil (DECISIONS #69), reproduzierbar über `npm run icons`.
- **Leerzustände** überarbeitet (DECISIONS #70); alle Screens einer frischen App per Screenshot angesehen.
- **Visuelle Regression** (DECISIONS #68): 16 Referenzbilder, zweimal hintereinander stabil.
- **Gefunden & behoben:** Fokusring an der Einführungs-Überschrift; Glas ließ den Heute-Screen verschwommen durchscheinen → App ausgeblendet, Himmel sichtbar. XML-Kommentar mit `--` brach die Icon-Erzeugung. **Testfehler um Mitternacht:** Datumsrechnung in 24-h-Schritten landete über die Zeitumstellung (25.10.) einen Tag zu früh → gemeinsamer Helfer rechnet in Kalendertagen.

**Geprüft:** typecheck, lint, Prettier, 869 Unit-Tests, 142 E2E (Chromium + WebKit + Offline + visuell) gegen den `/winter/`-Build. CI grün, deployt.

## v2 · Unabhängiges Review 4 (Phasen 9–10) – Funde abgearbeitet ✓
12 Funde, keiner mit Datenverlust. Behoben: abgesagte BFV-Spiele wurden später zu „vorbei“ (Banner-Flut), stiller Formatbruch beim iCal, zu breiter Dublettenschutz bei Aufgaben-Serien, Fokus/Escape/Fokusfalle in der Einführung, Push-Race und Zeitlimit der Action, irreführendes „Stand“-Datum, wirkungslose E2E-Prüfung der Formkurve, unbehandelte Fehler beim Start der Einführung, 10-min-Sperre nach Offline-Fehler, Saisonwechsel, Signifikanz-Rundung, Doku zur Abrufzahl (DECISIONS #72–#75). Neue Tests: zwei aufeinanderfolgende BFV-Läufe, TZID-Format, zwei Aufgaben-Serien, df = 13, Fokus nach „Weiter“, Escape + Tab-Falle + Fokus-Rückgabe.

**Geprüft:** 873 Unit-Tests, 142 E2E gegen den `/winter/`-Build.

**CI-Fund danach (die Schranke hat gegriffen, nichts ging live):** In WebKit mit „Bewegung reduzieren“ kam der Fokus nach der Einführung nicht zurück. Ursache war nicht die Einführung, sondern die globale Regel für reduzierte Bewegung (0,01-ms-Übergänge auf *allem*). Sie hielt `visibility: hidden` fest. Das hätte auch Filips iPhone getroffen, falls die Einstellung aktiv ist (DECISIONS #76). Lokal mit `CI=1` nachgestellt, behoben und in beiden Konfigurationen grün getestet.

## v2 · Nachbesserung Alpen (13.10.2026, Filips Rückmeldung) ✓
- **Fund am iPhone:** Tageszeiten sichtbar, Alpen nicht. Ursache: Ebenen nur 10–20 % hoch (größtenteils hinter Tab-Leiste und Karten), Bergfarben fast gleich dem Himmel (nachts `#0c121d` vor `#0d1422`), Parallaxe schob sie beim Scrollen nach unten. Meine Screenshots zeigten nur leere Seiten – dort fiel es nicht auf.
- **Behoben** (DECISIONS #77): Ketten bis 60 % hoch, breite Massive, Schneekuppen, nachts mondhell / tagsüber Silhouette, Parallaxe nach oben. Farben berechnet statt geschätzt, damit Text direkt darauf lesbar bleibt.
- **Nebenbei gefunden:** Mitten in den Phasenübergängen konnte der Himmel heller werden als jede der beiden Phasen (Text-Kontrast knapp unter 4,5) → Mischung der sichtbaren Farbe, Test in 5-%-Schritten für alle Übergänge.
- **Geprüft:** 955 Unit-Tests (u. a. 664 Kontrastprüfungen), 142 E2E, visuelle Referenzbilder neu erzeugt und angesehen (Heute, Schule, Einführung in Nacht und Tag).

## v2 · Lebendiger Himmel (13.10.2026, Filips Auswahl) ✓
- Alpenglühen, Nebel zwischen den Ketten (Wettermodus: nach echter Bewölkung), Lichter am Hang, funkelnde Sterne, Sternschnuppe alle 7 s nachts (DECISIONS #79). „Schneemenge nach Wetter als Standard“ auf Filips Wunsch weggelassen.
- **Gefunden & behoben:**
  - Ziehender Nebel kostete 17 % CPU → Nebel und vordere Ketten als eigene GPU-Ebenen, jetzt 5,8–6,1 %.
  - Sternschnuppen erschienen im Test nicht, weil rAF-Zeit und `performance.now()` mit der Test-Uhr auseinanderliefen → eine Zeitquelle. Gemessen: Start bei 7,2 s und 14,2 s.
  - Nebel war zu schwach und lag hinter der mittleren Kette → höher und kräftiger.
- **Geprüft:**
  - 1050 Unit-Tests: Alpenglühen-Verlauf, Nebelmenge, 1000 Sternschnuppen-Bahnen bleiben über den Bergen, Funkel-Grenzen, Lichter nur an hohen Hängen; Kontrast inkl. Alpenglühen-Farben in allen Übergängen.
  - 146 E2E: neu Nebel zieht nur mit Schnee an, nie bei reduzierter Bewegung.
  - Screenshots bei Aufgang, Mittag, Abend, Nacht und mitten in einer Sternschnuppe angesehen.

## v2 · Sonne, Mond, mehr Schnee (13.10.2026, Filips Wunsch) ✓
- Sonne und Mond stehen am echten Stand über München und gehen hinter dem Grat der fernen Kette auf und unter (DECISIONS #78). Der Mond zeigt seine echte Phase und ist auch tagsüber blass zu sehen. Im Simulationsmodus gibt es typische Stände.
- Schnee: etwa 2,5× so viele Flocken, vor allem kleine Punkte.
- **Gefunden & behoben:** Die Sonne wirkte tagsüber grau wie ein Mond (sie lag unter der Abdunklung) → veil in Himmel und Berge verlegt, Sonne warm-golden.
- **Geprüft:** 962 Unit-Tests (neu: Vollmond gegenüber/Neumond neben der Sonne, Auf-/Untergang im Osten/Westen, Bildschirm-Abbildung), 142 E2E, Screenshots für Aufgang, Vormittag, Mittag, Abend, Mondsichel nach Sonnenuntergang, Vollmondnacht, Schnee. CPU 4,8 %.

## v2 · Phase 11 – Abschluss-Audit ✓
- **CI** (Typecheck, Lint, Format, 873 Unit-Tests, E2E Chromium + WebKit gegen den echten `/winter/`-Build) grün, deployt.
- **Live geprüft** (13.10.2026): Seite, Manifest (`start_url /winter/#/heute`, Scope `/winter/`, standalone, Hochformat, 4 Icons), Service Worker aktiv und kontrollierend, `bfv.json`, Icons und Startbildschirme erreichbar. **Update-Hinweis** im Browser mit alter Version im Cache ausgelöst → „Aktualisieren“ lädt die neue Version. Einführung erscheint bei frischem Profil, BFV-Karte mit echten Daten, keine Konsolenfehler.
- **Offline** (eigenes E2E-Projekt mit echtem Service Worker): grün.
- **Start mit v1-Daten** (E2E auf einer IndexedDB im v1-Layout, jede ID jeder Tabelle verglichen) und **frischer Start** (jeder E2E-Test beginnt leer): grün.
- **Lighthouse** mobil: Performance **91**, Barrierefreiheit **100**, Best Practices **100**, SEO 63 (gewollt `noindex`, DECISIONS #18). Erst 75 – Fund und Behebung siehe DECISIONS #71.
- **axe** (WCAG 2.1 AA) für alle Screens und Sheets: keine schweren Verstöße.
- **Himmel-CPU** (Chromium, 10 s Leerlauf): 3,4 % mit Schnee, 0,1 % ohne.
- `ARCHITECTURE.md` (Schema v2, Shell, BFV-Pipeline, Tests) und `README.md` aktualisiert.

---

## Ehrliche Zusammenfassung v2

### Was neu ist und funktioniert (getestet)
Winterhimmel nach echter Tageszeit mit Glas-Design · Sicherheitsnetz (Schema-Migration ohne Datenverlust, automatische Sicherungen, Fehlergrenzen, Rettungsexport) · Abi-Rechner mit belegten Regeln · Noten, Klausur-Themen, Lernplan mit Wiederholungen, Stundenplan A/B, Ferien Bayern bis 2030 · FernUni-Punkte und Prüfungsberechtigung · anpassbares Dashboard mit Briefing und Zielen · Zusammenhänge mit Signifikanztest, Wochenbericht als Markdown, Trends, Jahres-Heatmap · BFV-Spielplan und Tabelle automatisch, Spiel nach Abpfiff mit einem Tap eintragen · Einführung, neues Icon, Startbildschirme.

Vier unabhängige Reviews mit zusammen 54 Funden; alle behoben oder begründet abgelehnt (DECISIONS). Drei Mal hat die CI etwas aufgehalten, das sonst live gegangen wäre.

### Unsicher (bitte im Kopf behalten)
- **Abi-Regeln:** Rundung der Halbjahresleistung und die Umrechnungstabelle (Anlage 13) sind nicht amtlich belegt; Sonderfälle (Fächerkonstellationen § 54, Optionsregel) werden nur gemeldet, nicht geprüft. Verbindlich ist die Oberstufenkoordination. Details: `ABI_RULES` in der App, Obsidian „Abi-Regeln Bayern“.
- **BFV:** keine offizielle API. Jede Änderung an bfv.de kann den Abgleich brechen (dann wird die Action rot, die App behält den letzten Stand). Ergebnisse liest Winter bewusst nicht (verschleiert). Einzelstatistiken für Junioren sind nicht öffentlich.
- **Ferien:** hinterlegt bis Schuljahr 2029/30.

### Nicht getestet
- **Auf dem echten iPhone:** Einführung, neue Startbildschirme, Glas-Unschärfe über Schnee (GPU/Akku), Safe-Areas, „Bewegung reduzieren“ in Safari (in WebKit nachgestellt und dabei einen echten Fehler gefunden), Update-Hinweis im Standalone-Modus.
- Visuelle Regression läuft nur lokal (Windows), nicht in der CI (DECISIONS #68).
- Große Datenmengen über mehrere Jahre (Rückblick/Trends laden alles).

### Ideen für v3
1. Benachrichtigungen für Fristen und „Spiel eintragen“ (Web Push für Homescreen-Apps, braucht einen kleinen Push-Dienst).
2. Automatisches Backup in iCloud Drive per Kurzbefehl-Automation.
3. Health-Import per Automation morgens, ohne Tippen.
4. Lernplan mit Stundenplan verzahnen (freie Stunden, Hausaufgaben-Zeit).
5. BFV: Spielerstatistik, falls Filip eine öffentliche Spieler-ID bekommt (`playerId` in `bfv.config.json` ist vorbereitet).
6. Abi-Rechner: Fächerkonstellationen nach § 54 automatisch prüfen, sobald die Regeln mit der Schule geklärt sind.
7. Visuelle Regression zusätzlich in der CI mit Linux-Referenzbildern (in einem Container erzeugen und einmal ansehen).

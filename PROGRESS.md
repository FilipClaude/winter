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


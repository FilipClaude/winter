# DESIGN – „Winter“

**Leitbild:** eine klare Winternacht. Ruhig, kalt, präzise. Viel Raum, wenig Lärm.

Quelle aller Werte: [`src/styles/tokens.css`](src/styles/tokens.css). Komponenten verwenden **nur** diese Variablen. Hex-Werte stehen ausschließlich in `tokens.css` sowie dort, wo CSS-Variablen technisch nicht lesbar sind (Web-Manifest, `index.html`-Preload-Hintergrund, App-Icon). Diese Stellen sind kommentiert.

## Farbe

| Token | Wert | Verwendung |
|---|---|---|
| `--color-bg` | `#0A0D12` | Seitenhintergrund (fast schwarzes Blaugrau) |
| `--color-bg-glow` | `#111A24` | sehr flacher Radialverlauf oben |
| `--color-surface` / `-2` / `-3` | `#10151C` / `#161C25` / `#1D2430` | Karten, Eingaben, gedrückte Zustände |
| `--color-line` / `-strong` | Off-White 8 % / 16 % | 1px-Haarlinien statt Schatten |
| `--color-text` | `#E4ECF4` | Primärtext, kühles Off-White |
| `--color-text-2` | `#93A1B3` | Sekundärtext |
| `--color-text-3` | `#7D8CA1` | Tertiärtext, Labels (AA auf allen Flächen) |
| `--color-accent` | `#A9D8F5` | **einziger Akzent: Eisblau** – aktive Tabs, Ring, Fortschritt, Primäraktion |
| `--color-accent-08…56` | Eisblau mit Alpha | Heatmap-Stufen, Hover, Flächenfüllungen |
| `--color-accent-ink` | `#07121B` | Text auf Eisblau-Flächen |
| `--color-warn` (+ `-12`, `-28`) | `#E2A874` | **einzige Warnfarbe**: Fristen, Überlastung, Fehler |

Regeln:
- Keine Kategorie-Farben. Module unterscheiden sich über Icons und Typografie.
- Zustände: aktiv = Eisblau, inaktiv = Text-3, Gefahr = Warnfarbe. Mehr gibt es nicht.
- Kontraste werden automatisch geprüft: `src/styles/tokens.test.ts` (alle Textfarben ≥ 4.5:1 auf allen Flächen).

## Typografie

- **Geist Variable** (Grotesk) für alles. **Geist Mono Variable** für Einheiten, Uhrzeiten und kleine Messwerte (`.mono`).
- Große Zahlen (`.num`) in Geist mit Tabellenziffern, leichte Strichstärke, enge Laufweite (`--tracking-display`). Sie sind das gestalterische Hauptelement.
- Labels über Werten: `--text-2xs`, Versalien, `--tracking-caps`, Farbe Text-3.
- Eingaben mindestens `--text-base` (16px), damit iOS nicht zoomt.
- Schriften liegen lokal (Latin-Subset, `src/styles/fonts.css`) und werden vom Service Worker vorgeladen.

| Token | px | Einsatz |
|---|---|---|
| `--text-hero` | 64 | Datum, Ringwert |
| `--text-display` | 48 | Kennzahl einer Karte |
| `--text-3xl` / `2xl` | 36 / 28 | Screen-Titel, Sekundärzahlen |
| `--text-xl` / `lg` | 22 / 18 | Kartentitel, Sheet-Titel |
| `--text-base` / `sm` / `xs` | 16 / 14 / 12 | Fließtext, Metadaten |

## Raum, Form

- 4er-Raster (`--space-1` … `--space-16`). Seitenrand 20px, Kartenabstand 12px, Karteninnenabstand 16–20px.
- Radien: Karten `--radius-l` (22), Eingaben `--radius-m` (16), Chips `--radius-pill`.
- Karten: Fläche `--color-surface`, **1px-Haarlinie**, kein Schlagschatten.
- Blur nur bei Tab-Leiste und Sheets (`--blur-glass` über `--color-glass`).
- Touch-Ziele ≥ 44px (`--touch`).
- Safe-Areas: Header oben `--safe-top`, Tab-Leiste unten `--safe-bottom`.
- Desktop: zentrierte Spalte `--content-max` (480px).

## Textur und Atmosphäre (v2: Winterhimmel)

- **Winterhimmel** (`src/shell/Sky.tsx`) hinter der UI, nach der **echten Tageszeit in München** (Sonnenstand offline berechnet, `src/lib/sky/astro.ts`):
  - Phasen **Nacht → Morgen (Blaue Stunde) → Tag → Abend**, weich gemischt über die Sonnenhöhe (Tag ab +6°, Dämmerung −10…+2°, Nacht unter −16°).
  - Nacht: Sterne und Mond in der **echten Phase** (Position stilisiert oben rechts). Tag: gedämpftes Stahlblau, nie grell. Abend: kaltes Violett-Blau mit **einem** sehr gedämpften warmen Streifen am Horizont.
  - Horizontlicht dort, wo die Sonne steht (Azimut). Unten eine dunkle **Alpensilhouette** in 3 Ebenen mit leichter Parallaxe beim Scrollen bzw. Neigen (nur nach Erlaubnis).
  - **Schnee in 3 Tiefen** (fern: klein/langsam, mittel, nah: weich/schnell) auf eigener Canvas. Modi: aus / dezent / echtes Wetter (Open-Meteo, 30 min Cache, offline „leicht“).
- Alle Himmelsfarben sind Tokens (`--sky-<phase>-<stop>`), dazu je Phase **veil** (Abdunklung) und **glass** (Kartendeckkraft). `tokens.test.ts` prüft **jede** Text-/Hintergrund-Kombination in **jeder** Phase auf WCAG AA (582 Prüfungen). Lesbarkeit hat Vorrang: deshalb bleibt auch der Tag eher dunkel.
- Karten sind **Glas**: `color-mix(--color-surface, --glass-alpha)` + `--glass-blur`. `--glass-alpha` setzt der Himmel je nach Phase; `html[data-sky]` trägt die vorherrschende Phase.
- **Leistung:** statischer Himmel nur bei Änderung (Minutentakt, Scroll), Schnee auf getrennter Canvas mit 30 fps und Pixeldichte 1, Pause bei verdecktem Tab, bei „Bewegung reduzieren“ ein statisches Bild. Gemessen (Chromium, 10 s Leerlauf): **3,4 %** Hauptthread mit Schnee, **0 %** ohne.
- Entwickler-Schalter „Tageszeit simulieren“ in den Einstellungen.
- Frost: Rauschtextur (SVG-Turbulenz als Maske) in `--color-frost` mit 3,5 % Deckkraft über dem Himmel.

## Typo-Skala v2 (semantisch)

| Token | Wert | Einsatz |
|---|---|---|
| `--type-display-size` | 64 | Datum, Ringwert |
| `--type-headline-size` | 36 | Screen-Titel |
| `--type-title-size` | 28 | Kennzahlen (StatTile) |
| `--type-subtitle-size` | 18 | Karten-/Sheet-Titel |
| `--type-body-size` | 16 | Fließtext, Eingaben |
| `--type-caption-size` | 12 | Metadaten |
| `--type-label-size` | 11 | Versalien-Labels |

Zahlen immer `.num` (Tabellenziffern).

## Elevation

Ebene 0 Himmel · 1 Karte (Glas) · 2 Tab-Leiste/Sheet (`--color-glass` + Blur) · 3 Toast (Fläche 3 + starke Haarlinie). Keine Schlagschatten außer am Sheet.

## Bewegung

- `motion`, sparsam: `--dur-fast` 120ms (Taps), `--dur` 200ms (Übergänge), `--dur-slow` 360ms (Ring), `--dur-screen` 240ms. Federn als Konstanten in `src/ui/motion.ts` (`SPRING_SHEET`, `SPRING_SOFT`).
- Tap-Feedback: Buttons skalieren beim Drücken auf 97 %.
- Laden: **Skeletons** (`ScreenSkeleton`) statt springendem Layout.
- Werte zählen beim Ändern hoch (`NumberTicker`).
- Checkboxen „frieren ein“: kurzer Eisblau-Kristall-Puls + Haken.
- Bottom-Sheets federn (Spring, kein Überschwingen über 4px).
- `prefers-reduced-motion`: alle Dauern 0, kein Schnee, keine Federung.

## Icons

- **Lucide**, Strichstärke 1.5, Größe 20 (Navigation 22). Keine Emojis.

## Komponenten (Kurzreferenz)

| Komponente | Gestaltung |
|---|---|
| Card | Fläche, Haarlinie, Radius L, Label in Versalien oben links, optional Aktion oben rechts |
| Button primär | Eisblau-Fläche, Text Accent-Ink, Radius M, Höhe 48 |
| Button sekundär | transparent, Haarlinie strong, Text |
| Button ghost | nur Text-2, Fläche bei Druck |
| Segmented | Fläche-2, aktives Segment Fläche-3 + Text |
| Stepper (+/−) | runde 44px-Buttons mit Haarlinie |
| Ring | Spur `--color-line`, Fortschritt Eisblau, runde Kappen |
| Warn-Banner | Fläche `--color-warn-12`, Haarlinie `--color-warn-28`, Icon und Text in Warnfarbe |
| Tab-Leiste | Glas, Haarlinie oben, aktiv = Eisblau + Label, inaktiv = Text-3 |
| StatTile (v2) | Label in Versalien, Zahl in Titelgröße, optional Trendpfeil (Eisblau = gut, Warnfarbe = schlecht) |
| Sparkline (v2) | Eisblaue Linie ohne Achsen, Punkt am letzten Wert |
| ListRow (v2) | Icon, Titel, Metazeile, rechts Wert/Chevron; als Button mit Druckzustand |
| Skeleton (v2) | Schimmernde Balken in Fläche 2/3 |
| Chart-Tooltip (v2) | Tap auf einen Balken/Punkt zeigt den exakten Wert; jeder Punkt ist ein beschrifteter Button (VoiceOver) |

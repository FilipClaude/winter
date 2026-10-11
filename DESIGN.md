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

## Textur und Atmosphäre

- Hintergrund: Radialverlauf `--color-bg-glow` → `--color-bg` oben, kaum sichtbar.
- Frost: Rauschtextur (SVG-Turbulenz als Maske) in `--color-frost` mit 3,5 % Deckkraft.
- Schneefall (optional, Einstellungen): wenige, langsame, kleine Flocken. Aus bei `prefers-reduced-motion`.

## Bewegung

- `motion`, sparsam: `--dur-fast` 120ms (Taps), `--dur` 200ms (Übergänge), `--dur-slow` 360ms (Ring).
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

# DEPLOY – Winter kostenlos mit HTTPS hosten und aufs iPhone holen

HTTPS ist Pflicht: Ohne HTTPS gibt es keinen Service Worker, also kein Offline und keine echte App. Alle Wege unten sind kostenlos und haben automatisch HTTPS. **Gewählt: GitHub Pages** (alles bei GitHub, kein weiteres Konto). Adresse: `https://filipclaude.github.io/winter/`.

> **Wichtig, bevor es losgeht:** Die Daten hängen an der **Adresse (Domain)** der App. Wechselst du später die Adresse (z. B. von GitHub Pages zu Vercel oder auf eine eigene Domain), startet die App dort **leer**. Vorher in der alten App ein **Backup** machen und in der neuen importieren.

## Schritt 1 – Code auf GitHub (erledigt)

Repository `FilipClaude/winter`, Branch `main`. Für einen neuen Rechner:

```bash
git remote add origin https://github.com/FilipClaude/winter.git
```

```bash
git push -u origin main
```

Der Commit-Autor ist lokal `Filip <filip@winter.local>`. Wenn du deine GitHub-E-Mail sehen willst: `git config user.email "…"`.

## Schritt 2 – GitHub Pages einschalten (erledigt am 12.10.2026: Repository öffentlich, Pages mit Quelle „GitHub Actions“, App live)

1. **Sichtbarkeit:** GitHub Pages ist im kostenlosen Plan nur für **öffentliche** Repositories verfügbar. Entweder:
   - Repository öffentlich machen: **Settings → General → ganz unten „Danger Zone“ → Change visibility → Public**. Öffentlich ist nur der **Code**. Deine Daten liegen ausschließlich auf deinem iPhone und landen nie auf GitHub.
   - oder GitHub Pro abonnieren, dann geht Pages auch privat.
2. **Settings → Pages → Build and deployment → Source: „GitHub Actions“** auswählen.
3. **Actions**-Tab öffnen → Workflow **„Deploy auf GitHub Pages“** → **Run workflow** (oder einfach den nächsten `git push` abwarten).
4. Nach ca. 2 Minuten ist die App unter `https://filipclaude.github.io/winter/` erreichbar.
5. Ab jetzt baut jeder `git push` auf `main` automatisch neu. Der Workflow (`.github/workflows/pages.yml`) prüft vorher Typen und Unit-Tests. Schlägt etwas fehl, bleibt die alte Version online.

Technik: Die App liegt in einem Unterordner (`/winter/`). Der Workflow setzt dafür `BASE_PATH=/winter/`, Vite und das Manifest richten sich danach. Lokal bleibt alles unter `/`. Prüfen lässt sich ein Unterordner-Build mit `node scripts/check-base.mjs /winter/` (nach einem Build mit gesetztem `BASE_PATH`).

GitHub Pages erlaubt keine eigenen Cache-Header. Das ist unkritisch: Browser laden `sw.js` für die Update-Prüfung ohnehin am HTTP-Cache vorbei. Updates können trotzdem bis zu ca. 10 Minuten verzögert ankommen.

## Alternativen

### Vercel

1. <https://vercel.com> → **Sign Up** → **Continue with GitHub** (Hobby-Plan, kostenlos, geht auch mit privatem Repository).
2. **Add New… → Project** → Repository `winter` → **Import** → **Deploy**. Werte in `vercel.json` (Build `npm run build`, Ausgabe `dist`, `sw.js` nie cachen).
3. Adresse wie `https://winter-xyz.vercel.app`.

### Cloudflare Pages

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → Repository `winter`.
2. Build command `npm run build`, Build output directory `dist`, ggf. Environment variable `NODE_VERSION` = `22`.
3. Adresse `https://winter.pages.dev`. Cache-Regeln in `public/_headers`.

## Schritt 3 – Auf dem iPhone installieren

1. **Safari** öffnen (nicht Chrome; nur Safari kann Web-Apps auf den Homescreen legen) → `https://filipclaude.github.io/winter/` eingeben.
2. Unten auf **Teilen** (Quadrat mit Pfeil) → nach unten scrollen → **Zum Home-Bildschirm**.
3. Name **Winter** lassen → **Hinzufügen**.
4. Winter **vom Homescreen** öffnen, nicht aus Safari. Nur dort läuft es als App: ohne Browserleisten, mit eigenem Speicher, offline.
5. Einmal alle Tabs durchtippen, damit alles im Cache liegt. Danach funktioniert die App auch im Flugmodus.
6. **Einstellungen → Speicher:** Steht dort „nicht gewährt“, ist das normal. Safari entscheidet selbst. Deshalb regelmäßig ein **Backup** machen (die App erinnert nach 7 Tagen).
7. **Health:** Den Kurzbefehl nach [HEALTH-SHORTCUT.md](HEALTH-SHORTCUT.md) bauen.

## Updates

- `git push` → GitHub Actions baut neu (Fortschritt im **Actions**-Tab).
- Beim nächsten Öffnen erscheint oben **„Neue Version verfügbar · Aktualisieren“**. Erst nach dem Tap wird neu geladen, damit nichts Halbgetipptes verloren geht.
- Daten bleiben bei Updates erhalten (IndexedDB, versioniertes Schema mit Migrationen).

## Lokal testen

```bash
npm run build
```

```bash
npm run preview
```

Dann <http://localhost:4173> öffnen. Am iPhone im selben WLAN funktioniert `http://<PC-IP>:4173` nur eingeschränkt: kein HTTPS, also kein Service Worker und keine Zwischenablage. Für echte Tests am iPhone deshalb die gehostete Version nutzen.

## Häufige Probleme

| Problem | Lösung |
|---|---|
| Unter Settings → Pages steht „Upgrade or make this repository public“ | Repository öffentlich machen (siehe Schritt 2) oder GitHub Pro |
| Actions-Lauf rot | Im **Actions**-Tab den Lauf öffnen, der fehlgeschlagene Schritt zeigt den Grund (meist Test oder Typfehler) |
| Seite zeigt 404 | Source unter Settings → Pages muss „GitHub Actions“ sein; Adresse mit `/winter/` am Ende |
| App zeigt alte Version | App ganz schließen (App-Umschalter hochwischen) und neu öffnen, dann „Aktualisieren“ tippen |
| Nach Adresswechsel alles leer | Daten hängen an der Domain: Backup aus der alten Adresse importieren |
| „Zum Home-Bildschirm“ fehlt | Nur in Safari vorhanden, nicht in Chrome oder der Google-App |

# DEPLOY – Winter kostenlos mit HTTPS hosten und aufs iPhone holen

HTTPS ist Pflicht: Ohne HTTPS gibt es keinen Service Worker, also kein Offline und keine echte App. Beide Wege unten sind kostenlos und haben automatisch HTTPS. **Empfehlung: Vercel**, weil es am einfachsten ist.

> **Wichtig, bevor es losgeht:** Die Daten hängen an der **Adresse (Domain)** der App. Wechselst du später die Adresse (z. B. von Vercel zu Cloudflare oder auf eine eigene Domain), startet die App dort **leer**. Vorher in der alten App ein **Backup** machen und in der neuen importieren.

## Schritt 1 – Code auf GitHub (einmalig, ca. 5 min)

1. Auf <https://github.com> ein Konto anlegen (falls nicht vorhanden).
2. Oben rechts **+** → **New repository** → Name `winter` → **Private** → **Create repository**.
3. Am Windows-PC im Projektordner `C:\Users\HP\Downloads\App` (PowerShell):

```bash
git remote add origin https://github.com/DEIN-NAME/winter.git
```

```bash
git push -u origin main
```

   Git fragt beim ersten Push nach der Anmeldung (Browserfenster). Der Commit-Autor ist lokal `Filip <filip@winter.local>`. Wenn du deine GitHub-E-Mail sehen willst: `git config user.email "…"`.

## Schritt 2a – Vercel (empfohlen)

1. <https://vercel.com> → **Sign Up** → **Continue with GitHub** (Hobby-Plan, kostenlos).
2. **Add New… → Project** → Repository `winter` → **Import**.
3. Vercel erkennt **Vite** automatisch. Die Werte stehen auch in `vercel.json`:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Deploy** klicken. Nach ca. 1 Minute gibt es eine Adresse wie `https://winter-xyz.vercel.app`.
5. Ab jetzt baut jeder `git push` automatisch eine neue Version.

`vercel.json` sorgt dafür, dass `sw.js` nie gecacht wird. Sonst kämen Updates verspätet an.

## Schritt 2b – Alternative: Cloudflare Pages

1. <https://dash.cloudflare.com> → Konto anlegen → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → Repository `winter`.
2. Framework preset **Vite** (oder „None“), Build command `npm run build`, Build output directory `dist`.
3. Unter Environment variables `NODE_VERSION` = `22` setzen (falls der Build über eine alte Node-Version klagt).
4. **Save and Deploy** → Adresse `https://winter.pages.dev`.

Die Cache-Regeln stehen in `public/_headers`.

## Schritt 3 – Auf dem iPhone installieren

1. **Safari** öffnen (nicht Chrome; nur Safari kann Web-Apps auf den Homescreen legen) → die Adresse aus Schritt 2 eingeben.
2. Unten auf **Teilen** (Quadrat mit Pfeil) → nach unten scrollen → **Zum Home-Bildschirm**.
3. Name **Winter** lassen → **Hinzufügen**.
4. Winter **vom Homescreen** öffnen, nicht aus Safari. Nur dort läuft es als App: ohne Browserleisten, mit eigenem Speicher, offline.
5. Einmal alle Tabs durchtippen, damit alles im Cache liegt. Danach funktioniert die App auch im Flugmodus.
6. **Einstellungen → Speicher:** Steht dort „nicht gewährt“, ist das normal. Safari entscheidet selbst. Deshalb regelmäßig ein **Backup** machen (die App erinnert nach 7 Tagen).
7. **Health:** Den Kurzbefehl nach [HEALTH-SHORTCUT.md](HEALTH-SHORTCUT.md) bauen.

## Updates

- `git push` → Vercel/Cloudflare baut neu.
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
| App zeigt alte Version | App ganz schließen (App-Umschalter hochwischen) und neu öffnen, dann „Aktualisieren“ tippen |
| Nach Adresswechsel alles leer | Daten hängen an der Domain: Backup aus der alten Adresse importieren |
| „Zum Home-Bildschirm“ fehlt | Nur in Safari vorhanden, nicht in Chrome oder der Google-App |
| Build schlägt fehl (Node) | Node 20.19 oder neuer einstellen (Vercel: Project Settings → Node.js Version) |

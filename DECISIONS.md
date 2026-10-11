# DECISIONS

Begründete Entscheidungen bei Unklarheiten. Neueste unten.

| # | Datum | Entscheidung | Begründung |
|---|---|---|---|
| 1 | 2026-10-11 | Node 24 LTS und Git per winget installiert | Waren nicht vorhanden; mit Filip abgesprochen. |
| 2 | 2026-10-11 | TypeScript 6.0 statt 7.0 | Das offizielle Vite-Template (create-vite 9) setzt TS ~6.0; typescript-eslint ist darauf abgestimmt. TS 7 (Go-Port) ist zu frisch. |
| 3 | 2026-10-11 | Kein Tailwind, reines CSS mit Tokens | Kleineres Setup, Tokens sind direkt die Quelle. Komponenten-CSS in `src/styles/`. |
| 4 | 2026-10-11 | Schrift: Geist + Geist Mono (Fontsource, nur Latin-Subset) | Moderne Grotesk mit passender Mono. Latin deckt Deutsch komplett ab, spart ~70 % Schriftgröße im Precache. |
| 5 | 2026-10-11 | Große Zahlen in Geist mit Tabellenziffern, Mono nur für Einheiten | Die durchgestrichene Null von Geist Mono wirkt in 64px zu technisch und laut. |
| 6 | 2026-10-11 | Hash-Routing (`#/heute`) mit eigenem kleinen Router | Keine Server-Rewrites beim Hosting nötig, Offline-Navigation trivial, keine zusätzliche Abhängigkeit. |
| 7 | 2026-10-11 | Icons + Splash per `@vite-pwa/assets-generator` aus `public/icon.svg`, nur Hochformat | Reproduzierbar (`npm run icons`), App ist auf Hochformat festgelegt. |
| 8 | 2026-10-11 | E2E gegen den Produktions-Build (`vite preview`), Service Worker in normalen Tests blockiert | Tests sehen das, was am iPhone läuft. SW nur im Offline-Test aktiv, damit Caching normale Tests nicht verfälscht. |
| 9 | 2026-10-11 | Git-Autor lokal `Filip <filip@winter.local>` | Keine echte E-Mail im Repo, falls es später öffentlich auf GitHub landet. Änderbar mit `git config user.email`. |

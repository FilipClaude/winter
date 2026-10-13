# BFV-Abgleich – was geht, was nicht, wie man ihn repariert

Stand: 12.10.2026 · Mannschaft: **SV Planegg-Krailling U17 (B-Junioren), U 17 (B-Jun.) Landesliga Bayern Süd**
Mannschaftsseite: <https://www.bfv.de/mannschaften/sv-planegg-krailling/016PAD8FHK000000VV0AG811VTE5EA5R>

> **Wichtig:** Der BFV hat **keine öffentliche API**. Der Abgleich nutzt einen offiziellen Export (iCal) und liest die Tabelle aus der öffentlichen Mannschaftsseite. Das ist für private Nutzung (ein Abgleich pro Tag, sonntags zwei, je 2 Anfragen) vertretbar – aber **inoffiziell**: Jede Änderung an bfv.de kann ihn brechen. Dann wird der Workflow rot, die App behält den letzten Stand, und alles lässt sich weiter von Hand eintragen.

## Ergebnis der Erkundung (12.10.2026)

Untersucht mit Playwright (Chromium, Netzwerk mitgeschnitten, `scripts/bfv-explore.mjs`) und direkten Abrufen.

| Daten | Wo | Zustand | Genutzt? |
|---|---|---|---|
| **Künftige Spiele** (Datum, Anstoß, Gegner, Heim/Auswärts, Wettbewerb, Liga, Ort) | Offizieller **iCal-Export** `service.bfv.de/rest/icsexport/Spielplan?staffel=…&id=…` (Link „iCal-Export“ auf der Mannschaftsseite) | Klartext, stabil, für Kalender-Abos gedacht | **Ja** |
| **Tabelle** (Platz, Spiele, S-U-N, Tore, Differenz, Punkte) | HTML der Mannschaftsseite (`bfv-table-entry--data`) | Klartext im Seiten-HTML | **Ja** |
| **Ergebnisse** vergangener Spiele | Fragment `/partial/mannschaftsprofil/spielplan/<id>/alle` | **Verschleiert:** Ziffern sind Platzhalterzeichen (z. B. `&#xe6b3;`), lesbar erst über eine je Seitenaufruf geladene Schriftart (`data-module="BfvFontObfuscation"`, `app.bfv.de/export.fontface/…`) | **Nein** – bewusst |
| Formkurve | ergibt sich aus Ergebnissen | s. o. | aus **eigenen** Einträgen berechnet |
| **Spielerprofil** (Einsätze, Tore, Karten) | `bfv.de/spieler/-/<ID>`, per JavaScript nachgeladen | nicht geprüft/genutzt: Für Junioren sind Einzelstatistiken in der Regel nicht öffentlich; **Spielminuten führt der BFV nicht** | **Nein** |
| `robots.txt` | `bfv.de/robots.txt` | existiert nicht (404) | – |

**Warum die Ergebnisse nicht ausgelesen werden:** Die Schriftart-Verschleierung ist ein absichtlicher Schutz gegen automatisches Auslesen. Ihn zu umgehen wäre mehr als eine Grauzone. Deshalb trägt Filip nach dem Spiel Ergebnis, Minuten, Tore, Assists und Note selbst ein – die App fragt mit **einem Tap** danach, Gegner, Datum und Heim/Auswärts sind vom BFV vorausgefüllt (markiert „vom BFV“).

## Ablauf

```
GitHub Action „BFV-Abgleich“ (.github/workflows/bfv-sync.yml)
  täglich 05:00 UTC (06:00 Winter-/07:00 Sommerzeit) + sonntags 19:00 UTC, manuell per „Run workflow“
  └─ node scripts/bfv-sync.ts
       1. iCal-Export holen          (1 Anfrage)
       2. Mannschaftsseite holen     (1 Anfrage, Tabelle)
       3. parsen + mit Zod prüfen    (src/lib/bfv/bfv.ts)
       4. mit dem alten Stand zusammenführen (vergangene Spiele bleiben als „vorbei“, abgesagte dauerhaft als „entfallen“; beim Saisonwechsel am 1. Juli bleiben nur die Spiele der letzten 21 Tage)
       5. public/data/bfv.json nur bei echten Änderungen schreiben
  └─ Commit „BFV-Abgleich JJJJ-MM-TT“ → startet das Deployment (pages.yml) direkt
App: lädt data/bfv.json (Netz zuerst, offline Kopie im Service Worker und in IndexedDB)
```

- **Schonend:** genau 2 Anfragen pro Lauf, eigener User-Agent mit Kontakt (`Winter-App/2 … github.com/FilipClaude/winter`), 20 s Zeitlimit, 3 Versuche mit wachsender Pause (2/4/8 s).
- **Fehler:** HTTP-Fehler, kein Kalender, weniger als die Hälfte der Termine lesbar (Formatänderung), keine Tabelle, eigene Mannschaft fehlt oder Zod-Prüfung scheitert → Skript endet mit Code 1, **alte Datei bleibt**, Workflow rot (GitHub schickt eine Mail).
- **Konfiguration:** `bfv.config.json` (Vereinsname, Mannschafts-URL, iCal-URL, optional Spieler-ID).

## 60-Tage-Regel

GitHub deaktiviert geplante Workflows in öffentlichen Repos nach **60 Tagen ohne Aktivität** im Repository. Commits des Abgleichs zählen als Aktivität – in der Saison gibt es fast täglich welche. In der Sommerpause kann es aber wochenlang keine Änderung geben. Deshalb macht der Workflow einen **leeren Keepalive-Commit**, wenn der letzte Commit älter als 45 Tage ist (löst kein Deployment aus). Falls der Workflow trotzdem einmal deaktiviert wurde: Actions → „BFV-Abgleich“ → „Enable workflow“.

## Reparieren, wenn es bricht

1. **Lokal prüfen:** `node scripts/bfv-sync.ts` – die Fehlermeldung sagt, welcher Schritt scheitert.
2. **Seite neu erkunden:** `node scripts/bfv-explore.mjs` legt `bfv-explore.json` an (Netzwerkanfragen, Export-Links, Seitentext).
3. Typische Ursachen:
   - **iCal-URL geändert** (neue Saison → neue `staffel`-ID): auf der Mannschaftsseite den Link „iCal-Export“ kopieren und in `bfv.config.json` eintragen.
   - **Mannschafts-URL geändert** (neue Saison oder Altersklasse, z. B. U19): neue URL in `bfv.config.json`.
   - **Tabellen-HTML geändert:** `parseTable` in `src/lib/bfv/bfv.ts` an die neuen CSS-Klassen anpassen; die Fixture `src/test/fixtures/bfv-tabelle.html` durch einen aktuellen Ausschnitt ersetzen und `npx vitest run src/lib/bfv` laufen lassen.
   - **Vereinsname im Spielplan anders:** `teamName` in `bfv.config.json`.
4. Den Workflow in GitHub per „Run workflow“ starten und prüfen, dass er grün ist.

## Was die App daraus macht

- **Dashboard:** Widget „Nächstes Spiel“ (Anstoß, Gegner, Heim/Auswärts, Tabellenplatz).
- **Training:** nächstes Spiel und die folgenden, Tabelle mit eigener Zeile hervorgehoben, Formkurve (letzte 5, aus eigenen Einträgen), Datum der letzten Änderung und Link zu bfv.de.
- **Nach dem Spiel** (ab 2 h nach Anstoß, bis 21 Tage zurück): Hinweis „Spiel gegen … eintragen?“ auf Heute und Training. Gespeicherte Spiele tragen die BFV-ID; der Abgleich überschreibt **nie** manuelle Werte.
- **Saisonstatistik:** Spiele, Tore, Assists, Scorerpunkte, Minuten, Tore/90, Assists/90, Chancenverwertung, Ø Note, S-U-N, Vergleich zur Vorsaison.

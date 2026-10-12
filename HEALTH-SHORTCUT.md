# Kurzbefehl „Winter Health“ bauen

Apple Health hat keine Schnittstelle für Web-Apps. Deshalb liest ein Kurzbefehl die Werte aus Health und legt sie als JSON in die Zwischenablage. Winter fügt sie mit einem Tap ein. Dauer zum Einrichten: etwa 10–15 Minuten.

> **Ehrlicher Hinweis:** Ich konnte den Kurzbefehl nicht am iPhone testen (Entwicklung auf Windows). Die **Aktionsnamen** stammen aus meinem Wissen über die deutsche Kurzbefehle-App. Wo ich mir nicht sicher bin, steht **(unsicher)** dahinter. Dann heißt die Aktion bei dir eventuell leicht anders. Such in der Aktionssuche nach dem englischen Begriff in Klammern oder nach einem Teilwort wie „Health“, „Statistik“ oder „Datum“.

## Bewährter Weg (am iPhone getestet, 12.10.2026)

Mit Filip Schritt für Schritt gebaut, iOS-Namen wie sie bei ihm heißen:

1. **„Health-Messungen suchen“**: Typ ist *Schritte* (Pflichtfilter, nicht löschbar) + Filter **Startdatum ist heute**.
2. **„Statistik berechnen“** → **Summe**. Die Ergebnis-Variable heißt **„Summe“** (nicht „Statistik“).
3. **„Datum formatieren“** → Aktuelles Datum, Eigenes Format `yyyy-MM-dd`.
4. **„Text“** als JSON-Vorlage statt Wörterbuch (robuster):
   `{"v":1,"date":"[Formatiertes Datum]","steps":"[Summe]"}`
   Die Werte in eckigen Klammern müssen **Variablen-Kästchen** sein, kein getippter Text. Sonst meldet Winter z. B. „Datum … nicht lesbar“.
5. **„In Zwischenablage kopieren“** (Eingabe: Text).

Distanz: Aktion 1+2 noch einmal hinzufügen (Typ **Gehen + Laufen (Distanz)**), über die Text-Aktion ziehen, im Text über „Variable auswählen“ genau die neue „Summe“ antippen. Duplizieren per Gedrückthalten klappte bei Filip nicht.

**Endstand bei Filip (läuft):**

```
{"v":1,"date":"[Formatiertes Datum]","steps":"[Summe]","distanceKm":"[Summe Distanz]"}
```

- Häufigster Fehler: ein fehlendes **Komma** zwischen zwei Einträgen → Winter meldet „Kein gültiges JSON“ und zeigt den Anfang des Inhalts.
- **Schlaf trägt Filip von Hand in Winter ein**, Teil B entfällt. Stockwerke braucht er nicht.
- Weitere sinnvolle Werte (Ruhepuls, HRV, aktive Kalorien, VO2max) gibt es nur mit Apple Watch o. Ä. und sind in Winter noch nicht eingebaut.

## Was der Kurzbefehl am Ende liefert

```json
{
  "v": 1,
  "date": "2026-10-11",
  "steps": 8423,
  "distanceKm": 6.1,
  "flights": 12,
  "sleep": { "start": "2026-10-10T23:12:00+02:00", "end": "2026-10-11T06:58:00+02:00" }
}
```

- Alle Felder außer `"v": 1` sind **optional**. Schritte allein reichen schon.
- Winter ist tolerant: Zahlen als Text, deutsches Komma (`6,1`), Tausenderpunkt (`8.423`), Einheiten (`6,1 km`) und typografische Anführungszeichen werden verstanden.
- Distanz in Metern? Dann den Schlüssel `distanceM` statt `distanceKm` verwenden.
- Datum auch als `11.10.2026` möglich, Zeitpunkte auch im deutschen Format `11.10.2026, 06:58`.

## Teil A – Grundgerüst (Schritte, Distanz, Stockwerke)

1. **Kurzbefehle-App** öffnen → **+** (neuer Kurzbefehl) → oben auf den Namen tippen → **„Winter Health“** nennen. Der Name muss exakt so heißen wie in Winter unter *Einstellungen → Apple Health*.
2. **Schritte**
   1. Aktion **„Gesundheitsproben suchen“** (Find Health Samples) hinzufügen. **(Name unsicher; evtl. „Health-Messwerte suchen“)**
   2. Typ antippen → **Schritte**.
   3. Filter: **Startdatum** → **ist heute**.
   4. Aktion **„Statistik berechnen“** (Calculate Statistics) **(Name unsicher)** → Rechenart **Summe**. Eingabe: die Gesundheitsproben aus dem vorigen Schritt.
   5. Ergebnis antippen → **Umbenennen**: `Schritte`. Alternativ Aktion **„Variable festlegen“** → `Schritte`.
3. **Distanz:** Schritte 2.1–2.5 wiederholen, Typ **Gehen + Laufen (Distanz)** (Walking + Running Distance) **(Name unsicher)**. Variable `Distanz`.
4. **Stockwerke:** wie oben, Typ **Etagen gestiegen** (Flights Climbed) **(Name unsicher)**. Variable `Stockwerke`.
5. **Datum:**
   1. Aktion **„Datum“** → **Aktuelles Datum**.
   2. Aktion **„Datum formatieren“** → Datumsformat **Eigenes** → `yyyy-MM-dd`, Uhrzeitformat **Ohne**. Variable `Tag`.

## Teil B – Schlaf (optional)

Schlafdaten gibt es ohne Apple Watch nur, wenn am iPhone ein **Schlafplan** aktiv ist (Health → Schlaf). Ohne Schlafdaten diesen Teil weglassen. Dann trägst du Schlaf in Winter von Hand ein.

1. **„Gesundheitsproben suchen“** → Typ **Schlafanalyse** (Sleep Analysis) **(Name unsicher)**.
   - Filter **Startdatum** → **liegt in den letzten** `1` **Tag**.
   - Sortieren nach **Startdatum**, Reihenfolge **Älteste zuerst**.
2. **„Objekt aus Liste abrufen“** (Get Item from List) **(Name unsicher; evtl. „Element aus Liste abrufen“)** → **Erstes Objekt**. Danach **„Details von Gesundheitsproben abrufen“** (Get Details of Health Sample) **(unsicher)** → **Startdatum**.
3. **„Datum formatieren“** → **ISO 8601**, mit Uhrzeit. Variable `SchlafStart`.
4. Für das Ende: dieselbe Liste → **Letztes Objekt** → Detail **Enddatum** → **„Datum formatieren“** ISO 8601. Variable `SchlafEnde`.

> Apple speichert „Im Bett“ und Schlafphasen als einzelne Proben. Erstes Startdatum bis letztes Enddatum ergibt die Zeit im Bett. Das ist bewusst einfach gehalten. Wer es genauer will, filtert zusätzlich nach Wert = „Schlafend“.

## Teil C – JSON bauen und kopieren

1. Aktion **„Wörterbuch“** (Dictionary) hinzufügen. Mit **„Neues Objekt hinzufügen“** diese Einträge anlegen:

   | Typ | Schlüssel | Wert |
   |---|---|---|
   | Zahl | `v` | `1` |
   | Text | `date` | Variable `Tag` |
   | Zahl | `steps` | Variable `Schritte` |
   | Zahl | `distanceKm` | Variable `Distanz` |
   | Zahl | `flights` | Variable `Stockwerke` |
   | Wörterbuch | `sleep` | darin Text `start` = `SchlafStart`, Text `end` = `SchlafEnde` (nur mit Teil B) |

2. Aktion **„In Zwischenablage kopieren“** (Copy to Clipboard). Eingabe: **Wörterbuch**. Ein Wörterbuch wird dabei als JSON-Text kopiert. **(Verhalten nicht am Gerät geprüft. Siehe Test unten.)**
3. Optional als Datei-Fallback: **„Datei sichern“** (Save File) → Wörterbuch → Ziel **iCloud Drive/Winter/winter-health.json**, **„Fragen, wo gesichert werden soll“ aus**, **„Überschreiben“ an** **(Optionsnamen unsicher)**.

## Teil D – Erster Lauf und Test

1. In der Kurzbefehle-App den Kurzbefehl einmal mit ▶︎ starten. iOS fragt nach **Zugriff auf Health-Daten** → **Erlauben** (für Schritte, Distanz, Stockwerke, Schlaf).
2. Test: Notizen-App öffnen → lange tippen → **Einfügen**. Es sollte etwas wie `{"v":1,"date":"2026-10-11","steps":8423,…}` erscheinen.
   - Erscheint stattdessen ein Text wie `v: 1 date: …` ohne geschweifte Klammern, wurde das Wörterbuch nicht als JSON kopiert. Dann zwischen „Wörterbuch“ und „In Zwischenablage kopieren“ die Aktion **„Text“** einfügen und als Inhalt die Wörterbuch-Variable setzen. **(unsicher, ob nötig)**
3. In Winter: **Heute → „Health holen“** (oder Schnellerfassung → Health holen).

## Täglicher Ablauf

1. In Winter **„1 · Kurzbefehl starten“** tippen. Winter öffnet `shortcuts://run-shortcut?name=Winter%20Health`, der Kurzbefehl läuft.
2. Zurück zu Winter wechseln: oben links „◀ Winter“ **(Beschriftung unsicher; sonst per App-Umschalter)**.
3. **„2 · Werte einfügen“** tippen. iOS fragt einmal **„Einfügen erlauben?“** → **Einfügen**. iOS verlangt dafür einen echten Tap, deshalb der zweite Button.
4. Fertig: Schritte und Schlaf stehen auf dem Heute-Screen.

## Wichtige Falle: keine URL zurück in die App

Den Kurzbefehl **nicht** so bauen, dass er am Ende eine URL wie `https://…/#/heute?steps=…` öffnet. Eine URL aus einem Kurzbefehl öffnet sich in **Safari**, und Safari hat einen **anderen Speicher** als die Homescreen-App. Die Daten würden dort landen und in Winter fehlen. Deshalb läuft die Übergabe nur über die **Zwischenablage** (oder die Datei).

## Fehlerbilder

| Meldung in Winter | Ursache | Lösung |
|---|---|---|
| „Die Zwischenablage ist leer“ | Kurzbefehl lief nicht oder Abbruch | In der Kurzbefehle-App starten und auf Fehler achten |
| „Kein gültiges JSON“ | Wörterbuch wurde als Text formatiert | Teil D, Schritt 2 |
| „Zugriff auf die Zwischenablage verweigert“ | „Einfügen“ abgelehnt | Erneut tippen und „Einfügen“ wählen, oder „JSON von Hand einfügen“ |
| „distanceKm = 6100 ist unplausibel“ | Distanz kommt in Metern | Schlüssel in `distanceM` umbenennen |
| „Schlafzeiten nicht lesbar“ | Datumsformat | In Teil B „ISO 8601“ wählen |

## Erweiterung später

Die Health-Anbindung steckt in Winter hinter dem Interface `HealthSource` (`src/lib/health/source.ts`). Eine andere Quelle (kleiner Sync-Server, Uhr-Export) muss nur dasselbe JSON liefern.

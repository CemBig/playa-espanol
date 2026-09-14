# Playa Español

Spanisch-Grundlagen für den Spanien-Urlaub — als reine Web-App, ohne Server, ohne Konto,
ohne Werbung. Läuft komplett im Browser und funktioniert nach dem ersten Laden auch offline.

**Live: https://cembig.github.io/playa-espanol/**

## Was drin ist

- **16 Lektionen, ~476 Karten** nach dem 80/20-Prinzip: Begrüßung, Bausteine (und/aber/sehr/mit/ohne),
  Fragewörter, Zahlen, Uhrzeit, Kalender, die vier Grundverben (ser/estar/tener/hay), das
  Endungs-System der regelmäßigen Verben, die wichtigsten unregelmäßigen Verben, Restaurant,
  Essen, Farben, Einkaufen, Wegbeschreibung, Notfälle, Small Talk.
- **Spanisch aus Spanien**: vosotros, patatas, zumo, billete, caña — mit Hinweisen, wo es sich
  von Lateinamerika unterscheidet.
- **Spaced Repetition** nach SM-2 (Anki-Prinzip), mit Anki-artiger Unterscheidung von
  Nochmal / Schwer / Gut / Leicht und Vorschau des nächsten Termins.
- **Aussprache-Coach**: Sätze anhören (TTS), nachsprechen und bewerten lassen. Auf Geräten ohne
  brauchbare Spracherkennung (oft iPhone/Safari) automatisch Nachsprech-Modus mit Aufnahme
  und Vergleich.
- **Import / Export** des Fortschritts als JSON, plus Import eigener Lektionspakete.

## Aufbau

```
index.html          App-Hülle
sw.js               Service Worker (Offline-Fähigkeit)
css/styles.css      Design-System
js/app.js           Router und Start
js/core/            Logik: Inhalte, Speicher, SRS, Text-Vergleich, Sprache
js/ui/              Ansichten: Dashboard, Lektionen, Wiederholung, Aussprache, Einstellungen
js/content/         Der Lernstoff (lessons.js)
```

Der Lernfortschritt liegt in `localStorage` — gerätegebunden. Zum Gerätewechsel den Export nutzen.

## Eigene Lektionen

Einstellungen → „Lektionspaket importieren", JSON in dieser Form:

```json
{
  "id": "mein-paket",
  "lessons": [
    {
      "id": "custom-1",
      "title": "Meine Lektion",
      "subtitle": "Eigene Wörter",
      "icon": "⭐",
      "tips": ["Optionaler Hinweis"],
      "items": [
        { "es": "el gato", "de": "die Katze" },
        { "es": "el perro", "de": "der Hund", "note": "optional",
          "ex_es": "Mi perro es grande.", "ex_de": "Mein Hund ist groß." }
      ]
    }
  ]
}
```

Karten-IDs werden aus dem spanischen Text abgeleitet, nicht aus der Position. Inhalte lassen
sich also erweitern und umsortieren, ohne den Lernfortschritt zu zerstören.

## Entwicklung

Es gibt keinen Build-Schritt — statische Dateien, ES-Module.

```bash
python3 -m http.server 8000   # dann http://localhost:8000 öffnen
```

Nach Änderungen an den ausgelieferten Dateien die `CACHE`-Version in `sw.js` hochzählen,
damit Geräte die neue Fassung bekommen.

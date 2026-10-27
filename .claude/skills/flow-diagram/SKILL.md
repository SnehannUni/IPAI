---
name: flow-diagram
description: Erzeugt ein animiertes, abstraktes Ablauf-Diagramm (Frontend, Backend, externe Dienste), das zeigt, was passiert und wie alles verbunden ist – auch für Nicht-Programmierer. Verwenden, wenn ein Plan, ein Feature, ein Datenfluss, ein Bug oder ein Bugfix visualisiert oder erklärt werden soll („zeig mir, wie das abläuft“, „stell den Bug dar“, „was passiert, wenn man auf den Button klickt“).
---

# Ablauf-Diagramm erzeugen

Du beschreibst den Ablauf als **Flow-Spec** (JSON). Das Tool `flowviz` prüft sie und baut eine animierte HTML-Seite daraus. Du zeichnest nichts selbst.

## Vorgehen

1. **Lesen:** `docs/REGELN.md` (Pflicht, steuert Abstraktion und Reihenfolge) und `docs/FORMAT.md`. Ein passendes Beispiel als Vorlage nehmen:
   - normaler Ablauf mit Fehlerfall: `examples/chat-rabbitmq.flow.json`
   - Bug und Lösung: `examples/k8s-bugfix.flow.json`
   - zehn echte Postmortems mit Bug und Lösung: `flows/*.flow.json`, z. B.
     - `knight-capital-2012` (Balken als Fortschritt)
     - `cloudflare-leapsecond-2017` (rotes Etikett mit Wert)
     - `github-partition-2018` (zwei Häkchen-Listen)
2. **Planen, bevor du JSON schreibst:**
   - Welche 4–8 Rollen gibt es? Welcher Typ ist jede (Auslöser, Schritt, Speicher, fremder Dienst, Ergebnis)?
   - Raster: In welchem Bereich, in welcher Spalte und Zeile steht sie?
     - Was miteinander redet, gehört in dieselbe Zeile oder Spalte.
     - Besser 4–5 Spalten als 6.
   - Welche Schritte gibt es, jeweils ein bis zwei kurze Sätze in der Reihenfolge Auslöser → Hinweg → Verarbeitung → Rückweg → Ergebnis?
   - Bei Bugs:
     - Ist die Ursache für Laien logisch?
     - Woran sieht man sie im Bild (Häkchen-Liste, Balken, rotes Etikett, doppelte Blase)?
3. **Schreiben:** `flows/<thema>.flow.json`. Alle Texte als `{"simple", "tech"}`. JSON direkt mit dem Edit-Werkzeug ändern, dafür braucht es kein Skript.
4. **Prüfen:** `node bin/flowviz.mjs validate flows/<thema>.flow.json`
   - Fehler immer beheben.
   - Regelhinweise (R1 … R14) beheben. Nur mit Begründung ignorieren, und die Begründung dem Nutzer nennen.
   - **R3 „zu breit“:** Text kürzen. Der Validator rechnet mit der echten Kästchenbreite.
   - **R4/R5** (Pfeil durch Kästchen, Pfeile oder Texte aufeinander): Kästchen umstellen, `route` setzen (`above`, `below`, `h-first`, `v-first`) oder Verben kürzen.
   - **R2** (in einer Ansicht ungenutzt): dem Pfeil oder Kästchen `views` geben.
5. **Bauen:** `node bin/flowviz.mjs build flows/<thema>.flow.json -o out/<thema>.html`
6. **Sichtprüfung**, falls ein Browser-Tool verfügbar ist:
   - Fehlerschritt und Ende beider Ansichten direkt öffnen, z. B. `out/<thema>.html#view=bug&step=7&still`. `&mode=tech` zeigt die technische Fassung.
   - Abgeschnittenes oder Überlappendes in der Spec beheben.
7. **Zeigen:**
   - Gibt es ein Tool zum Anzeigen von HTML (z. B. `show_artifact`), die gebaute Datei damit zeigen.
   - Sonst den Pfad nennen.
   - Dazu in 2–3 Sätzen sagen, was das Diagramm zeigt.

## Wichtig

- Lieber weniger Kästchen und klare Sätze als Vollständigkeit. Der Nutzer soll nicht nachdenken müssen.
- Zustand zeigen statt erklären: `status`, `slots`, `check`, `say`, `meter`/`meterText`, `badge`/`badgeTone`, `state`.
- Ändert der Nutzer etwas, die Spec anpassen und neu bauen. Die HTML-Datei nie von Hand editieren.

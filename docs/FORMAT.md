# Flow-Spec – Format

Eine Flow-Spec ist eine JSON-Datei (`*.flow.json`). `flowviz build` macht daraus eine eigenständige, animierte HTML-Seite.

Vorlagen:
- `examples/chat-rabbitmq.flow.json`: normaler Ablauf mit Fehlerfall
- `examples/k8s-bugfix.flow.json`: Bug und Lösung
- `flows/`: zehn echte Postmortems

**Text** ist überall entweder ein String oder `{"simple": "Alltagssprache", "tech": "Fachbegriffe"}`. Sobald ein Text `tech` hat, zeigt der Viewer den Umschalter Einfach/Technisch. Der Validator prüft immer **beide** Fassungen.

## Oberste Ebene

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `title` | ja | Überschrift |
| `subtitle` | – | eine Zeile darunter (pro Ansicht überschreibbar) |
| `zones` | – | Bereiche von links nach rechts: `[{"id", "label"}]`. Standard: `frontend`, `backend`, `external` |
| `nodes` | ja | Kästchen |
| `edges` | ja | Pfeile |
| `views` | ja | Ansichten mit Schritten (z. B. Normal/Fehlerfall oder Bug/Lösung) |
| `autoplay` | – | `false` = nicht automatisch starten |
| `pause` | – | Pause zwischen Schritten in ms (Standard 1400) |

## nodes

| Feld | Bedeutung |
|---|---|
| `id` | eindeutig, kurz (`queue`, `worker`) |
| `type` | `trigger` · `step` · `store` · `external` · `result` |
| `zone` | id eines Bereichs |
| `col`, `row` | Position im Raster: Spalte innerhalb des Bereichs, Zeile (ab 0) |
| `cols`, `rows` | Breite/Höhe in Rasterzellen (Standard 1). Chatfenster: `"rows": 2` |
| `label`, `sub` | Name und Untertitel (was es *tut*) |
| `widget` | optional: `chat` (Sprechblasen), `checklist` (Häkchen-Liste, braucht `items`), `meter` (Balken) |
| `items` | Punkte der Checkliste (Text, höchstens 5) |
| `meterLabel` | Beschriftung der Balkenzeile, z. B. „Speicher“ → „Speicher: 70 %“ |
| `meterMode` | `risk` (Standard: ab 80 % orange, ab 100 % rot) · `progress` (100 % = Ziel erreicht, grün; darüber rot) |
| `meterMax` | Wert, bei dem der Balken voll ist (Standard 150). Der Grenzstrich steht immer bei 100 % |
| `initial` | Startzustand, gleiche Felder wie ein Zustands-Patch (siehe unten) |
| `views` | nur in diesen Ansichten sichtbar (der Platz bleibt reserviert) |
| `width` | Breite in px (Standard 220, höchstens Spaltenbreite − 96) |

**Größen:** Bei vielen Spalten wird die Bühne breiter (mindestens 280 px pro Spalte), und der Viewer skaliert auf die Fensterbreite. Kästchen sind also meist 184–220 px breit, davon etwa 180 px für Text. Der Validator schätzt alle Texte (Name, Untertitel, Statuszeile, Etikett, Listenpunkte, Balkenzeile) und meldet R3, wenn etwas abgeschnitten würde.

## edges

| Feld | Bedeutung |
|---|---|
| `id` | eindeutig |
| `from`, `to` | Kästchen-ids. `from == to` = Schleife |
| `verb` | kurzes Verb (1–2 Wörter): „fragt“, „legt ab“ |
| `async` | `true` = gestrichelt, läuft nebenher |
| `route` | Führung erzwingen, siehe unten |
| `views` | nur in diesen Ansichten sichtbar |
| `showUnused` | `true` = bleibt sichtbar, auch wenn eine Ansicht ihn nicht benutzt. Gedacht für Fälle, in denen gerade das Fehlen etwas zeigt (z. B. das nie gesendete „erledigt“ im Bug) |

**Führung der Pfeile:**
- **Gleiche Zeile:** waagerecht, Seitenmitte zu Seitenmitte.
- **Gleiche Spalte:** senkrecht.
- **Sonst, Knick (`v-first`, Standard):** erst senkrecht aus dem Start-Kästchen, dann waagerecht in die Seite des Ziels, 28 px über bzw. unter dessen Mitte.
- **`"route": "h-first"`:** erst waagerecht aus der Seite des Starts, dann senkrecht von oben oder unten ins Ziel.
- **`"route": "above"` / `"below"`:** über eine Bahn oberhalb bzw. unterhalb beider Kästchen, z. B. um ein Kästchen dazwischen herum.
- **Mehrere Pfeile zwischen denselben zwei Kästchen** laufen parallel versetzt (±13 px), auch bei `route`.
- **Pfeile verschiedener Absender in dieselbe Seitenmitte** liegen aufeinander. Der Validator meldet das (R4); dann Kästchen umstellen oder `route` setzen.

## views

| Feld | Bedeutung |
|---|---|
| `id`, `label` | Kennung und Beschriftung des Umschalters |
| `kind` | `normal` · `bug` (rot) · `fix` (grün) |
| `headline` | Satz im Kopf. Text vor dem ersten `:` wird fett („Problem: …“) |
| `chain` | Ursachen- bzw. Lösungskette: Liste kurzer Texte. Glieder zählen **ab 0** |
| `mark` | `{"nodes": {"id": "neu"\|"geändert"}, "edges": {…}}` – Unterschiede grün/blau markieren |
| `intro` | Text, der vor dem ersten Schritt in der Erklärung steht |
| `steps` | Schritte, siehe unten. In Meldungen heißen sie „Schritt 1, 2, …“ |

## steps

| Feld | Bedeutung |
|---|---|
| `text` | ein bis zwei kurze Sätze, was passiert |
| `edges` | Pfeile, die nacheinander animiert werden |
| `focus` | Kästchen-id (oder Liste), die hervorgehoben wird; führt das Kästchen auch ein (R10) |
| `packet` | Beschriftung des wandernden Pakets: Text (für alle Pfeile) oder `{"edgeId": Text}` |
| `labels` | `{"edgeId": Text}` – Pfeiltext ab diesem Schritt ändern; `null` setzt auf das normale `verb` zurück |
| `setBefore` | Zustands-Patch vor der Animation |
| `set` | Zustands-Patch nach der Animation (wenn das Paket ankommt) |
| `error` | `true` = Fehlerschritt. Pfeile werden rot; wird ein Pfeil später normal benutzt, ist er wieder grau |
| `tag` | `neu` · `geändert` · `test` · `fehler` (Etikett in der Erklärung) |
| `chain` | Index des Kettenglieds (ab 0), das hier aufleuchtet |

## Zustands-Patch (`initial`, `set`, `setBefore`)

`{"<nodeId>": { … }}` – nur genannte Felder ändern sich:

| Feld | Wirkung |
|---|---|
| `status` | Textzeile unten im Kästchen (`null` löscht) |
| `tone` | Farbe der Statuszeile: `ok` · `bad` · `strong` · `muted` |
| `badge` | kleines Etikett oben rechts („Version 2“). Solange es da ist, zeigt nur der Farbpunkt den Typ |
| `badgeTone` | Farbe des Etiketts: `bad` (rot) · `ok` (grün) · `strong` (schwarz) |
| `state` | `dead` (rot hinterlegt, ausgefallen) · `error` (roter Rand, scheitert diesmal, läuft aber weiter) · `off` (grau, beendet) · `good` (grün umrandet) · `null` |
| `slots` | Anzahl schwarzer Plätze (z. B. wartende Nachrichten); ab 9 wird „+n“ angezeigt |
| `check` | `{"0": "done", "3": "fail"}`: Punkte zählen ab 0. `"reset"` leert die Liste. Zustände: |
|  | `todo` leer · `done` schwarzes ✓ (erledigt) · `ok` grünes ✓ (erledigt dank Lösung) · `fail` rotes ✕ · `skip` durchgestrichen (bewusst übersprungen) |
| `meter` | Zahl in Prozent der Grenze (100 = Grenzstrich) |
| `meterText` | Text statt „70 %“ in der Balkenzeile, z. B. „1.200 Server“ oder „−997 ms“ |
| `say` | Chat-Blase(n) anhängen: `{"from": "user"\|"ai"\|"system", "text", "tone": "bad"\|"ok", "note"}` |
| `clearChat` | `true` leert den Chat |

## Direkt zu einem Schritt springen

`out/datei.html#view=bug&step=6&still&mode=tech` öffnet die Ansicht `bug` mit Zustand nach Schritt 6, ohne Animation (`still`) und im Technik-Modus. Gedacht für die Sichtprüfung und für Screenshots.

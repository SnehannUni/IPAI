# Flow-Spec – Format

Eine Flow-Spec ist eine JSON-Datei (`*.flow.json`). `flowviz build` macht daraus eine eigenständige, animierte HTML-Seite. Vollständige Beispiele: `examples/chat-rabbitmq.flow.json` (normaler Ablauf mit Fehlerfall) und `examples/k8s-bugfix.flow.json` (Bug und Lösung).

**Text** ist überall entweder ein String oder `{"simple": "Alltagssprache", "tech": "Fachbegriffe"}`. Sobald ein Text `tech` hat, zeigt der Viewer den Umschalter Einfach/Technisch.

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
| `widget` | optional: `chat` (Sprechblasen), `checklist` (Häkchen-Liste, braucht `items`), `meter` (Balken mit Grenzstrich bei 100 %) |
| `items` | Punkte der Checkliste (Text) |
| `meterLabel` | Beschriftung des Balkens, z. B. „Speicher“ |
| `initial` | Startzustand, gleiche Felder wie ein Zustands-Patch (siehe unten) |
| `views` | nur in diesen Ansichten sichtbar (Platz bleibt reserviert) |
| `width` | Breite in px (Standard 220) |

## edges

| Feld | Bedeutung |
|---|---|
| `id` | eindeutig |
| `from`, `to` | Kästchen-ids. `from == to` = Schleife |
| `verb` | kurzes Verb (1–2 Wörter): „fragt“, „legt ab“ |
| `async` | `true` = gestrichelt, läuft nebenher |
| `route` | `"above"` / `"below"`: um andere Kästchen herum führen |
| `views` | nur in diesen Ansichten sichtbar |

Die Führung ist automatisch: Kästchen in derselben Zeile werden waagerecht verbunden, in derselben Spalte senkrecht, sonst über einen Knick. Mehrere Pfeile zwischen denselben Kästchen laufen parallel.

## views

| Feld | Bedeutung |
|---|---|
| `id`, `label` | Kennung und Beschriftung des Umschalters |
| `kind` | `normal` · `bug` (rot) · `fix` (grün) |
| `headline` | Satz im Kopf. Text vor dem ersten `:` wird fett („Problem: …“) |
| `chain` | Ursachen- bzw. Lösungskette: Liste kurzer Texte |
| `mark` | `{"nodes": {"id": "neu"\|"geändert"}, "edges": {…}}` – Unterschiede markieren |
| `intro` | Text vor dem ersten Schritt |
| `steps` | Schritte, siehe unten |

## steps

| Feld | Bedeutung |
|---|---|
| `text` | ein Satz, was passiert |
| `edges` | Pfeile, die nacheinander animiert werden |
| `focus` | Kästchen-id (oder Liste), die ohne Pfeil hervorgehoben wird |
| `packet` | Beschriftung des wandernden Pakets: Text (für alle Pfeile) oder `{"edgeId": Text}` |
| `labels` | `{"edgeId": Text}` – Pfeiltext ab diesem Schritt ändern |
| `setBefore` | Zustands-Patch vor der Animation |
| `set` | Zustands-Patch nach der Animation (wenn das Paket ankommt) |
| `error` | `true` = Fehlerschritt (rot) |
| `tag` | `neu` · `geändert` · `test` · `fehler` (Etikett in der Erklärung) |
| `chain` | Index des Kettenglieds, das hier aufleuchtet |

## Zustands-Patch (`initial`, `set`, `setBefore`)

`{"<nodeId>": { … }}` – nur genannte Felder ändern sich:

| Feld | Wirkung |
|---|---|
| `status` | Textzeile unten im Kästchen (`null` löscht) |
| `tone` | Farbe der Statuszeile: `ok` · `bad` · `strong` · `muted` |
| `badge` | kleines Etikett oben rechts („Version 2“) |
| `state` | `dead` (rot, ausgefallen) · `off` (grau, beendet) · `good` (grün umrandet) · `null` |
| `slots` | Anzahl schwarzer Plätze (z. B. wartende Nachrichten) |
| `check` | `{"0": "done", "3": "fail"}` – Zustände `todo` · `done` · `fail` · `ok`. `"reset"` leert die Liste |
| `meter` | Prozentwert für den Balken (über 100 = rot) |
| `say` | Chat-Blase(n) anhängen: `{"from": "user"\|"ai", "text", "tone": "bad"\|"ok", "note"}` |
| `clearChat` | `true` leert den Chat |

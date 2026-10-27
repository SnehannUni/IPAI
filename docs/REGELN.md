# Regeln für Ablauf-Diagramme

Diese Regeln gelten für jede Flow-Spec, die ein LLM erzeugt. Ziel: **Jemand, der nicht programmieren kann, versteht den Ablauf ohne langes Nachdenken.** Die Kennungen (R1 …) tauchen in den Meldungen von `flowviz validate` auf.

## 1. Bausteine

Es gibt genau **5 Kästchen-Typen**:

| Typ | Bedeutung | Beispiele |
|---|---|---|
| `trigger` – Auslöser | Hier fängt etwas an | Button, Nutzer, Cron-Job, Webhook |
| `step` – Schritt | Hier wird etwas getan oder entschieden | API, Worker, Funktion, Kubernetes |
| `store` – Speicher | Hier wird etwas gemerkt oder nachgeschaut | Datenbank, Queue, Cache, Datei |
| `external` – Fremder Dienst | Jemand anderes erledigt es | Claude, Stripe, E-Mail-Versand |
| `result` – Ergebnis | Das kommt am Ende heraus | Antwort im Chat, PDF, E-Mail |

Die Kästchen liegen in **Bereichen** (Standard: Frontend │ Backend │ Extern). **Pfeile** tragen immer ein Verb:
- durchgezogen = wartet auf Antwort (synchron)
- gestrichelt (`"async": true`) = läuft nebenher
- rot = Fehlerweg (Schritt mit `"error": true`)
- grün = neu, blau = geändert (`mark` in der Lösungs-Ansicht)

## 2. Abstraktion

- **R1** Höchstens **8 Kästchen** pro Ansicht. Mehr Komponenten werden zu einer Rolle zusammengefasst, z. B. „Antwort-Queue + WebSocket-Gateway“ wird zu „Zusteller“.
- **R2** Jedes Kästchen und jeder Pfeil kommt in mindestens einem Schritt vor. Was nichts tut, fliegt raus.
- **R3** Kurze Namen: `label` höchstens 22 Zeichen, `sub` höchstens 30. Eine `checklist` hat höchstens 5 Punkte.
- **R6** Alle Texte gibt es in zwei Fassungen: `{"simple": "…", "tech": "…"}`.
  - `simple` ist Alltagssprache ohne Fachwörter (Empfang, Warteliste, Bearbeiter, Archiv, Zusteller).
  - `tech` enthält die echten Begriffe (REST-API, RabbitMQ, Worker-Pod, PostgreSQL, WebSocket).
- Ein Kästchen ist eine **Rolle**, kein Technik-Detail. Der Untertitel sagt, was es tut („merkt sich offene Fragen“), nicht was es ist.

## 3. Layout

- **R4** Leserichtung: Der Auslöser steht links, fremde Dienste stehen rechts. Der Hinweg läuft von links nach rechts.
  - Was miteinander redet, steht nebeneinander (gleiche Zeile) oder übereinander (gleiche Spalte).
  - Höchstens 6 Spalten insgesamt.
  - Kein Pfeil läuft durch ein fremdes Kästchen. Wenn es nicht anders geht: `"route": "above"` oder `"below"`.
- **R5** Verben sind kurz (1–2 Wörter), Beschriftungen überlappen sich nicht.
- Hin und zurück zwischen denselben zwei Kästchen sind zwei Pfeile. Sie werden automatisch parallel versetzt.
- Ein Chatfenster bekommt `"widget": "chat"` und `"rows": 2`.

## 4. Ablauf: wann was kommt

**R7** Pro Schritt **ein Satz**, höchstens 25 Wörter. Subjekt ist das handelnde Kästchen („Der Bearbeiter fragt Claude.“).
**R8** Pro Schritt höchstens 4 Pfeile, die eine zusammenhängende Kette bilden: Anfrage und Antwort oder eine kurze Weitergabe.

Reihenfolge eines Ablaufs:

1. **Ausgangslage** (optional). Was schon da ist, z. B. „2.000 Nachrichten im Archiv“, per `initial` oder einem ersten Schritt.
2. **R9 Auslöser.** Der erste Schritt beginnt bei einem `trigger`.
3. **Hinweg.** Die Anfrage wandert Kästchen für Kästchen. Jeder Pfeil gehört zu genau einem Schritt.
4. **Verarbeitung.** Eine synchrone Anfrage und ihre Antwort stehen im **selben** oder im direkt **folgenden** Schritt.
5. **Speichern / Weitergeben.** Asynchrone Pfeile zeigen, dass der Absender nicht wartet. Falls wichtig, folgt danach eine Bestätigung.
6. **Rückweg.** Die Antwort kommt zum Nutzer zurück.
7. **R9 Ergebnis.** Der letzte Schritt endet beim Nutzer oder Ergebnis, z. B. `"focus": "result"`.

Weitere Regeln:

- **R10 Keine Sprünge.** Ein Kästchen handelt erst, nachdem es vorgekommen ist. Wer „von sich aus“ handelt (Kubernetes startet ein Update, ein Cron-Job feuert), bekommt vorher einen eigenen Schritt mit `focus`.
- **Zustand ändert sich, wenn das Paket ankommt** (`set`). Nur was *vor* der Bewegung gilt (z. B. ein neu gestarteter Bearbeiter), kommt in `setBefore`.
- **Sichtbarer Zustand statt Erklärtext.** Zähler, Warteschlangen-Plätze, Häkchen-Listen, Chat-Blasen und Speicherbalken zeigen, was passiert. Der Satz erklärt nur das *Warum*.

## 5. Bugs darstellen

Ein Bug bekommt **zwei Ansichten**: `"kind": "bug"` und `"kind": "fix"`.

- **R11** Die Bug-Ansicht hat eine `headline` im Muster „Problem: … Warum?“ und mindestens einen Schritt mit `"error": true`.
- **R12** Die **Ursachenkette** (`chain`) hat 2–5 kurze Glieder, von der Ursache bis zum Symptom.
  - Jedes Glied wird von einem Schritt ausgelöst (`"chain": n`), in aufsteigender Reihenfolge.
  - Das letzte Glied ist das Symptom, das der Nutzer sieht.
- **Die Ursache muss im Bild sichtbar sein.** Beispiele:
  - eine Häkchen-Liste, bei der der letzte Punkt rot bleibt
  - ein Speicherbalken über dem Grenzstrich
  - eine doppelte Chat-Blase
- **Die Ursache muss für Laien logisch sein.** Keine konstruierten Erklärungen. Lieber ein typischer, echter Auslöser (Update, Timeout, Überlastung, Doppelklick) als ein technisch korrektes, aber unverständliches Detail.
- Aufbau der Bug-Ansicht: Normalablauf bis kurz vor den Fehler → auslösendes Ereignis (`focus`) → Fehler (`error`) → Folgen → Symptom beim Nutzer.

## 6. Lösungen darstellen

- **R13** Die Lösung zeigt **dasselbe Szenario**: gleicher Start, gleiche ersten Schritte.
  - Geänderte Schritte bekommen `"tag": "geändert"`, neue `"tag": "neu"`.
  - Neue oder geänderte Pfeile und Kästchen werden über `mark` grün bzw. blau markiert.
- Gibt es eine eigene `chain`, zeigt sie die Lösung in denselben Etappen wie der Bug, z. B. „Update kommt → macht erst fertig → ‚erledigt‘ gemeldet → nur eine Antwort“.
- Wenn der Fehler grundsätzlich weiter passieren kann, gibt es einen **Härtetest** (`"tag": "test"`), der zeigt, dass er keinen Schaden mehr anrichtet.
- **R14** Die Lösung endet ohne Fehler: letzter Schritt `focus` auf Nutzer oder Ergebnis, mit `"state": "good"`.

## 7. Checkliste vor der Ausgabe

1. `flowviz validate datei.flow.json` meldet 0 Fehler und 0 Regelhinweise. Bewusste Ausnahmen werden begründet.
2. Ein Laie könnte jeden Schritt in einem Satz nacherzählen.
3. Im Bug ist ohne Text erkennbar, *wo* es schiefgeht.
4. Die Lösung beginnt genauso wie der Bug, und die Unterschiede sind farbig markiert.

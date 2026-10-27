# CLAUDE.md

Dieses Repo enthält **flowviz**: Ein LLM beschreibt einen Ablauf als JSON (Flow-Spec), das Tool prüft ihn und baut eine animierte, für Laien verständliche HTML-Darstellung.

## Wenn ein Ablauf, Plan, Datenfluss oder Bug dargestellt werden soll

Den Skill `flow-diagram` benutzen (`.claude/skills/flow-diagram/SKILL.md`). Kurzfassung:
1. `docs/REGELN.md` und `docs/FORMAT.md` lesen, passendes Beispiel aus `examples/` als Vorlage nehmen.
2. Spec nach `flows/<thema>.flow.json` schreiben.
3. `node bin/flowviz.mjs validate flows/<thema>.flow.json`, bis 0 Fehler und 0 Regelhinweise gemeldet werden.
4. `node bin/flowviz.mjs build flows/<thema>.flow.json -o out/<thema>.html` und das Ergebnis zeigen.

## Befehle

- `npm test`: Validator- und Build-Tests (`node --test`)
- `npm run validate`: alle Beispiele prüfen
- `npm run build:examples`: Beispiele nach `out/` bauen

## Konventionen

- Keine npm-Abhängigkeiten. Der Viewer ist eine einzige HTML-Datei ohne externe Ressourcen.
- Design: weiß und schlicht, fast monochrom. Farbe nur als Signal: Typ-Punkte, rot = Fehler, grün = neu, blau = geändert. Kein Glow, keine Emojis.
- Texte sind deutsch. Jeder Text gibt es als `{simple, tech}`.
- Neue Regeln: in `docs/REGELN.md` beschreiben, in `src/validate.mjs` mit derselben Kennung prüfen und in `test/` absichern.
- `src/layout.mjs` wird beim Build in den Viewer eingesetzt (`export` wird entfernt). Dort nur browser-taugliches JavaScript ohne Imports.

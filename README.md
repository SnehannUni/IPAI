# IPAI – flowviz

Animierte, abstrakte Ablauf-Diagramme, die zeigen, **was wie passiert und wie alles verbunden ist**: vom Klick auf einen Button über Warteschlangen, Datenbanken und externe Dienste bis zur Antwort. Die Darstellung ist für Menschen gedacht, die nicht programmieren, und wird von einem LLM erzeugt.

```
LLM schreibt  flows/thema.flow.json   →   flowviz validate   →   flowviz build   →   animierte HTML-Seite
              (Kästchen, Pfeile,           (Fehler + Regeln)      (eine Datei,
               Schritte, Zustände)                                 offline lauffähig)
```

## Schnellstart

```bash
node bin/flowviz.mjs validate examples/*.flow.json
node bin/flowviz.mjs build examples/k8s-bugfix.flow.json -o out/k8s-bugfix.html
npm test
```

Keine Abhängigkeiten, nur Node ≥ 20.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `docs/REGELN.md` | **Regeln** für Abstraktion, Layout und Reihenfolge der Schritte (R1–R14), plus Bug/Lösung-Darstellung |
| `docs/FORMAT.md` | Referenz des JSON-Formats (Flow-Spec) |
| `src/viewer.html` | Viewer-Vorlage (Design, Animation, Einfach/Technisch, Ansichten) |
| `src/layout.mjs` | Raster-Layout und automatische Pfeilführung (vom Viewer und vom Validator genutzt) |
| `src/validate.mjs` | Prüft Specs auf Fehler und Regelverstöße, auch Pfeile durch Kästchen und überlappende Texte |
| `src/build.mjs`, `bin/flowviz.mjs` | Baut eine eigenständige HTML-Datei, Kommandozeile |
| `examples/` | Vorlagen: normaler Ablauf mit Fehlerfall, Bug + Lösung |
| `.claude/skills/flow-diagram/` | Skill, mit dem Claude Code Diagramme selbstständig erzeugt |
| `flows/` | Erzeugte Specs, darunter 10 echte Postmortems (Cloudflare, CrowdStrike, GitHub, Facebook, Roblox, Slack, Knight Capital, Sentry), die von Agenten ohne Vorwissen erstellt wurden und als Regressionstest dienen |
| `test/` | Validator- und Build-Tests sowie ein Durchlauf des Viewers für jeden Schritt jeder Spec |
| `prototypes/` | Die ersten handgebauten Entwürfe |

## Bausteine in einem Satz

5 Kästchen-Typen (Auslöser, Schritt, Speicher, fremder Dienst, Ergebnis) in Bereichen (Frontend │ Backend │ Extern), verbunden durch Pfeile mit Verben. Durchgezogen heißt „wartet“, gestrichelt „läuft nebenher“, rot „Fehler“, grün/blau „neu/geändert“. Jeder Schritt ist ein Satz, und der Zustand ist im Kästchen sichtbar (Häkchen-Liste, Chat-Blasen, Warteplätze, Balken).

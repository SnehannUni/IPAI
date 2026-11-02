# CLAUDE.md

This repo is **IPAI – Interpretable Planning for AI**. It contains **flowviz**: an LLM describes a flow as JSON (flow spec), the tool checks it and builds an animated HTML diagram that laypeople can understand.

## When a flow, plan, data flow or bug should be visualized

Use the `flow-diagram` skill (`.claude/skills/flow-diagram/SKILL.md`). In short:
1. Read `docs/RULES.md` and `docs/FORMAT.md`, take a matching example from `examples/` or `flows/` as a template.
2. Write the spec to `flows/<topic>.flow.json`.
3. Run `node bin/flowviz.mjs validate flows/<topic>.flow.json` until it reports 0 errors and 0 rule hints.
4. Run `node bin/flowviz.mjs build flows/<topic>.flow.json -o out/<topic>.html` and show the result.

## Commands

- `npm test`: validator, build and viewer tests (`node --test`)
- `npm run validate`: check all examples
- `npm run build:examples`: build the examples into `out/`

## Conventions

- No npm dependencies. The viewer is a single HTML file without external resources.
- Design: white and plain. Red = error, green = new, blue = changed stay reserved for those signals. Other colour is welcome where it carries meaning: a zone or box in its product's colour (`color`), and a demo in the product's own look. No glow, no emojis.
- The viewer names no colour itself: every colour is a theme variable (`src/theme.mjs`, FORMAT.md "theme"), so the app that shows a diagram sets its look once. A test fails on a hex value outside the defaults.
- Spec texts are in the language of the people who read the diagram; `lang` switches the viewer's own words (`en`, `de`). Every text exists as `{simple, tech}`. Code, docs and the viewer's source stay in English.
- New rules: describe them in `docs/RULES.md`, check them in `src/validate.mjs` with the same ID and cover them in `test/`.
- `src/layout.mjs` is inlined into the viewer at build time (`export` is stripped). Only browser-compatible JavaScript without imports there.

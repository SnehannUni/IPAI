# CLAUDE.md

This repo contains **flowviz**: an LLM describes a flow as JSON (flow spec), the tool checks it and builds an animated HTML diagram that laypeople can understand.

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
- Design: white and plain, nearly monochrome. Colour only as a signal: type dots, red = error, green = new, blue = changed. No glow, no emojis.
- All texts are in English. Every text exists as `{simple, tech}`.
- New rules: describe them in `docs/RULES.md`, check them in `src/validate.mjs` with the same ID and cover them in `test/`.
- `src/layout.mjs` is inlined into the viewer at build time (`export` is stripped). Only browser-compatible JavaScript without imports there.

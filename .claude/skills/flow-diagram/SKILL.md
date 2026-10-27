---
name: flow-diagram
description: Generates an animated, abstract flow diagram (frontend, backend, external services) that shows what happens and how everything is connected – also for non-programmers. Use it when a plan, a feature, a data flow, a bug or a bug fix should be visualized or explained ("show me how this works", "visualize the bug", "what happens when you click the button").
---

# Generate a flow diagram

You describe the flow as a **flow spec** (JSON). The `flowviz` tool checks it and builds an animated HTML page from it. You do not draw anything yourself.

## Procedure

1. **Read** `docs/RULES.md` (mandatory, it governs abstraction and order) and `docs/FORMAT.md`. Take a matching example as a template:
   - normal flow with a failure case: `examples/chat-rabbitmq.flow.json`
   - bug and fix: `examples/k8s-bugfix.flow.json`
   - ten real postmortems with bug and fix in `flows/*.flow.json`, e.g.
     - `knight-capital-2012` (meter as progress)
     - `cloudflare-leapsecond-2017` (red badge with a value)
     - `github-partition-2018` (two checklists)
2. **Plan before writing JSON:**
   - Which 4–8 roles exist? Which type is each (trigger, step, storage, external service, result, screen)?
   - Grid: in which zone, column and row does each sit?
     - Whatever talks to each other belongs in the same row or column.
     - Prefer 4–5 columns over 6.
   - Which steps are there? One or two short sentences each, in the order trigger → way there → processing → way back → result.
   - Does mainly the UI change? Then start with a before/after view (`kind: "compare"`) with `screen` boxes and a concrete person, technology afterwards (RULES.md R16).
   - For bugs:
     - Does the cause make sense to laypeople?
     - Where can you see it in the picture (checklist, meter, red badge, duplicated bubble)?
3. **Write** `flows/<topic>.flow.json`.
   - Every bug/fix/compare view gets an `explain` (2–4 paragraphs), every important step a `detail` (why, and what follows) – see RULES.md R15.
   - Feature plans: "Today" as `bug`, "Planned" as `fix`.
   - All texts as `{"simple", "tech"}`, in English.
   - Edit the JSON directly with the edit tool; no script is needed.
4. **Check** with `node bin/flowviz.mjs validate flows/<topic>.flow.json`.
   - Always fix errors.
   - Fix rule hints (R1 … R16). Only ignore one with a reason, and tell the user the reason.
   - **R3 "too wide":** shorten the text. The validator uses the real box width.
   - **R4/R5** (arrow through a box, arrows or labels on top of each other): rearrange the boxes, set `route` (`above`, `below`, `h-first`, `v-first`) or shorten verbs.
   - **R2** (unused in a view): give the arrow or box `views`.
5. **Build** with `node bin/flowviz.mjs build flows/<topic>.flow.json -o out/<topic>.html`.
6. **Visual check**, if a browser tool is available:
   - Open the error step and the end of both views directly, e.g. `out/<topic>.html#view=bug&step=7&still`. `&mode=tech` shows the technical variant.
   - Fix anything cut off or overlapping in the spec.
7. **Show** the result:
   - If there is a tool for displaying HTML (e.g. `show_artifact`), show the built file with it.
   - Otherwise give the path.
   - Add 2–3 sentences on what the diagram shows.

## Important

- Fewer boxes and clear sentences beat completeness. The user should not have to think hard.
- Show state instead of explaining it: `status`, `slots`, `check`, `say`, `meter`/`meterText`, `badge`/`badgeTone`, `state`, `menu`.
- When the user wants changes, edit the spec and rebuild. Never edit the HTML file by hand.

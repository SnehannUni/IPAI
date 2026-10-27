# Rules for flow diagrams

These rules apply to every flow spec an LLM generates. Goal: **someone who cannot program understands the flow without thinking hard.** The IDs (R1 …) show up in the messages of `flowviz validate`.

## 1. Building blocks

There are **6 box types**:

| Type | Meaning | Examples |
|---|---|---|
| `trigger` | Something starts here | Button, user, cron job, webhook |
| `step` | Something is done or decided here | API, worker, function, Kubernetes |
| `store` | Something is remembered or looked up here | Database, queue, cache, file |
| `external` | Someone else does it | Claude, Stripe, e-mail delivery |
| `result` | This is what comes out | Answer in the chat, PDF, e-mail |
| `screen` | What the user sees | A menu, a form, a page (for UI features, see R16) |

Boxes sit in **zones** (default: Frontend │ Backend │ External). **Arrows** always carry a verb:
- solid = waits for an answer (synchronous)
- dashed (`"async": true`) = runs alongside
- red = error path (step with `"error": true`)
- green = new, blue = changed (`mark` in the solution view)

## 2. Abstraction

- **R1** At most **8 boxes** per view. Merge more components into one role, e.g. "response queue + WebSocket gateway" becomes "Courier".
- **R2** Every visible box and every visible arrow appears in at least one step **in every view**.
  - Whatever does nothing in a view is hidden there with `views`.
  - Exception: `"showUnused": true`, when the absence itself shows something, e.g. the "done" message that is never sent.
- **R3** Everything must fit into the box.
  - The validator estimates the width of name, subtitle, status line, badge, list items, menu items and meter line, and reports whatever would be cut off.
  - Rule of thumb: name ≤ 20, subtitle ≤ 28, status/badge ≤ 20 characters.
  - A `checklist` has at most 5 items.
- **R6** Every text exists in two variants: `{"simple": "…", "tech": "…"}`.
  - `simple` is everyday language without jargon (front desk, waiting list, worker, archive, courier).
  - `tech` uses the real terms (REST API, RabbitMQ, worker pod, PostgreSQL, WebSocket).
- A box is a **role**, not a technical detail. The subtitle says what it does ("remembers open questions"), not what it is.

## 3. Layout

- **R4** Reading direction: the trigger is on the left, the way there runs from left to right.
  - External services sit at the right edge. Exception: they lie *on the way* (internet, CDN, network gateway); then they sit where the path passes through them.
  - Whatever talks to each other sits side by side (same row) or stacked (same column). Kinks are the exception.
  - At most 6 columns per view, better 4–5.
  - No arrow runs through another box, and no two arrows lie on top of each other. If there is no other way, set `route` (`above`, `below`, `h-first`, `v-first`, see FORMAT.md).
- **R5** Verbs are short (1–2 words). Labels do not overlap and do not sit on other arrows.
- There and back between the same two boxes are two arrows. They are offset in parallel automatically.
- A chat window gets `"widget": "chat"` and `"rows": 2`.

## 4. Flow: what comes when

**R7** Each step has **one or two short sentences**, at most 25 words, in both variants. The subject is the acting box ("The worker asks Claude."). Numbers and abbreviations ("$460M", "e.g.") do not count as sentence ends.

**R8** At most 4 arrows per step, forming one connected chain: request and answer, or a short hand-over.

Order of a flow:

1. **Starting point** (optional): what already exists, e.g. "2,000 messages in the archive", via `initial` or a first step.
2. **R9 Trigger:** the first step starts at a `trigger`.
3. **Way there:** the request travels box by box. Every arrow belongs to exactly one step.
4. **Processing:** a synchronous request and its answer are in the **same** or the directly **following** step.
5. **Storing / passing on:** asynchronous arrows show that the sender does not wait. If it matters, a confirmation follows.
6. **Way back:** the answer returns to the user.
7. **R9 Result:** the last step ends at the user or the result, e.g. `"focus": "result"`.

More rules:

- **R10 No jumps.** A box only acts after it has appeared.
  - Whoever acts "on its own" (Kubernetes starts an update, a cron job fires) is introduced with `focus`, either in its own step or in the same step as its first arrow.
  - A store that "delivers" is asked first (arrow towards it), or the reader fetches actively (arrow from the reader with the verb "fetches").
  - Triggers may act at any time. A **second trigger in the middle of the flow** is allowed, e.g. a technician typing a command.
- **Event during a request** (update, leap second, outage): split the request. First the way there, then the event as its own step (`focus`), then the consequences.
- **State changes when the packet arrives** (`set`). Only what applies *before* the movement (e.g. a freshly restarted worker) goes into `setBefore`.
- **Visible state instead of explanatory text.** Counters, queue slots, checklists, chat bubbles and meters show what happens. The sentence only explains the *why*.

## 4b. Explaining (R15)

The picture shows *what* happens; the texts must explain *why* and *what it means*. Short does not mean terse.

- **`explain` per view** (required for `bug`, `fix` and `compare`): 2–4 short paragraphs, at most 70 words each.
  - **Problem:** Who is affected? What are they trying to do? What goes wrong today, and why? A quote from user feedback, if available (paragraph starting with `>`).
  - **Solution / plan:** What changes for the user? How does it work at its core? What stays the same? What is still open?
- **`detail` per step** (required for key steps with `chain`, `error` or `tag`, recommended otherwise): 1–3 sentences, at most 55 words.
  - `text` says *what* happens.
  - `detail` says *why* and *what follows from it*.
- In `simple`, avoid every technical term or explain it on first use ("data pool, a kind of shared folder"). In `tech`, use the real names from the code and the plan.
- **Feature plans** are shown like bugs: `kind: "bug"` = "Today" (problem statement), `kind: "fix"` = "Planned" (proposed solution). Acceptance criteria that do not fit into the flow go into `explain` or into a short view of their own.

## 4c. UI features (R16)

If mainly **what you see** changes (menu, form, page), show the screen first, not the technology.

- **First view `kind: "compare"`:** two zones "Today" (`tone: "bug"`) and "Planned" (`tone: "fix"`) side by side, each with a `screen` box (e.g. `widget: "menu"`) and what it leads to. Every step shows the same moment on both sides.
- **A concrete person with a goal** in the `headline` ("Anna only works in ReKo …"). Differences as numbers in the badge ("2 clicks, scrolling" vs. "1 click").
- **Real labels** (menu items, buttons), no invented role names. Show clicks with `cursor` and the result with `active`.
- **Technology afterwards**, in views of their own (`kind: "normal"`, label "Tech"). The other rules apply there.
- 4–6 steps per comparison; only moments you can see on the screen.

## 5. Presenting bugs

A bug gets **two views**: `"kind": "bug"` and `"kind": "fix"`.

- **R11** The bug view has a `headline` following the pattern "Problem: … Why?" and at least one step with `"error": true`.
- **R12** The **cause chain** (`chain`) has 2–5 short links, from cause to symptom. Two simultaneous causes are combined into one link ("streaming + full freelist").
  - Every link is triggered by a step (`"chain": n`), in ascending order.
  - The last link is the symptom the user sees.
- **The cause must be visible in the picture.** Examples:
  - a checklist whose last item stays red
  - a meter above the limit line (choose `meterMode`: `risk` for load, `progress` for goals)
  - a red badge with the decisive value (`badge` + `badgeTone: "bad"`, e.g. "−997 ms")
  - a duplicated chat bubble
- **The cause must make sense to laypeople.** No contrived explanations. Prefer a typical, real trigger (update, timeout, overload, double click) over a technically correct but incomprehensible detail.
- Structure of the bug view: normal flow until just before the error → triggering event (`focus`) → error (`error`) → consequences → symptom for the user.

## 6. Presenting solutions

- **R13** The solution shows **the same scenario**: same start, same first steps.
  - Changed steps get `"tag": "changed"`, new ones `"tag": "new"`.
  - New or changed arrows and boxes are marked green or blue via `mark`.
- If it has its own `chain`, it shows the solution in the same stages as the bug, e.g. "update arrives → finishes first → 'done' reported → only one answer".
- **Hard test:** if the trigger of the error can still happen (update, outage, load spike), repeat it in the solution at **the same point as in the bug** and tag it `"tag": "test"`. Then you can see that it no longer causes damage.
- **R14** The solution ends without an error: last step `focus` on the user or result, with `"state": "good"`.

## 7. Checklist before output

1. `flowviz validate file.flow.json` reports 0 errors and 0 rule hints. Deliberate exceptions are justified.
2. **Visual check:** if a browser tool is available, look at the key states, e.g. `out/file.html#view=bug&step=6&still`: the error step and the end of both views. The validator only estimates space and lines.
3. A layperson could retell every step in one sentence.
4. In the bug view you can see *where* it goes wrong without reading.
5. The solution starts exactly like the bug, and the differences are colour-marked.

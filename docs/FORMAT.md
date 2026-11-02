# Flow spec – format

A flow spec is a JSON file (`*.flow.json`). `flowviz build` turns it into a self-contained, animated HTML page.

Templates:
- `examples/chat-rabbitmq.flow.json`: normal flow with a failure case
- `examples/k8s-bugfix.flow.json`: bug and solution
- `examples/sidebar-demo.flow.json`: a clickable demo of the screen as the diagram's frontend, in German
- `examples/chat-demo.flow.json`: a chat on a phone: streaming through queue, worker and an external service, stop, retry
- `examples/signup-demo.flow.json`: a form whose error lands at its field, the same button clicked twice
- `flows/`: ten real postmortems

**Text** is everywhere either a string or `{"simple": "everyday language", "tech": "technical terms"}`. As soon as a text has `tech`, the viewer shows the Simple/Technical switch. The validator always checks **both** variants. Write in the language of the people who read it; `lang` switches the viewer's own words.

## Top level

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Heading |
| `subtitle` | – | One line below it (can be overridden per view) |
| `lang` | – | Language of the viewer's own words (buttons, step counter, legend, default zones): `en` (default) · `de` |
| `zones` | – | Zones from left to right: `[{"id", "label", "tone", "color"}]`. Default: `frontend`, `backend`, `external`. `tone: "bug"` / `"fix"` tints the zone red/green (for before/after); `color` (any CSS colour) tints it lightly and colours its caption |
| `nodes` | yes | Boxes |
| `edges` | yes | Arrows |
| `views` | yes | Views with steps (e.g. normal/failure or bug/fix) |
| `demo` | – | A clickable mock of the screen beside the diagram, see [demo](#demo) |
| `autoplay` | – | `false` = do not start automatically. A view whose demo waits for a click never starts on its own |
| `pause` | – | Pause between steps in ms (default 1400) |

## nodes

| Field | Meaning |
|---|---|
| `id` | unique, short (`queue`, `worker`) |
| `type` | `trigger` · `step` · `store` · `external` · `result` · `screen` (what the user sees, e.g. a menu) |
| `zone` | id of a zone |
| `col`, `row` | grid position: column within the zone, row (from 0) |
| `cols`, `rows` | width/height in grid cells (default 1). Chat window: `"rows": 2` |
| `label`, `sub` | name and subtitle (what it *does*) |
| `widget` | optional: `chat` (speech bubbles), `checklist` (needs `items`), `meter` (bar), `menu` (simplified sidebar/menu, content via the `menu` state) |
| `items` | checklist items (text, at most 5) |
| `meterLabel` | label of the meter line, e.g. "Memory" → "Memory: 70 %" |
| `meterMode` | `risk` (default: orange from 80 %, red from 100 %) · `progress` (100 % = goal reached, green; red above) |
| `meterMax` | value at which the bar is full (default 150). The limit line is always at 100 % |
| `initial` | initial state, same fields as a state patch (see below) |
| `views` | only visible in these views. Zones without a visible box are dropped in that view; inside a zone the space stays reserved (same positions in "Today" and "Planned") |
| `width` | width in px (default 220, at most column width − 96) |
| `color` | any CSS colour: replaces the type colour of the dot and draws a coloured top edge, e.g. to tie a box to its colour in the demo |

**Sizes:** with many columns the stage gets wider (at least 280 px per column) and the viewer scales it to the available width. Boxes are therefore usually 184–220 px wide, about 180 px of that for text. The validator estimates all texts (name, subtitle, status line, badge, list items, menu items, meter line) and reports R3 when something would be cut off.

## edges

| Field | Meaning |
|---|---|
| `id` | unique |
| `from`, `to` | box ids, or `"@id"` for an element of the [demo](#demo). `from == to` = loop |
| `verb` | short verb (1–2 words): "asks", "queues" |
| `async` | `true` = dashed, runs alongside |
| `route` | force a routing, see below |
| `views` | only visible in these views |
| `showUnused` | `true` = stays visible even when a view does not use it. Meant for cases where the absence shows something (e.g. the "done" message never sent in the bug) |

**Arrow routing:**
- **Same row:** horizontal, side centre to side centre.
- **Same column:** vertical.
- **Otherwise, kink (`v-first`, default):** first vertical out of the start box, then horizontal into the side of the target, 28 px above or below its centre.
- **`"route": "h-first"`:** first horizontal out of the side of the start, then vertical into the target from above or below.
- **`"route": "above"` / `"below"`:** via a lane above or below both boxes, e.g. around a box in between.
- **Several arrows between the same two boxes** run in parallel with an offset (±13 px), also with `route`.
- **Arrows from different senders into the same side centre** lie on top of each other. The validator reports this (R4); rearrange the boxes or set `route`.

## views

| Field | Meaning |
|---|---|
| `id`, `label` | identifier and label of the view switch |
| `kind` | `normal` · `bug` (red) · `fix` (green) · `compare` (before/after side by side: two zones with `tone`, every step changes both sides) |
| `headline` | sentence at the top. Text before the first `:` is bold ("Problem: …") |
| `chain` | cause or solution chain: list of short texts. Links count **from 0** |
| `mark` | `{"nodes": {"id": "new"\|"changed"}, "edges": {…}}` – mark differences green/blue |
| `explain` | explanation of the view: list of 2–4 short paragraphs (text). A paragraph starting with `>` is shown as a quote (e.g. user feedback). Shown collapsible below the headline |
| `explainLabel` | label of the collapsible (default: "What is this about? The problem explained" or "What changes? The solution explained") |
| `intro`, `introDetail` | sentence and explanation shown in the card before the first step |
| `steps` | steps, see below. In messages they are called "step 1, 2, …" |

## steps

| Field | Meaning |
|---|---|
| `text` | one or two short sentences: **what** happens (large in the card) |
| `detail` | one to three sentences: **why** it happens and what it means for the user (smaller below, at most 55 words) |
| `edges` | arrows animated one after another |
| `focus` | box id (or list) that is highlighted; also introduces the box (R10) |
| `packet` | label of the travelling packet: text (for all arrows) or `{"edgeId": text}` |
| `labels` | `{"edgeId": text}` – change an arrow label from this step on; `null` resets it to the normal `verb` |
| `setBefore` | state patch before the animation |
| `set` | state patch after the animation (when the packet arrives) |
| `error` | `true` = error step. Arrows turn red; if an arrow is used normally later, it is grey again |
| `tag` | `new` · `changed` · `test` · `error` (badge in the explanation card) |
| `chain` | index of the chain link (from 0) that lights up here |
| `on` | the `data-ipai` id in the demo whose click starts this step; it and the following steps up to the next `on` play as one part. The same id can start several parts (a button that fails, then works): a click plays the next one from where the flow stands |
| `demo` | the demo's state from this step on, e.g. `"collapsed saving"` (`""` = none). Lands with the packet; on a step with `on` at once |

## State patch (`initial`, `set`, `setBefore`)

`{"<nodeId>": { … }}` – only the given fields change:

| Field | Effect |
|---|---|
| `status` | text line at the bottom of the box (`null` clears it) |
| `tone` | colour of the status line: `ok` · `bad` · `strong` · `muted` |
| `badge` | small badge at the top right ("Version 2"). While it is shown, only the colour dot shows the type |
| `badgeTone` | colour of the badge: `bad` (red) · `ok` (green) · `strong` (black) |
| `state` | `dead` (red background, failed) · `error` (red border, fails this time but keeps running) · `off` (grey, finished) · `good` (green outline) · `null` |
| `slots` | number of black slots (e.g. waiting messages); from 9 on "+n" is shown |
| `check` | `{"0": "done", "3": "fail"}`: items count from 0. `"reset"` clears the list. States: |
|  | `todo` empty · `done` black ✓ (done) · `ok` green ✓ (done thanks to the fix) · `fail` red ✕ · `skip` struck through (deliberately skipped) |
| `meter` | number in percent of the limit (100 = limit line) |
| `meterText` | text instead of "70 %" in the meter line, e.g. "1,200 servers" or "−997 ms" |
| `say` | append chat bubble(s): `{"from": "user"\|"ai"\|"system", "text", "tone": "bad"\|"ok", "note"}` |
| `clearChat` | `true` clears the chat |
| `menu` | content of a `menu` box (replaces the previous one): `{"level", "dir", "scroll", "items"}`. When `level` changes, the menu slides in (`dir: "in"` from the right, `"out"` from the left). `scroll: true` shows "scroll for more" |

**Menu items** (`menu.items`): text or `{"text", "kind", "active", "cursor", "tone", "note"}`.
- `kind`: `link` (default) · `group` (closed, ▸) · `open` (expanded, ▾) · `child` (indented) · `app` (opens its own menu, ›) · `back` (← back row)
- `active`: highlighted (you are here) · `cursor`: blue "Click" marker · `tone`: `ok`/`bad` · `note`: small hint next to it

## demo

A mock of the screen the plan changes. It is the leftmost zone of the diagram and takes the place of the frontend: arrows leave the element that was clicked and land on the element the answer changes. The user clicks in it and watches the click travel through the system and come back.

| Field | Meaning |
|---|---|
| `html` | the mock's markup. No scripts, no event handlers, no external files (images as `data:` URLs, system fonts) |
| `css` | its styles. They live in a shadow root: nothing leaks into the viewer or out of it |
| `title` | text in the window bar ("Invoices – planned") |
| `label` | caption of its zone (default: the frontend zone's, "YOU") |
| `device` | `desktop` (default, window frame) · `phone` (phone frame) |
| `width`, `height` | size in px (default 440 × 330, phone 300 × 560) |
| `state` | initial state, e.g. `"collapsed"` |

`demo` at the top level applies to every view. A view can bring its own (`views[].demo`, e.g. a "Today" mock) or hide it with `"demo": false`.

**Elements.** Mark an element with `data-ipai="<id>"`. It can be clicked (a step with `"on": "<id>"` starts there) and it can be an arrow end, written `"@<id>"`. One end of an arrow is always a box.

**Arrows at elements** leave the element's right side along its row, change rows in a lane just outside the window and enter the box from the side; several at one box meet it at offsets. The viewer measures the elements and routes these arrows in the browser, again whenever the mock moves (a sidebar folding moves its button). An arrow at an element shows only in its own step: a click's arrow going up and its answer going down cross whatever lanes they take, and the boxes' states keep what happened. An element that is hidden when you open a step directly is reached at its nearest visible container. The validator cannot measure elements, so it does not check these arrows for crossings: look at them.

**Clicks.** A view with a demo waits for the first click instead of playing, and the next element to click pulses. Play still runs everything as a tour: a cursor moves to each element and clicks it.

**States.** The viewer writes the current state into `data-state` on the mock's root. Style it with `[data-state~="saving"] .spinner{display:block}`. Show what the user would see while the system works (spinner, disabled button) and after it (toast, new row, error). An element that disappears once its answer landed (a "saving …" hint) keeps its arrow where it was.

```json
"demo": {
  "html": "<header><span class='saving' data-ipai='saving'>Saving …</span></header><aside class='side'><button data-ipai='toggle'>«</button>…</aside>",
  "css": ".side{width:156px;transition:width .3s} [data-state~=collapsed] .side{width:46px} .saving{display:none} [data-state~=saving] .saving{display:inline}"
},
"edges": [
  {"id": "save", "from": "@toggle", "to": "api", "verb": "saves"},
  {"id": "ok", "from": "api", "to": "@saving", "verb": "confirms"}
],
"steps": [
  {"on": "toggle", "edges": ["save"], "text": "You click «. The sidebar gets narrow and the page sends your choice.", "demo": "collapsed saving"},
  {"edges": ["ok"], "text": "The answer lands on “Saving …”, which goes away.", "demo": "collapsed"}
]
```

## Jump straight to a step

`out/file.html#view=bug&step=6&still&mode=tech` opens the view `bug` in the state after step 6, without animation (`still`) and in technical mode. Meant for visual checks and screenshots.

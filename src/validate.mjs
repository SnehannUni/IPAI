// Checks a flow spec for errors (rendering breaks) and rule violations (rendering becomes unclear).
// The rules are described in docs/RULES.md; the IDs used here (R1, R2 …) refer to them.
import {computeLayout, labelRect, segmentHitsBox, rectsOverlap, segmentsOverlap, textWidth, LAYOUT} from './layout.mjs';

export const NODE_TYPES = ['trigger', 'step', 'store', 'external', 'result', 'screen'];
export const WIDGETS = ['chat', 'checklist', 'meter', 'menu'];
export const VIEW_KINDS = ['normal', 'bug', 'fix', 'compare'];
export const MENU_KINDS = ['link', 'group', 'open', 'child', 'app', 'back'];
export const ZONE_TONES = ['bug', 'fix', null];
export const TAGS = ['new', 'changed', 'test', 'error'];
export const MARKS = ['new', 'changed'];
export const CHECK_STATES = ['todo', 'done', 'fail', 'ok', 'skip'];
export const NODE_STATES = ['dead', 'error', 'off', 'good', null];
export const TONES = ['ok', 'bad', 'muted', 'strong', null];
export const ROUTES = ['above', 'below', 'h-first', 'v-first'];
export const SPEAKERS = ['user', 'ai', 'system'];
export const METER_MODES = ['risk', 'progress'];

const DEFAULT_ZONES = ['frontend', 'backend', 'external'];
const LIMITS = {nodesPerView: 8, wordsPerStep: 25, sentencesPerStep: 2, wordsPerDetail: 55, sentencesPerDetail: 3, wordsPerExplain: 70, edgesPerStep: 4, columns: 6, labelChars: 26};

const isText = v => typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v) && (typeof v.simple === 'string' || typeof v.tech === 'string'));
// All variants of a text (simple and technical) – both are checked
const variants = v => typeof v === 'string' ? [v] : v && typeof v === 'object' ? [v.simple, v.tech].filter(x => typeof x === 'string') : [];
const longest = v => variants(v).reduce((a, b) => (b.length > a.length ? b : a), '');
const words = s => s.trim().split(/\s+/).filter(Boolean).length;
// Count sentence ends; abbreviations (e.g., approx.) and numbers with a dot (1.8.2012, $3.5) are not
const ABBR = /\b(e\.g|i\.e|etc|vs|approx|ca|no|Dr|Mr|Mrs|Ms|Inc|Ltd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Mio|Mrd)\./gi;
const sentences = s => (s.replace(ABBR, m => m.replace(/\./g, '')).replace(/\d\./g, '0').match(/[.!?](\s+[A-Z"“‘']|\s*$)/g) || []).length;
const same = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

export function validateSpec(spec) {
  const errors = [], warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (rule, where, msg) => warnings.push(`${rule} ${where}: ${msg}`);

  if (!spec || typeof spec !== 'object') return {errors: ['spec is not an object'], warnings};
  if (!isText(spec.title)) err('title', 'missing or not a text');

  // Zones
  const zoneIds = spec.zones?.length ? spec.zones.map(z => z.id) : DEFAULT_ZONES;
  if (spec.zones) spec.zones.forEach((z, i) => {
    if (!z.id) err(`zones[${i}]`, 'id missing');
    if (!isText(z.label)) err(`zones[${i}]`, 'label missing');
    if (z.tone !== undefined && !ZONE_TONES.includes(z.tone)) err(`zones[${i}]`, 'tone must be "bug" or "fix"');
  });
  if (new Set(zoneIds).size !== zoneIds.length) err('zones', 'duplicate id');

  // Boxes
  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  if (!nodes.length) err('nodes', 'at least one box required');
  const nodeById = {};
  nodes.forEach((n, i) => {
    const w = `box "${n.id ?? i}"`;
    if (!n.id) return err(w, 'id missing');
    if (nodeById[n.id]) err(w, 'duplicate id');
    nodeById[n.id] = n;
    if (!NODE_TYPES.includes(n.type)) err(w, `type must be one of ${NODE_TYPES.join(', ')}`);
    if (!zoneIds.includes(n.zone)) err(w, `zone "${n.zone}" does not exist (${zoneIds.join(', ')})`);
    if (!isText(n.label)) err(w, 'label missing');
    for (const k of ['col', 'row', 'cols', 'rows']) if (n[k] != null && !(Number.isInteger(n[k]) && n[k] >= (k.endsWith('s') ? 1 : 0))) err(w, `${k} must be an integer`);
    if (n.widget != null && !WIDGETS.includes(n.widget)) err(w, `widget must be one of ${WIDGETS.join(', ')}`);
    if (n.widget === 'checklist' && !(Array.isArray(n.items) && n.items.length)) err(w, 'checklist needs items');
    if (n.widget === 'checklist' && n.items?.length > 5) warn('R3', w, 'more than 5 list items do not fit into the box');
    if (n.meterMode != null && !METER_MODES.includes(n.meterMode)) err(w, `meterMode must be ${METER_MODES.join(' or ')}`);
    if (n.meterMax != null && !(typeof n.meterMax === 'number' && n.meterMax > 100)) err(w, 'meterMax must be a number above 100');
  });

  // Same cell used twice?
  const cells = {};
  nodes.forEach(n => {
    for (let c = 0; c < (n.cols || 1); c++) for (let r = 0; r < (n.rows || 1); r++) {
      const k = `${n.zone}/${(n.col || 0) + c}/${(n.row || 0) + r}`;
      if (cells[k]) err(`box "${n.id}"`, `occupies the same cell as "${cells[k]}"`);
      cells[k] = n.id;
    }
  });
  const colsInView = viewId => zoneIds
    .filter(z => nodes.some(n => n.zone === z && (!n.views || viewId == null || n.views.includes(viewId))))
    .reduce((sum, z) => sum + Math.max(1, ...nodes.filter(n => n.zone === z).map(n => (n.col || 0) + (n.cols || 1))), 0);
  for (const v of (Array.isArray(spec.views) && spec.views.length ? spec.views : [{}])) {
    const c = colsInView(v.id);
    if (c > LIMITS.columns) warn('R4', v.id ? `view "${v.id}"` : 'layout', `${c} columns – more than ${LIMITS.columns} get cluttered`);
  }

  // Arrows
  const edges = Array.isArray(spec.edges) ? spec.edges : [];
  const edgeById = {};
  edges.forEach((e, i) => {
    const w = `arrow "${e.id ?? i}"`;
    if (!e.id) return err(w, 'id missing');
    if (edgeById[e.id]) err(w, 'duplicate id');
    edgeById[e.id] = e;
    if (!nodeById[e.from]) err(w, `from "${e.from}" does not exist`);
    if (!nodeById[e.to]) err(w, `to "${e.to}" does not exist`);
    if (!isText(e.verb)) err(w, 'verb missing (every arrow needs a verb)');
    if (variants(e.verb).some(t => t.length > LIMITS.labelChars)) warn('R5', w, `verb "${longest(e.verb)}" is too long – use a short verb`);
    if (e.route != null && !ROUTES.includes(e.route)) err(w, `route must be one of ${ROUTES.join(', ')}`);
  });

  // Views and steps
  const views = Array.isArray(spec.views) ? spec.views : [];
  if (!views.length) err('views', 'at least one view required');
  const viewIds = views.map(v => v.id);
  if (new Set(viewIds).size !== viewIds.length) err('views', 'duplicate id');
  [...nodes, ...edges].forEach(x => (x.views || []).forEach(v => { if (!viewIds.includes(v)) err(`"${x.id}"`, `views contains unknown view "${v}"`); }));
  const inView = (x, v) => !x || !x.views || x.views.includes(v.id);
  const edgeInView = (e, v) => inView(e, v) && inView(nodeById[e.from], v) && inView(nodeById[e.to], v);

  const usesTech = JSON.stringify(spec).includes('"tech"');
  // All texts a box can show while a view plays (for the width check); "*" = initial state
  const shown = {};
  const collect = (id, p, view = '*') => {
    const key = view + '|' + id, t = shown[key] || (shown[key] = {status: [], badge: [], meterText: [], slots: 0});
    if (p.status != null) t.status.push(p.status);
    if (p.badge != null) t.badge.push(p.badge);
    if (p.meterText != null) t.meterText.push(p.meterText);
    if (p.slots) t.slots = Math.max(t.slots, Math.min(p.slots, 9));
  };
  nodes.forEach(n => n.initial && collect(n.id, n.initial));
  const menuTexts = {};
  const collectMenu = (id, item, view) => (menuTexts[view + '|' + id] = menuTexts[view + '|' + id] || []).push(item);

  views.forEach((v, vi) => {
    const vw = `view "${v.id ?? vi}"`;
    if (!v.id) err(vw, 'id missing');
    if (v.kind != null && !VIEW_KINDS.includes(v.kind)) err(vw, `kind must be one of ${VIEW_KINDS.join(', ')}`);
    const steps = Array.isArray(v.steps) ? v.steps : [];
    if (!steps.length) err(vw, 'no steps');
    const chain = v.chain || [];
    for (const [kind, map] of [['nodes', v.mark?.nodes], ['edges', v.mark?.edges]]) for (const [id, t] of Object.entries(map || {})) {
      if (!(kind === 'nodes' ? nodeById : edgeById)[id]) err(`${vw} mark.${kind}`, `"${id}" does not exist`);
      if (!MARKS.includes(t)) err(`${vw} mark.${kind}.${id}`, `mark must be ${MARKS.map(m => `"${m}"`).join(' or ')}`);
    }

    const visNodes = nodes.filter(n => inView(n, v));
    if (visNodes.length > LIMITS.nodesPerView) warn('R1', vw, `${visNodes.length} boxes – at most ${LIMITS.nodesPerView}, otherwise merge roles`);

    const seen = new Set(), involved = new Set(), usedEdges = new Set();
    let lastChain = -1;
    steps.forEach((s, si) => {
      const w = `${vw} step ${si + 1}`;
      const stepEdges = s.edges || [];
      const focus = [].concat(s.focus || []);
      if (!isText(s.text)) err(w, 'text missing');
      if (s.detail != null && !isText(s.detail)) err(w, 'detail is not a text');
      for (const t of variants(s.detail)) {
        if (words(t) > LIMITS.wordsPerDetail) { warn('R15', w, `detail has ${words(t)} words – at most ${LIMITS.wordsPerDetail}, otherwise it is cut off in the card`); break; }
        if (sentences(t) > LIMITS.sentencesPerDetail) { warn('R15', w, `detail has ${sentences(t)} sentences – at most ${LIMITS.sentencesPerDetail}`); break; }
      }
      // Key steps (chain link, error, change) need an explanation of what it means
      if (!s.detail && (s.chain != null || s.error || s.tag)) warn('R15', w, 'key step without detail – explain in 1–3 sentences why it happens and what it means for the user');
      if (!stepEdges.length && !focus.length) err(w, 'needs edges or focus');
      stepEdges.forEach(id => {
        const e = edgeById[id];
        if (!e) return err(w, `arrow "${id}" does not exist`);
        if (!edgeInView(e, v)) err(w, `arrow "${id}" is hidden in this view`);
        usedEdges.add(id);
      });
      focus.forEach(id => { if (!nodeById[id]) err(w, `focus "${id}" does not exist`); });
      for (const key of ['set', 'setBefore']) for (const [id, p] of Object.entries(s[key] || {})) {
        const n = nodeById[id], at = `${w} ${key}.${id}`;
        if (!n) { err(`${w} ${key}`, `box "${id}" does not exist`); continue; }
        collect(id, p, v.id);
        if (p.state !== undefined && !NODE_STATES.includes(p.state)) err(at, `state must be one of ${NODE_STATES.filter(Boolean).join(', ')} or null`);
        for (const k of ['tone', 'badgeTone']) if (p[k] !== undefined && !TONES.includes(p[k])) err(at, `${k} must be ok, bad, muted, strong or null`);
        if (p.check && p.check !== 'reset') for (const [i, c] of Object.entries(p.check)) {
          if (n.widget !== 'checklist') err(at, 'check only for widget "checklist"');
          else if (!(+i >= 0 && +i < n.items.length)) err(at, `check index ${i} does not exist (list counts from 0)`);
          if (!CHECK_STATES.includes(c)) err(at, `check state "${c}" unknown (${CHECK_STATES.join(', ')})`);
        }
        if (p.say) {
          if (n.widget !== 'chat') err(at, 'say only for widget "chat"');
          [].concat(p.say).forEach(m => { if (m.from && !SPEAKERS.includes(m.from)) err(at, `say.from must be ${SPEAKERS.join(', ')}`); });
        }
        if ((p.meter != null || p.meterText != null) && n.widget !== 'meter') err(at, 'meter/meterText only for widget "meter"');
        if (p.menu !== undefined) {
          if (n.widget !== 'menu') err(at, 'menu only for widget "menu"');
          else if (p.menu !== null) [].concat(p.menu.items || []).forEach((it, i) => {
            const item = typeof it === 'string' || isText(it) && !it.kind && !('text' in it) ? {text: it} : it;
            if (!isText(item.text)) err(at, `menu.items[${i}] needs text`);
            if (item.kind != null && !MENU_KINDS.includes(item.kind)) err(at, `menu.items[${i}].kind must be one of ${MENU_KINDS.join(', ')}`);
            collectMenu(id, item, v.id);
          });
        }
      }
      for (const id of Object.keys(s.labels || {})) if (!edgeById[id]) err(`${w} labels`, `arrow "${id}" does not exist`);
      if (s.tag != null && !TAGS.includes(s.tag)) err(w, `tag must be one of ${TAGS.join(', ')}`);
      if (s.chain != null) {
        if (!(Number.isInteger(s.chain) && s.chain >= 0 && s.chain < chain.length)) err(w, `chain ${s.chain} does not exist (chain counts from 0, has ${chain.length} links)`);
        else if (s.chain < lastChain) warn('R12', w, 'chain runs backwards – light up links in the order of the steps');
        else lastChain = s.chain;
      }

      // Flow rules
      for (const t of variants(s.text)) {
        if (words(t) > LIMITS.wordsPerStep) { warn('R7', w, `${words(t)} words ("${t.slice(0, 30)}…") – at most ${LIMITS.wordsPerStep}`); break; }
        if (sentences(t) > LIMITS.sentencesPerStep) { warn('R7', w, `${sentences(t)} sentences – at most ${LIMITS.sentencesPerStep} short ones`); break; }
      }
      if (stepEdges.length > LIMITS.edgesPerStep) warn('R8', w, `${stepEdges.length} arrows in one step – split it`);
      focus.forEach(id => seen.add(id));   // focus in the same step introduces a box
      if (si === 0 && v.kind !== 'compare') {
        const first = stepEdges[0] ? nodeById[edgeById[stepEdges[0]]?.from] : nodeById[focus[0]];
        if (first && first.type !== 'trigger') warn('R9', w, `first step should start at the trigger, not at "${first.id}"`);
      } else if (stepEdges.length) {
        const from = edgeById[stepEdges[0]]?.from;
        if (from && !seen.has(from) && nodeById[from]?.type !== 'trigger')
          warn('R10', w, `jump: "${from}" acts but has not appeared yet – introduce "${from}" with focus in this step or request it first`);
      }
      stepEdges.forEach(id => { const e = edgeById[id]; if (e) { seen.add(e.from); seen.add(e.to); involved.add(e.from); involved.add(e.to); } });
      focus.forEach(id => involved.add(id));
      if (usesTech && typeof s.text === 'string') warn('R6', w, 'text has no technical variant ({simple, tech})');
    });

    visNodes.forEach(n => { if (!involved.has(n.id)) warn('R2', vw, `box "${n.id}" appears in no step – drop it, hide it with views or use it`); });
    edges.filter(e => edgeInView(e, v) && !usedEdges.has(e.id) && !e.showUnused).forEach(e =>
      warn('R2', vw, `arrow "${e.id}" is visible but unused – hide it with views, or showUnused: true if its absence shows something`));

    const explain = [].concat(v.explain || []);
    explain.forEach((p, i) => { if (!isText(p)) err(`${vw} explain[${i}]`, 'is not a text'); });
    if (['bug', 'fix', 'compare'].includes(v.kind) && !explain.length)
      warn('R15', vw, 'explain missing – explain in 2–4 short paragraphs what this is about (problem: who is affected, what goes wrong, why; solution: what changes, what stays the same)');
    explain.forEach((p, i) => variants(p).some(t => words(t) > LIMITS.wordsPerExplain) &&
      warn('R15', `${vw} explain[${i}]`, `paragraph is longer than ${LIMITS.wordsPerExplain} words – split it`));

    if (v.kind === 'bug') {
      if (!v.headline) warn('R11', vw, 'bug view needs a headline ("Problem: …")');
      if (!steps.some(s => s.error)) warn('R11', vw, 'no step with error: true – where does it go wrong?');
      if (chain.length < 2) warn('R12', vw, 'bug view needs a cause chain (chain) with 2–5 links');
      if (chain.length > 5) warn('R12', vw, 'chain has more than 5 links');
      const used = new Set(steps.map(s => s.chain).filter(c => c != null));
      chain.forEach((_, i) => { if (!used.has(i)) warn('R12', vw, `chain link ${i} ("${longest(chain[i])}") is not triggered by any step`); });
    }
    if (v.kind === 'fix') {
      if (!steps.some(s => s.tag === 'new' || s.tag === 'changed')) warn('R13', vw, 'solution without a step tagged "new" or "changed" – what is different?');
      const bug = views.find(x => x.kind === 'bug');
      if (bug?.steps?.[0] && steps[0] && !(same(bug.steps[0].edges, steps[0].edges) && same(bug.steps[0].focus, steps[0].focus)))
        warn('R13', vw, 'solution should start with the same step as the bug (same edges/focus)');
      const last = steps[steps.length - 1];
      if (last?.error) warn('R14', vw, 'solution ends with an error');
      else if (last && !Object.entries(last.set || {}).some(([id, p]) => p.state === 'good' && ['trigger', 'result'].includes(nodeById[id]?.type)))
        warn('R14', vw, 'last step of the solution should show the user/result with state: "good"');
    }
    if (steps.length && v.kind !== 'compare') {
      const last = steps[steps.length - 1];
      const ends = [...(last.edges || []).map(id => edgeById[id]?.to), ...[].concat(last.focus || [])];
      if (!ends.some(id => ['trigger', 'result'].includes(nodeById[id]?.type))) warn('R9', vw, 'last step should end at the user or the result');
    }
  });

  edges.forEach(e => { if (!views.some(v => (v.steps || []).some(s => (s.edges || []).includes(e.id)))) warn('R2', `arrow "${e.id}"`, 'is not used in any step'); });

  if (!errors.length) checkGeometry({spec, nodes, edges, views, inView, edgeInView, shown, menuTexts, warn});
  return {errors, warnings};
}

// Geometry and space: arrows through boxes, arrows on top of each other, labels, cut-off texts
function checkGeometry({spec, nodes, edges, views, inView, edgeInView, shown, menuTexts, warn}) {
  const layouts = Object.fromEntries(views.map(v => [v.id, computeLayout(spec, v.id)]));
  const reported = new Set();
  const once = (key, fn) => { if (!reported.has(key)) { reported.add(key); fn(); } };
  const segs = r => r.pts.slice(1).map((p, i) => [r.pts[i], p]);

  for (const v of views) {
    const {boxes, routes} = layouts[v.id];
    const visNodes = nodes.filter(n => inView(n, v));
    const visEdges = edges.filter(e => edgeInView(e, v));
    const labels = [];
    for (const e of visEdges) {
      const r = routes[e.id];
      for (const n of visNodes) {
        if (n.id === e.from || n.id === e.to) continue;
        if (segs(r).some(sg => segmentHitsBox(sg, boxes[n.id])))
          once(`${e.id}>${n.id}`, () => warn('R4', `arrow "${e.id}"`, `runs through "${n.id}" – rearrange the boxes or set route ("above", "below", "h-first", "v-first")`));
      }
      const texts = [e.verb, ...(v.steps || []).map(s => s.labels?.[e.id]).filter(Boolean)].flatMap(variants);
      const text = texts.reduce((a, b) => (b.length > a.length ? b : a), '');
      const rect = labelRect(r, text);
      labels.push([e.id, rect]);
      for (const n of visNodes) {
        const b = boxes[n.id];
        if (rectsOverlap(rect, {x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4}))
          once(`label:${e.id}>${n.id}`, () => warn('R5', `arrow "${e.id}"`, `label "${text}" reaches into "${n.id}" – shorter verb or more space`));
      }
    }
    for (let i = 0; i < visEdges.length; i++) for (let j = i + 1; j < visEdges.length; j++) {
      const a = visEdges[i], b = visEdges[j];
      if (segs(routes[a.id]).some(s1 => segs(routes[b.id]).some(s2 => segmentsOverlap(s1, s2))))
        once(`ov:${a.id}|${b.id}`, () => warn('R4', `arrow "${a.id}"`, `lies on arrow "${b.id}" – rearrange the boxes or set route`));
    }
    for (const [id, rect] of labels) for (const e of visEdges) {
      if (e.id === id) continue;
      if (segs(routes[e.id]).some(sg => segmentHitsBox(sg, rect, 1)))
        once(`lo:${id}|${e.id}`, () => warn('R5', `arrow "${id}"`, `label lies on arrow "${e.id}"`));
    }
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++)
      if (rectsOverlap(labels[i][1], labels[j][1]))
        once(`ll:${labels[i][0]}|${labels[j][0]}`, () => warn('R5', `arrow "${labels[i][0]}"`, `label overlaps the one of "${labels[j][0]}"`));
  }

  // Do the texts fit into the box? Width as in the viewer: box width minus padding
  const empty = {status: [], badge: [], meterText: [], slots: 0};
  for (const n of nodes) for (const v of views) {
    if (!inView(n, v)) continue;
    const {boxes} = layouts[v.id];
    const inner = boxes[n.id].w - 2 * LAYOUT.PAD - 2, w = `box "${n.id}"`;
    const a = shown['*|' + n.id] || empty, b = shown[v.id + '|' + n.id] || empty;
    const t = {status: [...a.status, ...b.status], badge: [...a.badge, ...b.badge], meterText: [...a.meterText, ...b.meterText], slots: Math.max(a.slots, b.slots)};
    const fit = (field, list, width) => {
      const text = list.flatMap(variants).reduce((a, b) => (width(b) > width(a) ? b : a), '');
      if (text && width(text) > inner) once(`fit:${n.id}:${field}`, () =>
        warn('R3', w, `${field} "${text}" is too wide (≈${Math.round(width(text))} of ${Math.round(inner)} px) and gets cut off – shorten it`));
    };
    fit('label', [n.label], s => textWidth(s, 14, true));
    fit('sub', [n.sub].filter(Boolean), s => textWidth(s, 11.5));
    const marks = v.mark?.nodes?.[n.id] ? textWidth(v.mark.nodes[n.id], 10.5, true) + 18 : 0;
    fit('badge', t.badge, s => 12 + marks + textWidth(s, 10.5, true) + 18);   // with a badge the type name is hidden
    fit('status', t.status, s => t.slots * 18 + textWidth(s, 12));
    if (n.widget === 'checklist') fit('list item', n.items, s => 21 + textWidth(s, 12, true));
    if (n.widget === 'menu') {
      // Menu row: icon 14 + gaps, indented for children, chevron on the right for groups/apps
      const items = menuTexts[v.id + '|' + n.id] || [];
      fit('menu item', items.map(it => it.text), t => {
        const it = items.find(x => variants(x.text).includes(t)) || {};
        return (it.kind === 'child' ? 38 : 28) + (['group', 'open', 'app'].includes(it.kind) ? 16 : 0) + textWidth(t, 12.5, !!it.active) + (it.note ? textWidth(longest(it.note), 10.5) + 8 : 0);
      });
    }
    if (n.widget === 'meter') fit('meter line', t.meterText.length ? t.meterText : ['100 %'], s => textWidth(`${longest(n.meterLabel) || 'Load'}: ${s}`, 12));
  }
}

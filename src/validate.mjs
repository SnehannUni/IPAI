// Prüft eine Flow-Spec auf Fehler (Darstellung bricht) und Regelverstöße (Darstellung wird unklar).
// Die Regeln sind in docs/REGELN.md beschrieben; die Kennungen hier (R1, R2 …) verweisen darauf.
import {computeLayout, labelRect, segmentHitsBox, rectsOverlap, segmentsOverlap, textWidth, LAYOUT} from './layout.mjs';

export const NODE_TYPES = ['trigger', 'step', 'store', 'external', 'result', 'screen'];
export const WIDGETS = ['chat', 'checklist', 'meter', 'menu'];
export const VIEW_KINDS = ['normal', 'bug', 'fix', 'compare'];
export const MENU_KINDS = ['link', 'group', 'open', 'child', 'app', 'back'];
export const ZONE_TONES = ['bug', 'fix', null];
export const TAGS = ['neu', 'geändert', 'test', 'fehler'];
export const CHECK_STATES = ['todo', 'done', 'fail', 'ok', 'skip'];
export const NODE_STATES = ['dead', 'error', 'off', 'good', null];
export const TONES = ['ok', 'bad', 'muted', 'strong', null];
export const ROUTES = ['above', 'below', 'h-first', 'v-first'];
export const SPEAKERS = ['user', 'ai', 'system'];
export const METER_MODES = ['risk', 'progress'];

const DEFAULT_ZONES = ['frontend', 'backend', 'external'];
const LIMITS = {nodesPerView: 8, wordsPerStep: 25, sentencesPerStep: 2, wordsPerDetail: 55, sentencesPerDetail: 3, wordsPerExplain: 70, edgesPerStep: 4, columns: 6, labelChars: 26};

const isText = v => typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v) && (typeof v.simple === 'string' || typeof v.tech === 'string'));
// Alle Fassungen eines Textes (einfach und technisch) – beide werden geprüft
const variants = v => typeof v === 'string' ? [v] : v && typeof v === 'object' ? [v.simple, v.tech].filter(x => typeof x === 'string') : [];
const longest = v => variants(v).reduce((a, b) => (b.length > a.length ? b : a), '');
const words = s => s.trim().split(/\s+/).filter(Boolean).length;
// Satzenden zählen; Abkürzungen (Mio., z. B.) und Zahlen mit Punkt (28.10.) sind keine
const ABBR = /\b(Mio|Mrd|Tsd|ca|Nr|bzw|usw|vs|evtl|ggf|inkl|z|B|d|h|u|a|Std|Min|Sek|Abb|Dr)\./g;
const sentences = s => (s.replace(ABBR, '$1').replace(/\d\./g, '0').match(/[.!?](\s+[A-ZÄÖÜ„"]|\s*$)/g) || []).length;
const same = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

export function validateSpec(spec) {
  const errors = [], warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (rule, where, msg) => warnings.push(`${rule} ${where}: ${msg}`);

  if (!spec || typeof spec !== 'object') return {errors: ['Spec ist kein Objekt'], warnings};
  if (!isText(spec.title)) err('title', 'fehlt oder ist kein Text');

  // Bereiche
  const zoneIds = spec.zones?.length ? spec.zones.map(z => z.id) : DEFAULT_ZONES;
  if (spec.zones) spec.zones.forEach((z, i) => {
    if (!z.id) err(`zones[${i}]`, 'id fehlt');
    if (!isText(z.label)) err(`zones[${i}]`, 'label fehlt');
    if (z.tone !== undefined && !ZONE_TONES.includes(z.tone)) err(`zones[${i}]`, 'tone muss "bug" oder "fix" sein');
  });
  if (new Set(zoneIds).size !== zoneIds.length) err('zones', 'doppelte id');

  // Kästchen
  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  if (!nodes.length) err('nodes', 'mindestens ein Kästchen nötig');
  const nodeById = {};
  nodes.forEach((n, i) => {
    const w = `Kästchen "${n.id ?? i}"`;
    if (!n.id) return err(w, 'id fehlt');
    if (nodeById[n.id]) err(w, 'doppelte id');
    nodeById[n.id] = n;
    if (!NODE_TYPES.includes(n.type)) err(w, `type muss einer von ${NODE_TYPES.join(', ')} sein`);
    if (!zoneIds.includes(n.zone)) err(w, `zone "${n.zone}" gibt es nicht (${zoneIds.join(', ')})`);
    if (!isText(n.label)) err(w, 'label fehlt');
    for (const k of ['col', 'row', 'cols', 'rows']) if (n[k] != null && !(Number.isInteger(n[k]) && n[k] >= (k.endsWith('s') ? 1 : 0))) err(w, `${k} muss eine ganze Zahl sein`);
    if (n.widget != null && !WIDGETS.includes(n.widget)) err(w, `widget muss einer von ${WIDGETS.join(', ')} sein`);
    if (n.widget === 'checklist' && !(Array.isArray(n.items) && n.items.length)) err(w, 'checklist braucht items');
    if (n.widget === 'checklist' && n.items?.length > 5) warn('R3', w, 'mehr als 5 Punkte in der Liste passen nicht ins Kästchen');
    if (n.meterMode != null && !METER_MODES.includes(n.meterMode)) err(w, `meterMode muss ${METER_MODES.join(' oder ')} sein`);
    if (n.meterMax != null && !(typeof n.meterMax === 'number' && n.meterMax > 100)) err(w, 'meterMax muss eine Zahl über 100 sein');
  });

  // Gleicher Platz doppelt belegt?
  const cells = {};
  nodes.forEach(n => {
    for (let c = 0; c < (n.cols || 1); c++) for (let r = 0; r < (n.rows || 1); r++) {
      const k = `${n.zone}/${(n.col || 0) + c}/${(n.row || 0) + r}`;
      if (cells[k]) err(`Kästchen "${n.id}"`, `liegt auf demselben Platz wie "${cells[k]}"`);
      cells[k] = n.id;
    }
  });
  const colsInView = viewId => zoneIds
    .filter(z => nodes.some(n => n.zone === z && (!n.views || viewId == null || n.views.includes(viewId))))
    .reduce((sum, z) => sum + Math.max(1, ...nodes.filter(n => n.zone === z).map(n => (n.col || 0) + (n.cols || 1))), 0);
  for (const v of (Array.isArray(spec.views) && spec.views.length ? spec.views : [{}])) {
    const c = colsInView(v.id);
    if (c > LIMITS.columns) warn('R4', v.id ? `Ansicht "${v.id}"` : 'Layout', `${c} Spalten – mehr als ${LIMITS.columns} werden unübersichtlich`);
  }

  // Pfeile
  const edges = Array.isArray(spec.edges) ? spec.edges : [];
  const edgeById = {};
  edges.forEach((e, i) => {
    const w = `Pfeil "${e.id ?? i}"`;
    if (!e.id) return err(w, 'id fehlt');
    if (edgeById[e.id]) err(w, 'doppelte id');
    edgeById[e.id] = e;
    if (!nodeById[e.from]) err(w, `from "${e.from}" gibt es nicht`);
    if (!nodeById[e.to]) err(w, `to "${e.to}" gibt es nicht`);
    if (!isText(e.verb)) err(w, 'verb fehlt (jeder Pfeil braucht ein Verb)');
    if (variants(e.verb).some(t => t.length > LIMITS.labelChars)) warn('R5', w, `verb „${longest(e.verb)}“ ist zu lang – kurzes Verb verwenden`);
    if (e.route != null && !ROUTES.includes(e.route)) err(w, `route muss einer von ${ROUTES.join(', ')} sein`);
  });

  // Ansichten und Schritte
  const views = Array.isArray(spec.views) ? spec.views : [];
  if (!views.length) err('views', 'mindestens eine Ansicht nötig');
  const viewIds = views.map(v => v.id);
  if (new Set(viewIds).size !== viewIds.length) err('views', 'doppelte id');
  [...nodes, ...edges].forEach(x => (x.views || []).forEach(v => { if (!viewIds.includes(v)) err(`"${x.id}"`, `views enthält unbekannte Ansicht "${v}"`); }));
  const inView = (x, v) => !x || !x.views || x.views.includes(v.id);
  const edgeInView = (e, v) => inView(e, v) && inView(nodeById[e.from], v) && inView(nodeById[e.to], v);

  const usesTech = JSON.stringify(spec).includes('"tech"');
  // Alle Texte, die ein Kästchen im Lauf einer Ansicht anzeigen kann (für die Breitenprüfung); "*" = Startzustand
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
    const vw = `Ansicht "${v.id ?? vi}"`;
    if (!v.id) err(vw, 'id fehlt');
    if (v.kind != null && !VIEW_KINDS.includes(v.kind)) err(vw, `kind muss einer von ${VIEW_KINDS.join(', ')} sein`);
    const steps = Array.isArray(v.steps) ? v.steps : [];
    if (!steps.length) err(vw, 'keine Schritte');
    const chain = v.chain || [];
    for (const [kind, map] of [['nodes', v.mark?.nodes], ['edges', v.mark?.edges]]) for (const [id, t] of Object.entries(map || {})) {
      if (!(kind === 'nodes' ? nodeById : edgeById)[id]) err(`${vw} mark.${kind}`, `"${id}" gibt es nicht`);
      if (!['neu', 'geändert'].includes(t)) err(`${vw} mark.${kind}.${id}`, 'Markierung muss "neu" oder "geändert" sein');
    }

    const visNodes = nodes.filter(n => inView(n, v));
    if (visNodes.length > LIMITS.nodesPerView) warn('R1', vw, `${visNodes.length} Kästchen – höchstens ${LIMITS.nodesPerView}, sonst Rollen zusammenfassen`);

    const seen = new Set(), involved = new Set(), usedEdges = new Set();
    let lastChain = -1;
    steps.forEach((s, si) => {
      const w = `${vw} Schritt ${si + 1}`;
      const stepEdges = s.edges || [];
      const focus = [].concat(s.focus || []);
      if (!isText(s.text)) err(w, 'text fehlt');
      if (s.detail != null && !isText(s.detail)) err(w, 'detail ist kein Text');
      for (const t of variants(s.detail)) {
        if (words(t) > LIMITS.wordsPerDetail) { warn('R15', w, `detail hat ${words(t)} Wörter – höchstens ${LIMITS.wordsPerDetail}, sonst wird es in der Karte abgeschnitten`); break; }
        if (sentences(t) > LIMITS.sentencesPerDetail) { warn('R15', w, `detail hat ${sentences(t)} Sätze – höchstens ${LIMITS.sentencesPerDetail}`); break; }
      }
      // Schlüsselschritte (Kettenglied, Fehler, Änderung) brauchen eine Erklärung, was das bedeutet
      if (!s.detail && (s.chain != null || s.error || s.tag)) warn('R15', w, 'Schlüsselschritt ohne detail – in 1–3 Sätzen erklären, warum das passiert und was es für den Nutzer bedeutet');
      if (!stepEdges.length && !focus.length) err(w, 'braucht edges oder focus');
      stepEdges.forEach(id => {
        const e = edgeById[id];
        if (!e) return err(w, `Pfeil "${id}" gibt es nicht`);
        if (!edgeInView(e, v)) err(w, `Pfeil "${id}" ist in dieser Ansicht ausgeblendet`);
        usedEdges.add(id);
      });
      focus.forEach(id => { if (!nodeById[id]) err(w, `focus "${id}" gibt es nicht`); });
      for (const key of ['set', 'setBefore']) for (const [id, p] of Object.entries(s[key] || {})) {
        const n = nodeById[id], at = `${w} ${key}.${id}`;
        if (!n) { err(`${w} ${key}`, `Kästchen "${id}" gibt es nicht`); continue; }
        collect(id, p, v.id);
        if (p.state !== undefined && !NODE_STATES.includes(p.state)) err(at, `state muss einer von ${NODE_STATES.filter(Boolean).join(', ')} oder null sein`);
        for (const k of ['tone', 'badgeTone']) if (p[k] !== undefined && !TONES.includes(p[k])) err(at, `${k} muss ok, bad, muted, strong oder null sein`);
        if (p.check && p.check !== 'reset') for (const [i, c] of Object.entries(p.check)) {
          if (n.widget !== 'checklist') err(at, 'check nur bei widget "checklist"');
          else if (!(+i >= 0 && +i < n.items.length)) err(at, `check-Index ${i} gibt es nicht (Liste zählt ab 0)`);
          if (!CHECK_STATES.includes(c)) err(at, `check-Zustand "${c}" unbekannt (${CHECK_STATES.join(', ')})`);
        }
        if (p.say) {
          if (n.widget !== 'chat') err(at, 'say nur bei widget "chat"');
          [].concat(p.say).forEach(m => { if (m.from && !SPEAKERS.includes(m.from)) err(at, `say.from muss ${SPEAKERS.join(', ')} sein`); });
        }
        if ((p.meter != null || p.meterText != null) && n.widget !== 'meter') err(at, 'meter/meterText nur bei widget "meter"');
        if (p.menu !== undefined) {
          if (n.widget !== 'menu') err(at, 'menu nur bei widget "menu"');
          else if (p.menu !== null) [].concat(p.menu.items || []).forEach((it, i) => {
            const item = typeof it === 'string' || isText(it) && !it.kind && !('text' in it) ? {text: it} : it;
            if (!isText(item.text)) err(at, `menu.items[${i}] braucht text`);
            if (item.kind != null && !MENU_KINDS.includes(item.kind)) err(at, `menu.items[${i}].kind muss einer von ${MENU_KINDS.join(', ')} sein`);
            collectMenu(id, item, v.id);
          });
        }
      }
      for (const id of Object.keys(s.labels || {})) if (!edgeById[id]) err(`${w} labels`, `Pfeil "${id}" gibt es nicht`);
      if (s.tag != null && !TAGS.includes(s.tag)) err(w, `tag muss einer von ${TAGS.join(', ')} sein`);
      if (s.chain != null) {
        if (!(Number.isInteger(s.chain) && s.chain >= 0 && s.chain < chain.length)) err(w, `chain ${s.chain} gibt es nicht (Kette zählt ab 0, hat ${chain.length} Glieder)`);
        else if (s.chain < lastChain) warn('R12', w, 'Kette läuft rückwärts – Glieder in der Reihenfolge der Schritte aufleuchten lassen');
        else lastChain = s.chain;
      }

      // Regeln für den Ablauf
      for (const t of variants(s.text)) {
        if (words(t) > LIMITS.wordsPerStep) { warn('R7', w, `${words(t)} Wörter („${t.slice(0, 30)}…“) – höchstens ${LIMITS.wordsPerStep}`); break; }
        if (sentences(t) > LIMITS.sentencesPerStep) { warn('R7', w, `${sentences(t)} Sätze – höchstens ${LIMITS.sentencesPerStep} kurze`); break; }
      }
      if (stepEdges.length > LIMITS.edgesPerStep) warn('R8', w, `${stepEdges.length} Pfeile in einem Schritt – aufteilen`);
      focus.forEach(id => seen.add(id));   // focus im selben Schritt führt ein Kästchen ein
      if (si === 0 && v.kind !== 'compare') {
        const first = stepEdges[0] ? nodeById[edgeById[stepEdges[0]]?.from] : nodeById[focus[0]];
        if (first && first.type !== 'trigger') warn('R9', w, `erster Schritt sollte beim Auslöser beginnen, nicht bei "${first.id}"`);
      } else if (stepEdges.length) {
        const from = edgeById[stepEdges[0]]?.from;
        if (from && !seen.has(from) && nodeById[from]?.type !== 'trigger')
          warn('R10', w, `Sprung: "${from}" handelt, kam aber noch nicht vor – "${from}" in diesem Schritt mit focus einführen oder vorher anfragen`);
      }
      stepEdges.forEach(id => { const e = edgeById[id]; if (e) { seen.add(e.from); seen.add(e.to); involved.add(e.from); involved.add(e.to); } });
      focus.forEach(id => involved.add(id));
      if (usesTech && typeof s.text === 'string') warn('R6', w, 'text hat keine technische Variante ({simple, tech})');
    });

    visNodes.forEach(n => { if (!involved.has(n.id)) warn('R2', vw, `Kästchen "${n.id}" kommt in keinem Schritt vor – weglassen, mit views ausblenden oder einbinden`); });
    edges.filter(e => edgeInView(e, v) && !usedEdges.has(e.id) && !e.showUnused).forEach(e =>
      warn('R2', vw, `Pfeil "${e.id}" ist sichtbar, wird aber nicht benutzt – mit views ausblenden oder showUnused: true, wenn das Fehlen etwas zeigt`));

    const explain = [].concat(v.explain || []);
    explain.forEach((p, i) => { if (!isText(p)) err(`${vw} explain[${i}]`, 'ist kein Text'); });
    if (['bug', 'fix', 'compare'].includes(v.kind) && !explain.length)
      warn('R15', vw, 'explain fehlt – in 2–4 kurzen Absätzen erklären, worum es geht (Problem: wer ist betroffen, was läuft schief, warum; Lösung: was ändert sich, was bleibt gleich)');
    explain.forEach((p, i) => variants(p).some(t => words(t) > LIMITS.wordsPerExplain) &&
      warn('R15', `${vw} explain[${i}]`, `Absatz ist länger als ${LIMITS.wordsPerExplain} Wörter – aufteilen`));

    if (v.kind === 'bug') {
      if (!v.headline) warn('R11', vw, 'Bug-Ansicht braucht eine headline ("Problem: …")');
      if (!steps.some(s => s.error)) warn('R11', vw, 'kein Schritt mit error: true – wo geht es schief?');
      if (chain.length < 2) warn('R12', vw, 'Bug-Ansicht braucht eine Ursachenkette (chain) mit 2–5 Gliedern');
      if (chain.length > 5) warn('R12', vw, 'Kette hat mehr als 5 Glieder');
      const used = new Set(steps.map(s => s.chain).filter(c => c != null));
      chain.forEach((_, i) => { if (!used.has(i)) warn('R12', vw, `Kettenglied ${i} („${longest(chain[i])}“) wird von keinem Schritt ausgelöst`); });
    }
    if (v.kind === 'fix') {
      if (!steps.some(s => s.tag === 'neu' || s.tag === 'geändert')) warn('R13', vw, 'Lösung ohne Schritt mit tag "neu" oder "geändert" – was ist anders?');
      const bug = views.find(x => x.kind === 'bug');
      if (bug?.steps?.[0] && steps[0] && !(same(bug.steps[0].edges, steps[0].edges) && same(bug.steps[0].focus, steps[0].focus)))
        warn('R13', vw, 'Lösung sollte mit demselben Schritt beginnen wie der Bug (gleiche edges/focus)');
      const last = steps[steps.length - 1];
      if (last?.error) warn('R14', vw, 'Lösung endet mit einem Fehler');
      else if (last && !Object.entries(last.set || {}).some(([id, p]) => p.state === 'good' && ['trigger', 'result'].includes(nodeById[id]?.type)))
        warn('R14', vw, 'letzter Schritt der Lösung sollte Nutzer/Ergebnis mit state: "good" zeigen');
    }
    if (steps.length && v.kind !== 'compare') {
      const last = steps[steps.length - 1];
      const ends = [...(last.edges || []).map(id => edgeById[id]?.to), ...[].concat(last.focus || [])];
      if (!ends.some(id => ['trigger', 'result'].includes(nodeById[id]?.type))) warn('R9', vw, 'letzter Schritt sollte beim Nutzer bzw. Ergebnis enden');
    }
  });

  edges.forEach(e => { if (!views.some(v => (v.steps || []).some(s => (s.edges || []).includes(e.id)))) warn('R2', `Pfeil "${e.id}"`, 'wird in keinem Schritt benutzt'); });

  if (!errors.length) checkGeometry({spec, nodes, edges, views, nodeById, inView, edgeInView, shown, menuTexts, warn});
  return {errors, warnings};
}

// Geometrie und Platz: Pfeile durch Kästchen, Pfeile aufeinander, Beschriftungen, abgeschnittene Texte
function checkGeometry({spec, nodes, edges, views, nodeById, inView, edgeInView, shown, menuTexts, warn}) {
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
          once(`${e.id}>${n.id}`, () => warn('R4', `Pfeil "${e.id}"`, `läuft durch "${n.id}" – Kästchen umstellen oder route setzen ("above", "below", "h-first", "v-first")`));
      }
      const texts = [e.verb, ...(v.steps || []).map(s => s.labels?.[e.id]).filter(Boolean)].flatMap(variants);
      const text = texts.reduce((a, b) => (b.length > a.length ? b : a), '');
      const rect = labelRect(r, text);
      labels.push([e.id, rect]);
      for (const n of visNodes) {
        const b = boxes[n.id];
        if (rectsOverlap(rect, {x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4}))
          once(`label:${e.id}>${n.id}`, () => warn('R5', `Pfeil "${e.id}"`, `Beschriftung „${text}“ ragt in "${n.id}" – kürzeres Verb oder mehr Abstand`));
      }
    }
    for (let i = 0; i < visEdges.length; i++) for (let j = i + 1; j < visEdges.length; j++) {
      const a = visEdges[i], b = visEdges[j];
      if (segs(routes[a.id]).some(s1 => segs(routes[b.id]).some(s2 => segmentsOverlap(s1, s2))))
        once(`ov:${a.id}|${b.id}`, () => warn('R4', `Pfeil "${a.id}"`, `liegt auf Pfeil "${b.id}" – Kästchen umstellen oder route setzen`));
    }
    for (const [id, rect] of labels) for (const e of visEdges) {
      if (e.id === id) continue;
      if (segs(routes[e.id]).some(sg => segmentHitsBox(sg, rect, 1)))
        once(`lo:${id}|${e.id}`, () => warn('R5', `Pfeil "${id}"`, `Beschriftung liegt auf Pfeil "${e.id}"`));
    }
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++)
      if (rectsOverlap(labels[i][1], labels[j][1]))
        once(`ll:${labels[i][0]}|${labels[j][0]}`, () => warn('R5', `Pfeil "${labels[i][0]}"`, `Beschriftung überlappt die von "${labels[j][0]}"`));
  }

  // Passen die Texte ins Kästchen? Breite wie im Viewer: Kästchenbreite minus Innenabstand
  const empty = {status: [], badge: [], meterText: [], slots: 0};
  for (const n of nodes) for (const v of views) {
    if (!inView(n, v)) continue;
    const {boxes} = layouts[v.id];
    const inner = boxes[n.id].w - 2 * LAYOUT.PAD - 2, w = `Kästchen "${n.id}"`;
    const a = shown['*|' + n.id] || empty, b = shown[v.id + '|' + n.id] || empty;
    const t = {status: [...a.status, ...b.status], badge: [...a.badge, ...b.badge], meterText: [...a.meterText, ...b.meterText], slots: Math.max(a.slots, b.slots)};
    const fit = (field, list, width) => {
      const text = list.flatMap(variants).reduce((a, b) => (width(b) > width(a) ? b : a), '');
      if (text && width(text) > inner) once(`fit:${n.id}:${field}`, () =>
        warn('R3', w, `${field} „${text}“ ist zu breit (≈${Math.round(width(text))} von ${Math.round(inner)} px) und wird abgeschnitten – kürzen`));
    };
    fit('label', [n.label], s => textWidth(s, 14, true));
    fit('sub', [n.sub].filter(Boolean), s => textWidth(s, 11.5));
    const marks = v.mark?.nodes?.[n.id] ? textWidth(v.mark.nodes[n.id], 10.5, true) + 18 : 0;
    fit('badge', t.badge, s => 12 + marks + textWidth(s, 10.5, true) + 18);   // mit Etikett entfällt der Typname
    fit('status', t.status, s => t.slots * 18 + textWidth(s, 12));
    if (n.widget === 'checklist') fit('Listenpunkt', n.items, s => 21 + textWidth(s, 12, true));
    if (n.widget === 'menu') {
      // Menüzeile: Symbol 14 + Abstände, eingerückt bei Unterpunkten, Pfeil rechts bei Gruppen/Apps
      const items = menuTexts[v.id + '|' + n.id] || [];
      fit('Menüeintrag', items.map(it => it.text), t => {
        const it = items.find(x => variants(x.text).includes(t)) || {};
        return (it.kind === 'child' ? 38 : 28) + (['group', 'open', 'app'].includes(it.kind) ? 16 : 0) + textWidth(t, 12.5, !!it.active) + (it.note ? textWidth(longest(it.note), 10.5) + 8 : 0);
      });
    }
    if (n.widget === 'meter') fit('Balkenzeile', t.meterText.length ? t.meterText : ['100 %'], s => textWidth(`${longest(n.meterLabel) || 'Auslastung'}: ${s}`, 12));
  }
}

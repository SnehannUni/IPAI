// Prüft eine Flow-Spec auf Fehler (Darstellung bricht) und Regelverstöße (Darstellung wird unklar).
// Die Regeln sind in docs/REGELN.md beschrieben; die Kennungen hier (R1, R2 …) verweisen darauf.
import {computeLayout, labelRect, segmentHitsBox, rectsOverlap} from './layout.mjs';

export const NODE_TYPES = ['trigger', 'step', 'store', 'external', 'result'];
export const WIDGETS = ['chat', 'checklist', 'meter'];
export const VIEW_KINDS = ['normal', 'bug', 'fix'];
export const TAGS = ['neu', 'geändert', 'test', 'fehler'];
export const CHECK_STATES = ['todo', 'done', 'fail', 'ok'];
export const NODE_STATES = ['dead', 'off', 'good', null];
export const TONES = ['ok', 'bad', 'muted', 'strong', null];

const DEFAULT_ZONES = ['frontend', 'backend', 'external'];
const LIMITS = {nodesPerView: 8, wordsPerStep: 25, edgesPerStep: 4, columns: 6, labelChars: 26};

const isText = v => typeof v === 'string' || (v && typeof v === 'object' && !Array.isArray(v) && (typeof v.simple === 'string' || typeof v.tech === 'string'));
const plain = v => typeof v === 'string' ? v : v ? (v.simple ?? v.tech ?? '') : '';
const words = v => plain(v).trim().split(/\s+/).filter(Boolean).length;

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
  });
  if (new Set(zoneIds).size !== zoneIds.length) err('zones', 'doppelte id');

  // Kästchen
  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  if (!nodes.length) err('nodes', 'mindestens ein Kästchen nötig');
  const nodeById = {};
  nodes.forEach((n, i) => {
    const w = `nodes[${n.id ?? i}]`;
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
    if (plain(n.label).length > 22) warn('R3', w, 'label ist länger als 22 Zeichen und wird abgeschnitten');
    if (plain(n.sub).length > 30) warn('R3', w, 'sub ist länger als 30 Zeichen und wird abgeschnitten');
  });

  // Gleicher Platz doppelt belegt?
  const cells = {};
  nodes.forEach(n => {
    for (let c = 0; c < (n.cols || 1); c++) for (let r = 0; r < (n.rows || 1); r++) {
      const k = `${n.zone}/${(n.col || 0) + c}/${(n.row || 0) + r}`;
      if (cells[k]) err(`nodes[${n.id}]`, `liegt auf demselben Platz wie "${cells[k]}"`);
      cells[k] = n.id;
    }
  });
  const totalCols = zoneIds.reduce((sum, z) => sum + Math.max(1, ...nodes.filter(n => n.zone === z).map(n => (n.col || 0) + (n.cols || 1))), 0);
  if (totalCols > LIMITS.columns) warn('R4', 'layout', `${totalCols} Spalten – mehr als ${LIMITS.columns} werden zu eng`);

  // Pfeile
  const edges = Array.isArray(spec.edges) ? spec.edges : [];
  const edgeById = {};
  edges.forEach((e, i) => {
    const w = `edges[${e.id ?? i}]`;
    if (!e.id) return err(w, 'id fehlt');
    if (edgeById[e.id]) err(w, 'doppelte id');
    edgeById[e.id] = e;
    if (!nodeById[e.from]) err(w, `from "${e.from}" gibt es nicht`);
    if (!nodeById[e.to]) err(w, `to "${e.to}" gibt es nicht`);
    if (!isText(e.verb)) err(w, 'verb fehlt (jeder Pfeil braucht ein Verb)');
    if (plain(e.verb).length > LIMITS.labelChars) warn('R5', w, 'verb ist zu lang – kurzes Verb verwenden');
    if (e.route != null && !['above', 'below'].includes(e.route)) err(w, 'route muss "above" oder "below" sein');
  });

  // Ansichten und Schritte
  const views = Array.isArray(spec.views) ? spec.views : [];
  if (!views.length) err('views', 'mindestens eine Ansicht nötig');
  const viewIds = views.map(v => v.id);
  if (new Set(viewIds).size !== viewIds.length) err('views', 'doppelte id');
  [...nodes, ...edges].forEach(x => (x.views || []).forEach(v => { if (!viewIds.includes(v)) err(`${x.id}`, `views enthält unbekannte Ansicht "${v}"`); }));
  const inView = (x, v) => !x.views || x.views.includes(v.id);

  const usesTech = JSON.stringify(spec).includes('"tech"');

  views.forEach((v, vi) => {
    const vw = `views[${v.id ?? vi}]`;
    if (!v.id) err(vw, 'id fehlt');
    if (v.kind != null && !VIEW_KINDS.includes(v.kind)) err(vw, `kind muss einer von ${VIEW_KINDS.join(', ')} sein`);
    const steps = Array.isArray(v.steps) ? v.steps : [];
    if (!steps.length) err(vw, 'keine Schritte');
    const chain = v.chain || [];
    for (const [kind, map] of [['nodes', v.mark?.nodes], ['edges', v.mark?.edges]]) for (const [id, t] of Object.entries(map || {})) {
      if (!(kind === 'nodes' ? nodeById : edgeById)[id]) err(`${vw}.mark.${kind}`, `"${id}" gibt es nicht`);
      if (!['neu', 'geändert'].includes(t)) err(`${vw}.mark.${kind}.${id}`, 'Markierung muss "neu" oder "geändert" sein');
    }

    const visNodes = nodes.filter(n => inView(n, v));
    if (visNodes.length > LIMITS.nodesPerView) warn('R1', vw, `${visNodes.length} Kästchen – höchstens ${LIMITS.nodesPerView}, sonst Rollen zusammenfassen`);

    const seen = new Set(), involved = new Set();
    let lastChain = -1;
    steps.forEach((s, si) => {
      const w = `${vw}.steps[${si + 1}]`;
      const stepEdges = s.edges || [];
      const focus = [].concat(s.focus || []);
      if (!isText(s.text)) err(w, 'text fehlt');
      if (!stepEdges.length && !focus.length) err(w, 'braucht edges oder focus');
      stepEdges.forEach(id => {
        const e = edgeById[id];
        if (!e) return err(w, `Pfeil "${id}" gibt es nicht`);
        if (!inView(e, v) || !inView(nodeById[e.from] || {}, v) || !inView(nodeById[e.to] || {}, v)) err(w, `Pfeil "${id}" ist in dieser Ansicht ausgeblendet`);
      });
      focus.forEach(id => { if (!nodeById[id]) err(w, `focus "${id}" gibt es nicht`); });
      for (const key of ['set', 'setBefore']) for (const [id, p] of Object.entries(s[key] || {})) {
        const n = nodeById[id];
        if (!n) { err(`${w}.${key}`, `Kästchen "${id}" gibt es nicht`); continue; }
        if (p.state !== undefined && !NODE_STATES.includes(p.state)) err(`${w}.${key}.${id}`, 'state muss dead, off, good oder null sein');
        if (p.tone !== undefined && !TONES.includes(p.tone)) err(`${w}.${key}.${id}`, 'tone muss ok, bad, muted, strong oder null sein');
        if (p.check && p.check !== 'reset') for (const [i, c] of Object.entries(p.check)) {
          if (n.widget !== 'checklist') err(`${w}.${key}.${id}`, 'check nur bei widget "checklist"');
          else if (!(+i >= 0 && +i < n.items.length)) err(`${w}.${key}.${id}`, `check-Index ${i} gibt es nicht`);
          if (!CHECK_STATES.includes(c)) err(`${w}.${key}.${id}`, `check-Zustand "${c}" unbekannt (${CHECK_STATES.join(', ')})`);
        }
        if (p.say && n.widget !== 'chat') err(`${w}.${key}.${id}`, 'say nur bei widget "chat"');
        if (p.meter != null && n.widget !== 'meter') err(`${w}.${key}.${id}`, 'meter nur bei widget "meter"');
      }
      for (const id of Object.keys(s.labels || {})) if (!edgeById[id]) err(`${w}.labels`, `Pfeil "${id}" gibt es nicht`);
      if (s.tag != null && !TAGS.includes(s.tag)) err(w, `tag muss einer von ${TAGS.join(', ')} sein`);
      if (s.chain != null) {
        if (!(Number.isInteger(s.chain) && s.chain >= 0 && s.chain < chain.length)) err(w, `chain ${s.chain} gibt es nicht`);
        else if (s.chain < lastChain) warn('R12', w, 'Kette läuft rückwärts – Glieder in der Reihenfolge der Schritte aufleuchten lassen');
        else lastChain = s.chain;
      }

      // Regeln für den Ablauf
      if (words(s.text) > LIMITS.wordsPerStep) warn('R7', w, `${words(s.text)} Wörter – höchstens ${LIMITS.wordsPerStep}, ein Satz pro Schritt`);
      if (stepEdges.length > LIMITS.edgesPerStep) warn('R8', w, `${stepEdges.length} Pfeile in einem Schritt – aufteilen`);
      if (si === 0) {
        const first = stepEdges[0] ? nodeById[edgeById[stepEdges[0]]?.from] : nodeById[focus[0]];
        if (first && first.type !== 'trigger') warn('R9', w, `erster Schritt sollte beim Auslöser beginnen, nicht bei "${first.id}"`);
      } else if (stepEdges.length) {
        const from = edgeById[stepEdges[0]]?.from;
        if (from && !seen.has(from) && nodeById[from]?.type !== 'trigger')
          warn('R10', w, `Sprung: "${from}" handelt, kam aber noch nicht vor – vorher einen Schritt mit focus auf "${from}" einfügen`);
      }
      stepEdges.forEach(id => { const e = edgeById[id]; if (e) { seen.add(e.from); seen.add(e.to); involved.add(e.from); involved.add(e.to); } });
      focus.forEach(id => { seen.add(id); involved.add(id); });
      if (usesTech && typeof s.text === 'string') warn('R6', w, 'text hat keine technische Variante ({simple, tech})');
    });

    visNodes.forEach(n => { if (!involved.has(n.id)) warn('R2', vw, `Kästchen "${n.id}" kommt in keinem Schritt vor – weglassen oder einbinden`); });

    if (v.kind === 'bug') {
      if (!v.headline) warn('R11', vw, 'Bug-Ansicht braucht eine headline ("Problem: …")');
      if (chain.length < 2) warn('R12', vw, 'Bug-Ansicht braucht eine Ursachenkette (chain) mit 2–5 Gliedern');
      if (chain.length > 5) warn('R12', vw, 'Kette hat mehr als 5 Glieder');
      if (!steps.some(s => s.error)) warn('R11', vw, 'kein Schritt mit error: true – wo geht es schief?');
      const used = new Set(steps.map(s => s.chain).filter(c => c != null));
      chain.forEach((_, i) => { if (!used.has(i)) warn('R12', vw, `Kettenglied ${i + 1} wird von keinem Schritt ausgelöst`); });
    }
    if (v.kind === 'fix') {
      if (!steps.some(s => s.tag === 'neu' || s.tag === 'geändert')) warn('R13', vw, 'Lösung ohne Schritt mit tag "neu" oder "geändert" – was ist anders?');
      if (steps.length && steps[steps.length - 1].error) warn('R14', vw, 'Lösung endet mit einem Fehler');
      const bug = views.find(x => x.kind === 'bug');
      if (bug && bug.steps?.[0] && steps[0] && plain(bug.steps[0].text) !== plain(steps[0].text)) warn('R13', vw, 'Lösung sollte mit demselben Szenario beginnen wie der Bug');
    }
    if (steps.length) {
      const last = steps[steps.length - 1];
      const ends = [...(last.edges || []).map(id => edgeById[id]?.to), ...[].concat(last.focus || [])];
      if (!ends.some(id => ['trigger', 'result'].includes(nodeById[id]?.type))) warn('R9', vw, 'letzter Schritt sollte beim Nutzer bzw. Ergebnis enden');
    }
  });

  edges.forEach(e => { if (!views.some(v => (v.steps || []).some(s => (s.edges || []).includes(e.id)))) warn('R2', `edges[${e.id}]`, 'Pfeil wird in keinem Schritt benutzt'); });

  // Geometrie: läuft ein Pfeil durch ein fremdes Kästchen, oder verdeckt eine Beschriftung etwas?
  if (!errors.length) {
    const {boxes, routes} = computeLayout(spec);
    const reported = new Set();
    for (const v of views) {
      const visNodes = nodes.filter(n => inView(n, v));
      const visEdges = edges.filter(e => inView(e, v) && inView(nodeById[e.from], v) && inView(nodeById[e.to], v));
      const labels = [];
      for (const e of visEdges) {
        const r = routes[e.id];
        for (const n of visNodes) {
          if (n.id === e.from || n.id === e.to) continue;
          const key = `${e.id}>${n.id}`;
          if (!reported.has(key) && r.pts.slice(1).some((p, i) => segmentHitsBox([r.pts[i], p], boxes[n.id]))) {
            reported.add(key);
            warn('R4', `edges[${e.id}]`, `Pfeil läuft durch "${n.id}" – Kästchen umstellen oder route: "above"/"below" setzen`);
          }
        }
        // alle Texte, die dieser Pfeil in der Ansicht tragen kann
        const texts = [e.verb, ...(v.steps || []).map(s => s.labels?.[e.id]).filter(Boolean)].flatMap(t => typeof t === 'string' ? [t] : [t.simple, t.tech].filter(Boolean));
        const longest = texts.reduce((a, b) => (b.length > a.length ? b : a), '');
        const rect = labelRect(r, longest);
        labels.push([e.id, rect]);
        for (const n of visNodes) {
          const key = `label:${e.id}>${n.id}`;
          if (!reported.has(key) && rectsOverlap(rect, {x: boxes[n.id].x + 2, y: boxes[n.id].y + 2, w: boxes[n.id].w - 4, h: boxes[n.id].h - 4})) {
            reported.add(key);
            warn('R5', `edges[${e.id}]`, `Beschriftung „${longest}“ ragt in "${n.id}" – kürzeres Verb oder mehr Abstand`);
          }
        }
      }
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        const key = `labels:${labels[i][0]}|${labels[j][0]}`;
        if (!reported.has(key) && rectsOverlap(labels[i][1], labels[j][1])) {
          reported.add(key);
          warn('R5', `edges[${labels[i][0]}]`, `Beschriftung überlappt die von "${labels[j][0]}"`);
        }
      }
    }
  }

  return {errors, warnings};
}

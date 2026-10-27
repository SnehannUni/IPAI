// Layout and edge routing – used by the viewer (inlined at build time) and by the validator.
// Grid: zones side by side, each with columns (col) and rows (row).

// Rows are as tall as their tallest box plus GAP_V (room for arrows and labels), at least MIN_ROW.
export const LAYOUT = {MIN_W: 1200, COL_MIN: 280, TOP: 44, GAP_V: 56, MIN_ROW: 120, GAP: 96, MAX_W: 220, PAD: 10};

export const DEFAULT_ZONES = [
  {id: 'frontend', label: {simple: 'YOU', tech: 'FRONTEND'}},
  {id: 'backend', label: {simple: 'OUR SYSTEM', tech: 'BACKEND'}},
  {id: 'external', label: {simple: 'OTHER COMPANIES', tech: 'EXTERNAL'}},
];

// Heights inside a box (matching the viewer CSS): padding 8 + type row 15 + name 20 + subtitle 15 = 58, line 18, padding 8
const HEAD = 58, LINE = 18, BOTTOM = 8;
export function nodeHeight(n) {
  if (n.widget === 'checklist') return Math.min(170, HEAD + 4 + (n.items || []).length * 16 + LINE + BOTTOM);
  if (n.widget === 'meter') return HEAD + 14 + LINE + LINE + BOTTOM;   // Balken, Wertzeile, Statuszeile
  if (n.widget === 'chat') return 140;
  if (n.widget === 'menu') return HEAD + 6 + 8 * 25 + BOTTOM;
  return HEAD + 4 + LINE + BOTTOM;
}

// Estimated text width in px (system font); deliberately generous
export const textWidth = (s, size = 12, bold = false) => [...String(s)].length * size * (bold ? .57 : .52);

// Layout for one view: zones without a visible box are dropped. Inside the remaining zones all boxes count
// (hidden ones too), so that e.g. "Today" and "Planned" have exactly the same positions.
export function computeLayout(spec, viewId) {
  const {MIN_W, COL_MIN, TOP, GAP_V, MIN_ROW, GAP, MAX_W} = LAYOUT;
  const allZones = spec.zones && spec.zones.length ? spec.zones : DEFAULT_ZONES;
  const shown = n => viewId == null || !n.views || n.views.includes(viewId);
  const zones = allZones.filter(z => spec.nodes.some(n => n.zone === z.id && shown(n)));
  const nodes = spec.nodes.filter(n => zones.some(z => z.id === n.zone));
  const edgesById = Object.fromEntries(spec.edges.map(e => [e.id, e]));

  const zoneCols = zones.map(z => Math.max(1, ...nodes.filter(n => n.zone === z.id).map(n => (n.col || 0) + (n.cols || 1))));
  const totalCols = zoneCols.reduce((a, b) => a + b, 0);
  // With many columns the stage gets wider instead of the boxes narrower; the viewer scales to the window width
  const W = Math.max(MIN_W, totalCols * COL_MIN), colW = W / totalCols;
  const zx = {};
  let x0 = 0;
  zones.forEach((z, i) => { zx[z.id] = {x: x0, w: zoneCols[i] * colW}; x0 += zoneCols[i] * colW; });
  // Row heights by content: compact, but never too tight for the tallest box
  const rows = Math.max(1, ...nodes.map(n => (n.row || 0) + (n.rows || 1)));
  const rowH = Array.from({length: rows}, (_, r) =>
    Math.max(MIN_ROW, ...nodes.filter(n => (n.row || 0) === r && (n.rows || 1) === 1).map(n => nodeHeight(n) + GAP_V)));
  const rowTop = [TOP];
  rowH.forEach((h, r) => rowTop.push(rowTop[r] + h));
  const H = rowTop[rows] + 4;

  const boxes = {};
  for (const n of nodes) {
    const z = zx[n.zone] || {x: 0}, cs = n.cols || 1, rs = n.rows || 1, r = n.row || 0;
    const cx = z.x + ((n.col || 0) + cs / 2) * colW;
    const w = Math.min(n.width || MAX_W, cs * colW - GAP);
    // A box spanning several rows fills them except half a row gap at the top and bottom
    const h = rs > 1 ? rowTop[r + rs] - rowTop[r] - GAP_V : nodeHeight(n);
    const cy = (rowTop[r] + rowTop[Math.min(r + rs, rows)]) / 2;
    boxes[n.id] = {x: cx - w / 2, y: cy - h / 2, w, h, cx, cy};
  }

  // Edges between the same pair run in parallel with an offset. Reference direction = first edge of the pair.
  const PAIR_OFF = {1: [0], 2: [-13, 13], 3: [-18, 0, 18], 4: [-24, -8, 8, 24]};
  const pairs = {};
  spec.edges.forEach(e => { const k = [e.from, e.to].sort().join('|'); (pairs[k] = pairs[k] || []).push(e.id); });
  const KINK = 28;   // kinks hit the box above/below its centre, not on the horizontal pair lanes

  function route(e) {
    const S = boxes[e.from], T = boxes[e.to];
    if (!S || !T) return null;
    if (e.from === e.to) {
      const x = S.x + S.w, y = S.cy;
      return {pts: [[x + 2, y - 8], [x + 26, y - 8], [x + 26, y + 8], [x + 4, y + 8]], lab: [x + 30, y + 4], anchor: 'start'};
    }
    const group = pairs[[e.from, e.to].sort().join('|')];
    const off = PAIR_OFF[Math.min(group.length, 4)][Math.min(group.indexOf(e.id), 3)];

    if (e.route === 'above' || e.route === 'below') {
      const dir = Math.sign(T.cx - S.cx) || 1, up = e.route === 'above';
      // Pairs on their own lanes: 35 px away ± offset, so there and back do not overlap
      const lane = (up ? Math.min(S.y, T.y) - 35 : Math.max(S.y + S.h, T.y + T.h) + 35) + off;
      const sx = S.cx + dir * S.w * .2 + off, tx = T.cx - dir * T.w * .2 + off;
      const sy = up ? S.y - 2 : S.y + S.h + 2, ty = up ? T.y - 4 : T.y + T.h + 4;
      return {pts: [[sx, sy], [sx, lane], [tx, lane], [tx, ty]], lab: [(sx + tx) / 2, lane + (up ? -8 : 17)], anchor: 'middle'};
    }

    const first = edgesById[group[0]], A = boxes[first.from], B = boxes[first.to];
    const vOv = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
    const hOv = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
    const kink = e.route === 'h-first' || e.route === 'v-first';
    let pts, lab, anchor = 'middle';
    if (!kink && vOv > 30) {                       // side by side: horizontal
      const y = (Math.max(A.y, B.y) + Math.min(A.y + A.h, B.y + B.h)) / 2 + off, r = B.cx > A.cx;
      pts = [[r ? A.x + A.w : A.x, y], [r ? B.x : B.x + B.w, y]];
      lab = [(pts[0][0] + pts[1][0]) / 2, y + (off > 0 ? 17 : -8)];
    } else if (!kink && hOv > 30) {                // stacked: vertical
      const x = (Math.max(A.x, B.x) + Math.min(A.x + A.w, B.x + B.w)) / 2 + off, d = B.cy > A.cy;
      pts = [[x, d ? A.y + A.h : A.y], [x, d ? B.y : B.y + B.h]];
      anchor = off < 0 ? 'end' : off > 0 ? 'start' : 'middle';
      lab = [x + (off < 0 ? -8 : off > 0 ? 8 : 0), (pts[0][1] + pts[1][1]) / 2 + 4];
    } else if (e.route === 'h-first') {            // offset: horizontal out of A first, then vertical into B
      const r = B.cx > A.cx, d = B.cy > A.cy;
      const y = A.cy + (d ? KINK : -KINK) + off, x = B.cx + (r ? -1 : 1) * B.w * .25 + off;
      pts = [[r ? A.x + A.w : A.x, y], [x, y], [x, d ? B.y : B.y + B.h]];
      lab = [(pts[0][0] + x) / 2, y + (off > 0 ? 17 : -8)];
    } else {                                       // offset (default): vertical out of A first, then horizontal into B
      const r = B.cx > A.cx, d = B.cy > A.cy;
      const x = A.cx + (r ? 1 : -1) * A.w * .25 + off, y = B.cy + (d ? -KINK : KINK) + off;
      pts = [[x, d ? A.y + A.h : A.y], [x, y], [r ? B.x : B.x + B.w, y]];
      lab = [(x + pts[2][0]) / 2, y + (off > 0 ? 17 : -8)];
    }
    if (e.from !== first.from) pts.reverse();
    // Shorten the ends: start 2 px, end 4 px away from the box (room for the arrow head)
    const shorten = (p, q, by) => [p[0] + Math.sign(q[0] - p[0]) * by, p[1] + Math.sign(q[1] - p[1]) * by];
    pts[0] = shorten(pts[0], pts[1], 2);
    pts[pts.length - 1] = shorten(pts[pts.length - 1], pts[pts.length - 2], 4);
    return {pts, lab, anchor};
  }

  const routes = {};
  for (const e of spec.edges) {
    const r = route(e);
    if (r) routes[e.id] = {...r, d: 'M ' + r.pts.map(p => p.join(' ')).join(' L ')};
  }
  return {W, H, TOP, zones, zx, boxes, routes};
}

// Rectangle of an arrow label (same estimate as in the viewer)
export function labelRect(route, text) {
  const w = String(text).length * 6.3 + 10, [x, y] = route.lab;
  const rx = route.anchor === 'start' ? x : route.anchor === 'end' ? x - w : x - w / 2;
  return {x: rx, y: y - 12, w, h: 16};
}

// Does a horizontal/vertical segment cut a rectangle (with a small inset)?
export function segmentHitsBox([a, b], box, inset = 3) {
  const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
  return x2 > box.x + inset && x1 < box.x + box.w - inset && y2 > box.y + inset && y1 < box.y + box.h - inset;
}
export const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Do two segments lie on top of each other (same line, overlapping range)?
export function segmentsOverlap([a, b], [c, d], tol = 5, minLen = 12) {
  const hor1 = a[1] === b[1], hor2 = c[1] === d[1];
  if (hor1 !== hor2) return false;
  if (hor1) {
    if (Math.abs(a[1] - c[1]) > tol) return false;
    return Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) - Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) > minLen;
  }
  if (Math.abs(a[0] - c[0]) > tol) return false;
  return Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) - Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) > minLen;
}

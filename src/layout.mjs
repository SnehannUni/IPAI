// Layout und Kantenführung – wird vom Viewer (eingebettet beim Build) und vom Validator benutzt.
// Raster: Bereiche (zones) nebeneinander, darin Spalten (col) und Zeilen (row).

export const LAYOUT = {MIN_W: 1200, COL_MIN: 280, TOP: 64, PITCH: 200, GAP: 96, MAX_W: 220, PAD: 12};

export const DEFAULT_ZONES = [
  {id: 'frontend', label: {simple: 'DU', tech: 'FRONTEND'}},
  {id: 'backend', label: {simple: 'UNSER SYSTEM', tech: 'BACKEND'}},
  {id: 'external', label: {simple: 'ANDERE FIRMEN', tech: 'EXTERN'}},
];

// Höhen im Kästchen: Rand 10 + Typzeile 15 + Name 20 + Untertitel 16 = 61, Statuszeile 20, Rand 10
const HEAD = 71, LINE = 20;
export function nodeHeight(n) {
  const rs = n.rows || 1;
  if (rs > 1) return (rs - 1) * LAYOUT.PITCH + 150;
  if (n.widget === 'checklist') return Math.min(190, HEAD + 6 + (n.items || []).length * 17 + LINE + 4);
  if (n.widget === 'meter') return HEAD + 14 + LINE + LINE;   // Balken, Wertzeile, Statuszeile
  if (n.widget === 'chat') return 150;
  return 96;
}

// Geschätzte Textbreite in px (Systemschrift); bewusst eher großzügig
export const textWidth = (s, size = 12, bold = false) => [...String(s)].length * size * (bold ? .57 : .52);

export function computeLayout(spec) {
  const {MIN_W, COL_MIN, TOP, PITCH, GAP, MAX_W} = LAYOUT;
  const zones = spec.zones && spec.zones.length ? spec.zones : DEFAULT_ZONES;
  const edgesById = Object.fromEntries(spec.edges.map(e => [e.id, e]));

  const zoneCols = zones.map(z => Math.max(1, ...spec.nodes.filter(n => n.zone === z.id).map(n => (n.col || 0) + (n.cols || 1))));
  const totalCols = zoneCols.reduce((a, b) => a + b, 0);
  // Bei vielen Spalten wird die Bühne breiter statt die Kästchen schmaler; der Viewer skaliert auf die Fensterbreite
  const W = Math.max(MIN_W, totalCols * COL_MIN), colW = W / totalCols;
  const zx = {};
  let x0 = 0;
  zones.forEach((z, i) => { zx[z.id] = {x: x0, w: zoneCols[i] * colW}; x0 += zoneCols[i] * colW; });
  const rows = Math.max(1, ...spec.nodes.map(n => (n.row || 0) + (n.rows || 1)));
  const H = TOP + rows * PITCH + 4;

  const boxes = {};
  for (const n of spec.nodes) {
    const z = zx[n.zone] || {x: 0}, cs = n.cols || 1, rs = n.rows || 1;
    const cx = z.x + ((n.col || 0) + cs / 2) * colW, cy = TOP + ((n.row || 0) + rs / 2) * PITCH;
    const w = Math.min(n.width || MAX_W, cs * colW - GAP), h = nodeHeight(n);
    boxes[n.id] = {x: cx - w / 2, y: cy - h / 2, w, h, cx, cy};
  }

  // Kanten zwischen demselben Paar laufen parallel versetzt. Bezugsrichtung = erste Kante des Paares.
  const PAIR_OFF = {1: [0], 2: [-13, 13], 3: [-18, 0, 18], 4: [-24, -8, 8, 24]};
  const pairs = {};
  spec.edges.forEach(e => { const k = [e.from, e.to].sort().join('|'); (pairs[k] = pairs[k] || []).push(e.id); });
  const KINK = 28;   // Knicke treffen das Kästchen oberhalb/unterhalb der Mitte, nicht auf den waagerechten Paar-Spuren

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
      const lane = (up ? Math.min(S.y, T.y) - 22 : Math.max(S.y + S.h, T.y + T.h) + 22) + (up ? -Math.abs(off) : Math.abs(off));
      const sx = S.cx + dir * S.w * .2 + off, tx = T.cx - dir * T.w * .2 + off;
      const sy = up ? S.y - 2 : S.y + S.h + 2, ty = up ? T.y - 4 : T.y + T.h + 4;
      return {pts: [[sx, sy], [sx, lane], [tx, lane], [tx, ty]], lab: [(sx + tx) / 2, lane + (up ? -8 : 17)], anchor: 'middle'};
    }

    const first = edgesById[group[0]], A = boxes[first.from], B = boxes[first.to];
    const vOv = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
    const hOv = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
    const kink = e.route === 'h-first' || e.route === 'v-first';
    let pts, lab, anchor = 'middle';
    if (!kink && vOv > 30) {                       // nebeneinander: waagerecht
      const y = (Math.max(A.y, B.y) + Math.min(A.y + A.h, B.y + B.h)) / 2 + off, r = B.cx > A.cx;
      pts = [[r ? A.x + A.w : A.x, y], [r ? B.x : B.x + B.w, y]];
      lab = [(pts[0][0] + pts[1][0]) / 2, y + (off > 0 ? 17 : -8)];
    } else if (!kink && hOv > 30) {                // übereinander: senkrecht
      const x = (Math.max(A.x, B.x) + Math.min(A.x + A.w, B.x + B.w)) / 2 + off, d = B.cy > A.cy;
      pts = [[x, d ? A.y + A.h : A.y], [x, d ? B.y : B.y + B.h]];
      anchor = off < 0 ? 'end' : off > 0 ? 'start' : 'middle';
      lab = [x + (off < 0 ? -8 : off > 0 ? 8 : 0), (pts[0][1] + pts[1][1]) / 2 + 4];
    } else if (e.route === 'h-first') {            // versetzt: erst waagerecht aus A, dann senkrecht in B
      const r = B.cx > A.cx, d = B.cy > A.cy;
      const y = A.cy + (d ? KINK : -KINK) + off, x = B.cx + (r ? -1 : 1) * B.w * .25 + off;
      pts = [[r ? A.x + A.w : A.x, y], [x, y], [x, d ? B.y : B.y + B.h]];
      lab = [(pts[0][0] + x) / 2, y + (off > 0 ? 17 : -8)];
    } else {                                       // versetzt (Standard): erst senkrecht aus A, dann waagerecht in B
      const r = B.cx > A.cx, d = B.cy > A.cy;
      const x = A.cx + (r ? 1 : -1) * A.w * .25 + off, y = B.cy + (d ? -KINK : KINK) + off;
      pts = [[x, d ? A.y + A.h : A.y], [x, y], [r ? B.x : B.x + B.w, y]];
      lab = [(x + pts[2][0]) / 2, y + (off > 0 ? 17 : -8)];
    }
    if (e.from !== first.from) pts.reverse();
    // Enden kürzen: Start 2 px, Ende 4 px Abstand zum Kästchen (Platz für die Pfeilspitze)
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

// Rechteck der Pfeilbeschriftung (gleiche Schätzung wie im Viewer)
export function labelRect(route, text) {
  const w = String(text).length * 6.3 + 10, [x, y] = route.lab;
  const rx = route.anchor === 'start' ? x : route.anchor === 'end' ? x - w : x - w / 2;
  return {x: rx, y: y - 12, w, h: 16};
}

// Schneidet eine waagerechte/senkrechte Strecke ein Rechteck (mit kleinem Rand nach innen)?
export function segmentHitsBox([a, b], box, inset = 3) {
  const x1 = Math.min(a[0], b[0]), x2 = Math.max(a[0], b[0]), y1 = Math.min(a[1], b[1]), y2 = Math.max(a[1], b[1]);
  return x2 > box.x + inset && x1 < box.x + box.w - inset && y2 > box.y + inset && y1 < box.y + box.h - inset;
}
export const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Liegen zwei Strecken aufeinander (gleiche Linie, überlappender Bereich)?
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

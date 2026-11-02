// Theme: the colours, font and corners a host gives the viewer so diagrams look like the host's UI.
// Inlined into the viewer at build time (like layout.mjs) and used by the CLI to check a theme file.
// Format and how a host sets it once for all diagrams: docs/FORMAT.md, "theme".

// theme key → CSS variable of the viewer. Only the base colours are needed; the others are mixed from them.
export const THEME_VARS = {
  bg: 'bg', surface: 'surface', text: 'text', accent: 'accent', onAccent: 'on-accent',
  error: 'error', ok: 'ok', mod: 'mod',
  trigger: 'trigger', step: 'step', store: 'store', external: 'external', result: 'result', screen: 'screen',
  soft: 'soft', chip: 'chip', line: 'line', line2: 'line2', faint: 'faint', muted: 'muted', body: 'body',
  errorSoft: 'error-soft', errorLine: 'error-line', errorText: 'error-text',
  okSoft: 'ok-soft', okLine: 'ok-line', okText: 'ok-text',
  modSoft: 'mod-soft', modLine: 'mod-line', modText: 'mod-text',
  font: 'font', radius: 'radius',
  // The parts, for a host whose own controls and cards look different from what the colours above give
  stage: 'stage', zone: 'zone', zoneEdge: 'zone-edge', node: 'node', card: 'card', banner: 'banner',
  button: 'button', buttonText: 'button-text', buttonBorder: 'button-border', buttonHover: 'button-hover',
  segmentOn: 'segment-on', controlRadius: 'control-radius',
  // Play: the accent by default; a host whose accent is its one action per screen gives it a quieter colour
  primary: 'primary', onPrimary: 'on-primary',
  // The labels' voice: font, case (uppercase, none) and letter spacing
  labelFont: 'label-font', labelTransform: 'label-transform', labelTracking: 'label-tracking',
};
// Lengths: a number is px
const LENGTHS = ['radius', 'controlRadius', 'labelTracking'];
export const THEME_SCHEMES = ['light', 'dark'];

// A value lands inside a CSS declaration: no characters that could end it or open another rule
const SAFE = /^[^;{}<>\\]*$/;

// Problems of a theme, as messages; an empty list means it can be used
export function checkTheme(theme) {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return ['theme must be an object'];
  const problems = [];
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'scheme') { if (!THEME_SCHEMES.includes(value)) problems.push(`scheme must be ${THEME_SCHEMES.join(' or ')}`); continue; }
    if (!(key in THEME_VARS)) { problems.push(`unknown key "${key}" (${Object.keys(THEME_VARS).join(', ')}, scheme)`); continue; }
    const length = LENGTHS.includes(key);
    if (length ? typeof value !== 'number' && typeof value !== 'string' : typeof value !== 'string') problems.push(`${key} must be a ${length ? 'number of px or a CSS length' : 'string'}`);
    else if (!SAFE.test(String(value))) problems.push(`${key} contains ; { } < > or \\`);
  }
  return problems;
}

// The CSS declarations for a theme; unknown keys and unsafe values are left out
export function themeDeclarations(theme) {
  const out = [];
  if (!theme || typeof theme !== 'object') return out;
  for (const [key, value] of Object.entries(theme)) {
    if (key === 'scheme' && THEME_SCHEMES.includes(value)) { out.push(['color-scheme', value]); continue; }
    const name = THEME_VARS[key];
    if (!name || value == null || !SAFE.test(String(value))) continue;
    out.push(['--' + name, LENGTHS.includes(key) && typeof value === 'number' ? value + 'px' : String(value)]);
  }
  return out;
}

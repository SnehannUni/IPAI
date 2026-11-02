import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const file = name => fileURLToPath(new URL(name, import.meta.url));
// "</" would end the <script> tag early
const scriptJson = value => JSON.stringify(value, null, 2).replace(/<\//g, '<\\/');

// Builds a self-contained HTML file from a flow spec (viewer + layout + theme + data, no external dependencies).
// `theme` (docs/FORMAT.md, "theme") is written into the page; a host can also add its own later.
export function buildHtml(spec, {theme} = {}) {
  const template = readFileSync(file('./viewer.html'), 'utf8');
  const inline = name => readFileSync(file(name), 'utf8').replace(/^export /gm, '');
  return template
    .replace('/*__LAYOUT__*/', () => inline('./layout.mjs'))
    .replace('/*__THEME__*/', () => inline('./theme.mjs'))
    .replace('__THEME_BLOCK__', () => theme ? themeBlock(theme) : '')
    .replace('__FLOW_SPEC__', () => scriptJson(spec));
}

// The block a host inserts into a built page, right before the flow spec, to set its theme without rebuilding;
// blocks are read in page order and later ones win
export function themeBlock(theme) {
  return `<script type="application/json" data-ipai-theme>${scriptJson(theme)}</script>`;
}

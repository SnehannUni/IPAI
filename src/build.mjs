import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const file = name => fileURLToPath(new URL(name, import.meta.url));

// Builds a self-contained HTML file from a flow spec (viewer + layout + data, no external dependencies).
export function buildHtml(spec) {
  const template = readFileSync(file('./viewer.html'), 'utf8');
  const layout = readFileSync(file('./layout.mjs'), 'utf8').replace(/^export /gm, '');
  // "</" would end the <script> tag early
  const json = JSON.stringify(spec, null, 2).replace(/<\//g, '<\\/');
  return template.replace('/*__LAYOUT__*/', () => layout).replace('__FLOW_SPEC__', () => json);
}

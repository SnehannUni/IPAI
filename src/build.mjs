import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const file = name => fileURLToPath(new URL(name, import.meta.url));

// Baut aus einer Flow-Spec eine eigenständige HTML-Datei (Viewer + Layout + Daten, keine externen Abhängigkeiten).
export function buildHtml(spec) {
  const template = readFileSync(file('./viewer.html'), 'utf8');
  const layout = readFileSync(file('./layout.mjs'), 'utf8').replace(/^export /gm, '');
  // "</" würde das <script>-Tag vorzeitig beenden
  const json = JSON.stringify(spec, null, 2).replace(/<\//g, '<\\/');
  return template.replace('/*__LAYOUT__*/', () => layout).replace('__FLOW_SPEC__', () => json);
}

#!/usr/bin/env node
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {basename, dirname} from 'node:path';
import {validateSpec} from '../src/validate.mjs';
import {buildHtml} from '../src/build.mjs';

const USAGE = `flowviz – animierte Ablauf-Diagramme aus einer Flow-Spec

  flowviz validate <datei.flow.json> …        Fehler und Regelverstöße anzeigen
  flowviz build <datei.flow.json> [-o out.html] HTML bauen (bricht bei Fehlern ab)

Regeln: docs/REGELN.md · Format: docs/FORMAT.md`;

function load(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.error(`✗ ${file}: ${e.message}`); process.exit(1); }
}

function report(file, {errors, warnings}) {
  for (const e of errors) console.error(`  Fehler   ${e}`);
  for (const w of warnings) console.warn(`  Regel    ${w}`);
  const status = errors.length ? '✗' : '✓';
  console.log(`${status} ${basename(file)}: ${errors.length} Fehler, ${warnings.length} Regelhinweise`);
}

const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'validate' && args.length) {
  let failed = false;
  for (const file of args) {
    const result = validateSpec(load(file));
    report(file, result);
    failed ||= result.errors.length > 0;
  }
  process.exit(failed ? 1 : 0);
} else if (cmd === 'build' && args.length) {
  const file = args[0];
  const oi = args.indexOf('-o');
  const out = oi > -1 ? args[oi + 1] : file.replace(/(\.flow)?\.json$/, '') + '.html';
  const spec = load(file);
  const result = validateSpec(spec);
  report(file, result);
  if (result.errors.length) process.exit(1);
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, buildHtml(spec));
  console.log(`→ ${out}`);
} else {
  console.log(USAGE);
  process.exit(cmd ? 1 : 0);
}

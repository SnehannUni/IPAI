#!/usr/bin/env node
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {basename, dirname} from 'node:path';
import {validateSpec} from '../src/validate.mjs';
import {buildHtml} from '../src/build.mjs';
import {checkTheme} from '../src/theme.mjs';

const USAGE = `flowviz – animated flow diagrams from a flow spec

  flowviz validate <file.flow.json> …         show errors and rule violations
  flowviz build <file.flow.json> [-o out.html] [--theme theme.json]
                                              build HTML (stops on errors), in a host's colours

Rules: docs/RULES.md · Format and theme: docs/FORMAT.md`;

function load(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.error(`✗ ${file}: ${e.message}`); process.exit(1); }
}

function report(file, {errors, warnings}) {
  for (const e of errors) console.error(`  error    ${e}`);
  for (const w of warnings) console.warn(`  rule     ${w}`);
  const status = errors.length ? '✗' : '✓';
  console.log(`${status} ${basename(file)}: ${errors.length} errors, ${warnings.length} rule hints`);
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
  const ti = args.indexOf('--theme');
  const theme = ti > -1 ? load(args[ti + 1]) : undefined;
  const problems = theme ? checkTheme(theme) : [];
  for (const t of problems) console.error(`  theme    ${t}`);
  if (problems.length) process.exit(1);
  const spec = load(file);
  const result = validateSpec(spec);
  report(file, result);
  if (result.errors.length) process.exit(1);
  mkdirSync(dirname(out), {recursive: true});
  writeFileSync(out, buildHtml(spec, {theme}));
  console.log(`→ ${out}`);
} else {
  console.log(USAGE);
  process.exit(cmd ? 1 : 0);
}

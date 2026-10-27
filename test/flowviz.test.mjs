import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import vm from 'node:vm';
import {validateSpec} from '../src/validate.mjs';
import {buildHtml} from '../src/build.mjs';

const load = name => JSON.parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
const examples = readdirSync(new URL('../examples/', import.meta.url)).filter(f => f.endsWith('.flow.json'));
const clone = x => structuredClone(x);
const hasRule = (warnings, id) => warnings.some(w => w.startsWith(id + ' '));

for (const name of examples) {
  test(`${name}: keine Fehler, keine Regelhinweise`, () => {
    const {errors, warnings} = validateSpec(load(name));
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  });

  test(`${name}: Build ist eigenständig und lauffähig`, () => {
    const html = buildHtml(load(name));
    assert.ok(!html.includes('__FLOW_SPEC__') && !html.includes('/*__LAYOUT__*/'), 'Platzhalter ersetzt');
    assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(html), 'keine externen Dateien');
    const json = html.match(/<script type="application\/json" id="flow-spec">([\s\S]*?)<\/script>/)[1];
    assert.deepEqual(JSON.parse(json), load(name));
    const code = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
    assert.doesNotThrow(() => new vm.Script(code), 'Viewer-Skript ist gültiges JavaScript');
  });
}

test('Build entschärft </script> in Texten', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.title = 'a</script><b>';
  const html = buildHtml(spec);
  assert.ok(html.includes('a<\\/script><b>'));
});

test('Fehler: unbekannter Pfeil im Schritt', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps[0].edges = ['gibtsnicht'];
  assert.ok(validateSpec(spec).errors.some(e => e.includes('gibtsnicht')));
});

test('Fehler: zwei Kästchen auf demselben Platz', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.nodes.find(n => n.id === 'kube').row = 0;
  assert.ok(validateSpec(spec).errors.some(e => e.includes('demselben Platz')));
});

test('R4: Pfeil durch ein Kästchen wird erkannt', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  delete spec.edges.find(e => e.id === 'wy').route;   // läuft dann quer durch die Warteliste
  const {warnings} = validateSpec(spec);
  assert.ok(warnings.some(w => w.startsWith('R4') && w.includes('queue')), warnings.join('\n'));
});

test('R7: zu langer Schritt-Text', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps[0].text = {simple: 'wort '.repeat(30), tech: 'x'};
  assert.ok(hasRule(validateSpec(spec).warnings, 'R7'));
});

test('R10: Sprung – Kästchen handelt, ohne eingeführt zu sein', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps.splice(4, 1);   // Schritt "Update kommt" (focus kube) entfernen
  spec.views[0].steps.forEach(s => { if (s.chain != null) s.chain = Math.max(0, s.chain - 1); });
  assert.ok(hasRule(validateSpec(spec).warnings, 'R10'));
});

test('R12: Bug ohne Ursachenkette', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  delete spec.views[0].chain;
  spec.views[0].steps.forEach(s => delete s.chain);
  assert.ok(hasRule(validateSpec(spec).warnings, 'R12'));
});

test('R13: Lösung ohne markierte Änderung', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[1].steps.forEach(s => delete s.tag);
  assert.ok(hasRule(validateSpec(spec).warnings, 'R13'));
});

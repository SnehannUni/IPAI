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
  test(`${name}: no errors, no rule hints`, () => {
    const {errors, warnings} = validateSpec(load(name));
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
  });

  test(`${name}: build is self-contained and runnable`, () => {
    const html = buildHtml(load(name));
    assert.ok(!html.includes('__FLOW_SPEC__') && !html.includes('/*__LAYOUT__*/'), 'placeholders replaced');
    assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(html), 'no external files');
    const json = html.match(/<script type="application\/json" id="flow-spec">([\s\S]*?)<\/script>/)[1];
    assert.deepEqual(JSON.parse(json), load(name));
    const code = html.match(/<script>\r?\n([\s\S]*?)<\/script>/)[1];
    assert.doesNotThrow(() => new vm.Script(code), 'viewer script is valid JavaScript');
  });
}

test('build escapes </script> in texts', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.title = 'a</script><b>';
  const html = buildHtml(spec);
  assert.ok(html.includes('a<\\/script><b>'));
});

test('error: unknown arrow in a step', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps[0].edges = ['gibtsnicht'];
  assert.ok(validateSpec(spec).errors.some(e => e.includes('gibtsnicht')));
});

test('error: two boxes in the same cell', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.nodes.find(n => n.id === 'kube').row = 0;
  assert.ok(validateSpec(spec).errors.some(e => e.includes('same cell')));
});

test('R4: arrow through a box is detected', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  delete spec.edges.find(e => e.id === 'wy').route;   // then runs straight through the queue
  const {warnings} = validateSpec(spec);
  assert.ok(warnings.some(w => w.startsWith('R4') && w.includes('queue')), warnings.join('\n'));
});

test('R7: step text too long', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps[0].text = {simple: 'word '.repeat(30), tech: 'x'};
  assert.ok(hasRule(validateSpec(spec).warnings, 'R7'));
});

test('R10: jump – a box acts without being introduced', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps.splice(4, 1);   // remove the step "update arrives" (focus kube)
  spec.views[0].steps.forEach(s => { if (s.chain != null) s.chain = Math.max(0, s.chain - 1); });
  assert.ok(hasRule(validateSpec(spec).warnings, 'R10'));
});

test('R12: bug without a cause chain', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  delete spec.views[0].chain;
  spec.views[0].steps.forEach(s => delete s.chain);
  assert.ok(hasRule(validateSpec(spec).warnings, 'R12'));
});

test('R13: solution without a marked change', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[1].steps.forEach(s => delete s.tag);
  assert.ok(hasRule(validateSpec(spec).warnings, 'R13'));
});

test('R3: badge too long is detected (space in the box)', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps[5].set.worker.badge = {simple: 'stopped in the middle of work', tech: 'killed'};
  assert.ok(validateSpec(spec).warnings.some(w => w.startsWith('R3') && w.includes('badge')));
});

test('R4: arrows lying on top of each other are detected', () => {
  const tiny = {
    title: 't',
    nodes: [
      {id: 'a', type: 'trigger', zone: 'frontend', label: 'A'},
      {id: 'b', type: 'step', zone: 'backend', col: 0, label: 'B'},
      {id: 'c', type: 'result', zone: 'backend', col: 1, label: 'C'},
    ],
    edges: [{id: 'ab', from: 'a', to: 'b', verb: 'x'}, {id: 'ac', from: 'a', to: 'c', verb: 'y'}],
    views: [{id: 'v', steps: [{edges: ['ab'], text: 'a'}, {edges: ['ac'], text: 'b'}]}],
  };
  const {warnings} = validateSpec(tiny);
  assert.ok(warnings.some(w => w.startsWith('R4') && w.includes('lies on')), warnings.join('\n'));
});

test('R2: arrow visible in a view but unused there', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  delete spec.edges.find(e => e.id === 'wq').showUnused;
  assert.ok(validateSpec(spec).warnings.some(w => w.startsWith('R2') && w.includes('"wq"')));
});

test('R14: solution ends without a good result', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  delete spec.views[1].steps.at(-1).set;
  assert.ok(hasRule(validateSpec(spec).warnings, 'R14'));
});

test('R7: abbreviations do not count as sentence ends', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps[0].text = {simple: 'A loss of $3.5 bn. on Aug. 1, 2012. Then it was over.', tech: 'Approx. 4 M orders, e.g. in 154 stocks, i.e. vs. the plan.'};
  assert.ok(!hasRule(validateSpec(spec).warnings, 'R7'));
  spec.views[0].steps[0].text = {simple: 'One. Two. Three.', tech: 'x'};
  assert.ok(hasRule(validateSpec(spec).warnings, 'R7'));
});

test('messages count steps from 1 ("step 3")', () => {
  const spec = clone(load('k8s-bugfix.flow.json'));
  spec.views[0].steps[2].edges = ['gibtsnicht'];
  assert.ok(validateSpec(spec).errors.some(e => e.includes('step 3')));
});

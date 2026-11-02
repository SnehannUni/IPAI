import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import vm from 'node:vm';
import {validateSpec} from '../src/validate.mjs';
import {buildHtml, themeBlock} from '../src/build.mjs';
import {computeLayout} from '../src/layout.mjs';
import {checkTheme, themeDeclarations, THEME_VARS} from '../src/theme.mjs';

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

test('R7: German abbreviations and capitals', () => {
  const spec = clone(load('sidebar-demo.flow.json'));
  spec.views[0].steps[1].text = {simple: 'Die Seite schickt z.B. die Wahl, bzw. den Stand usw. weiter.', tech: 'x'};
  assert.ok(!hasRule(validateSpec(spec).warnings, 'R7'));
  spec.views[0].steps[1].text = {simple: 'Eins. Ärger. Über alles.', tech: 'x'};
  assert.ok(hasRule(validateSpec(spec).warnings, 'R7'));
});

test('lang and colours are checked', () => {
  const spec = clone(load('sidebar-demo.flow.json'));
  spec.lang = 'fr';
  spec.nodes[0].color = 'url(x)';
  const {errors} = validateSpec(spec);
  assert.ok(errors.some(e => e.startsWith('lang')));
  assert.ok(errors.some(e => e.includes('color')));
  spec.lang = 'en'; spec.nodes[0].color = '#4f46e5';
  assert.deepEqual(validateSpec(spec).errors, []);
});

test('demo: on needs an element with that data-ipai', () => {
  const spec = clone(load('sidebar-demo.flow.json'));
  spec.views[0].steps[0].on = 'gibtsnicht';
  assert.ok(validateSpec(spec).errors.some(e => e.includes('data-ipai="gibtsnicht"')));
});

test('demo: arrow ends must exist, scripts and external files are refused', () => {
  const spec = clone(load('sidebar-demo.flow.json'));
  spec.edges[0].from = '@gibtsnicht';
  spec.edges[1].from = '@toggle';
  spec.demo.html += '<script>alert(1)</script><img src="https://x.test/a.png">';
  const {errors} = validateSpec(spec);
  assert.ok(errors.some(e => e.includes('data-ipai="gibtsnicht"')));
  assert.ok(errors.some(e => e.includes('one end must be a box')));
  assert.ok(errors.some(e => e.includes('no scripts')));
  assert.ok(errors.some(e => e.includes('no external files')));
  const onclick = clone(load('sidebar-demo.flow.json'));
  onclick.demo.html = onclick.demo.html.replace("data-ipai='reload'", "data-ipai='reload' onclick='x()'");
  assert.ok(validateSpec(onclick).errors.some(e => e.includes('no scripts')));
});

test('R17: unused elements, unstyled states, a click that starts elsewhere', () => {
  const spec = clone(load('sidebar-demo.flow.json'));
  const steps = spec.views[0].steps;
  spec.demo.html += "<i data-ipai='extra'></i>";
  steps[3].demo = 'collapsed blinking';
  steps[0].edges = ['db'];
  const {warnings} = validateSpec(spec);
  assert.ok(warnings.some(w => w.startsWith('R17') && w.includes('"extra" is neither clicked')), warnings.join('\n'));
  assert.ok(warnings.some(w => w.startsWith('R17') && w.includes('"blinking"')));
  assert.ok(warnings.some(w => w.startsWith('R17') && w.includes('leave "@toggle"')));
});

test('R17: a view with a demo starts with a click, changes the demo and has arrows at it', () => {
  const spec = clone(load('sidebar-demo.flow.json'));
  const steps = spec.views[0].steps;
  steps.unshift({focus: 'api', text: {simple: 'Die Seite ist offen.', tech: 'Die App ist geladen.'}});
  for (const s of steps) delete s.demo;
  const {warnings} = validateSpec(spec);
  assert.ok(warnings.some(w => w.startsWith('R17') && w.includes('first step starts with a click')));
  assert.ok(warnings.some(w => w.startsWith('R17') && w.includes('never changes')));
  const plain = clone(load('sidebar-demo.flow.json'));
  plain.views[0].steps = plain.views[0].steps.map(s => ({...s, edges: (s.edges || []).filter(id => id === 'db')}));
  assert.ok(validateSpec(plain).warnings.some(w => w.startsWith('R17') && w.includes('no arrow leaves or reaches the demo')));
});

test('demo: the demo is the first zone, the system stands beside it', () => {
  const spec = load('sidebar-demo.flow.json');
  const L = computeLayout(spec, 'planned');
  assert.equal(L.zones[0].id, '@demo');
  assert.ok(L.boxes.api.x > L.demo.x + L.demo.w, 'boxes right of the demo');
  assert.ok(L.H >= L.demo.y + L.demo.h, 'stage as tall as the demo');
  assert.ok(L.routes.save.demo && L.routes.save.pts[0][0] < L.demo.x + L.demo.w, 'arrow starts inside the demo');
  const measured = computeLayout(spec, 'planned', {'@toggle': {x: 60, y: 120, w: 20, h: 20}});
  assert.deepEqual(measured.routes.save.pts[0], [82, 130]);
});

test('demo: a view can hide the demo, and then on is an error', () => {
  const spec = clone(load('sidebar-demo.flow.json'));
  spec.views[0].demo = false;
  assert.ok(validateSpec(spec).errors.some(e => e.includes('on needs a demo')));
});

test('demo: the build keeps the mock out of the viewer page and inside the spec', () => {
  const html = buildHtml(load('sidebar-demo.flow.json'));
  assert.ok(html.includes('attachShadow'));
  const json = html.match(/<script type="application\/json" id="flow-spec">([\s\S]*?)<\/script>/)[1];
  assert.ok(JSON.parse(json).demo.html.includes("data-ipai='toggle'"));
});

test('theme: keys and values are checked', () => {
  assert.deepEqual(checkTheme({scheme: 'dark', surface: '#11161d', accent: 'rgb(45 212 191)', radius: 14}), []);
  const problems = checkTheme({colour: 'red', accent: 'red;}body{display:none', radius: true, scheme: 'blue'});
  assert.ok(problems.some(p => p.includes('unknown key "colour"')));
  assert.ok(problems.some(p => p.startsWith('accent contains')));
  assert.ok(problems.some(p => p.startsWith('radius must be')));
  assert.ok(problems.some(p => p.startsWith('scheme must be')));
});

test('theme: declarations name the viewer variables and drop what could break out', () => {
  assert.deepEqual(themeDeclarations({onAccent: '#000', radius: 12, scheme: 'dark', accent: 'x;y', nope: '#fff'}),
    [['--on-accent', '#000'], ['--radius', '12px'], ['color-scheme', 'dark']]);
});

test('theme: the parts are settable and every key names a variable the viewer uses', () => {
  assert.deepEqual(themeDeclarations({stage: '#1e2120', zoneEdge: '#232625', buttonText: '#fff', controlRadius: 8}),
    [['--stage', '#1e2120'], ['--zone-edge', '#232625'], ['--button-text', '#fff'], ['--control-radius', '8px']]);
  const viewer = readFileSync(new URL('../src/viewer.html', import.meta.url), 'utf8');
  const unused = Object.keys(THEME_VARS).filter(k => !viewer.includes(`var(--${THEME_VARS[k]})`));
  assert.deepEqual(unused, []);
});

test('theme: the build writes the block, a host can add its own, the viewer reads every one', () => {
  const plain = buildHtml(load('sidebar-demo.flow.json'));
  assert.ok(!plain.includes('data-ipai-theme>') && !plain.includes('__THEME'), 'no theme, no block, no placeholder');
  const themed = buildHtml(load('sidebar-demo.flow.json'), {theme: {accent: '#0f766e'}});
  assert.ok(themed.includes('<script type="application/json" data-ipai-theme>'));
  assert.ok(themeBlock({font: 'a</script>'}).includes('a<\\/script>'), 'a value cannot end the block');
  assert.ok(plain.includes("querySelectorAll('script[data-ipai-theme]')"));
});

test('theme: no colour is left hard-coded in the viewer outside the defaults', () => {
  const viewer = readFileSync(new URL('../src/viewer.html', import.meta.url), 'utf8');
  const css = viewer.slice(viewer.indexOf('<style>'), viewer.indexOf('</style>'));
  const rest = css.replace(/:root\{[\s\S]*?\n\}/, '').replace(/\.win\.phone\{[^}]*\}/, '');
  assert.deepEqual(rest.match(/#[0-9a-fA-F]{3,8}\b/g) || [], []);
});

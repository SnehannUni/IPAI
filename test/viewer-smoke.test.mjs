// Lässt das Viewer-Skript für jede Ansicht und jeden Schritt einmal laufen (per #view=…&step=…).
// Statt eines Browsers dient ein nachgiebiges Schein-DOM: Jeder Zugriff liefert wieder ein Schein-Objekt.
// Das findet Laufzeitfehler in der Logik (Tippfehler, falsche Reihenfolge, Fehler im Zustand) – nicht im Aussehen.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import vm from 'node:vm';
import {buildHtml} from '../src/build.mjs';

function fakeDom(specJson) {
  const make = () => {
    const fn = function () { return proxy; };
    const store = {};
    const proxy = new Proxy(fn, {
      get(_, k) {
        if (k in store) return store[k];
        if (k === Symbol.toPrimitive) return () => 0;
        if (k === Symbol.iterator) return function* () {};
        if (k === 'then') return undefined;
        if (k === 'length' || k === 'childElementCount') return 0;
        if (k === 'getTotalLength') return () => 100;
        if (k === 'getPointAtLength') return () => ({x: 0, y: 0});
        return store[k] = make();
      },
      set(_, k, v) { store[k] = v; return true; },
      apply() { return make(); },
    });
    return proxy;
  };
  const document = make();
  const spec = {textContent: specJson};
  document.getElementById = id => id === 'flow-spec' ? spec : make();
  return document;
}

const files = readdirSync(new URL('../examples/', import.meta.url)).map(f => new URL(`../examples/${f}`, import.meta.url))
  .concat(readdirSync(new URL('../flows/', import.meta.url)).filter(f => f.endsWith('.flow.json')).map(f => new URL(`../flows/${f}`, import.meta.url)));

for (const file of files.filter(f => f.pathname.endsWith('.flow.json'))) {
  const spec = JSON.parse(readFileSync(file, 'utf8'));
  const html = buildHtml(spec);
  const code = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
  const script = new vm.Script(code);
  test(`Viewer läuft durch alle Schritte: ${file.pathname.split('/').pop()}`, () => {
    for (const view of spec.views) for (let step = 0; step <= view.steps.length; step++) for (const mode of ['', '&mode=tech']) {
      const context = {
        document: fakeDom(JSON.stringify(spec)),
        location: {hash: `#view=${view.id}&step=${step}&still${mode}`},
        URLSearchParams, ResizeObserver: class { observe() {} },
        requestAnimationFrame: () => 0, setTimeout: () => 0, performance: {now: () => 0}, console,
      };
      assert.doesNotThrow(() => script.runInNewContext(context), `${view.id} Schritt ${step}${mode}`);
    }
  });
}

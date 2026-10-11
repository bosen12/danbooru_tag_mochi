// User-selected supplemental kinds must govern all random additions.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { indexLexicon, sanitizeSettings, defaultSettings, drawOne, mulberry32, SKELETON, skeletonLit, supplementKindKeys } from '../web/engine.js';
const root = resolve(import.meta.dirname, '..');
const data = JSON.parse(readFileSync(resolve(root, 'web/lexicon.json'), 'utf8'));
const lex = indexLexicon(data), base = defaultSettings(data);
const failures = [];
function test(name, fn) { try { fn(); console.log('PASS ' + name); } catch (e) { failures.push(name); console.error('FAIL ' + name + ': ' + e.message); } }
const settings = patch => sanitizeSettings({ ...base, rating: 'explicit', heats: ['sex'], ...patch, counts: { feature: 0, clothing: 0, pose: 0, env: 0, ...patch?.counts } }, data);
const choose = (s, section, key) => ({ ...s, offGroups: SKELETON[section].map(([g]) => `${section}:${g}`).filter(k => k !== key) });
const draw = (s, seed, pins = []) => drawOne(lex, s, new Set(pins), new Set(), mulberry32(seed), seed, { trace: true });
const randomItems = (d, section) => d.trace.kept.filter(k => ['random', 'era_anchor', 'repair'].includes(k.source)).map(k => lex.byTag.get(k.tag)).filter(x => x?.section === section);

test('only expression means no random sex, exposure or other poses', () => {
  for (const heat of ['sex', 'flash', 'tease']) for (let seed = 900; seed < 940; seed++) {
    const s = choose(settings({ heats: [heat], counts: { pose: 1 } }), 'pose', 'pose:face');
    const d = draw(s, seed);
    assert.ok(randomItems(d, 'pose').every(x => x.group === 'face'), `seed ${seed} ${heat}: ${randomItems(d, 'pose').map(x => x.tag)}`);
    assert.ok(d.sections.pose.some(t => lex.byTag.get(t)?.group === 'face'), 'selected expression is filled');
  }
});
test('new pose kinds can be selected and survive settings sanitization', () => {
  for (const kind of ['tease', 'flash', 'sex']) {
    assert.ok(SKELETON.pose.some(([g]) => g === kind), kind);
    const s = sanitizeSettings(choose(settings({ counts: { pose: 1 } }), 'pose', `pose:${kind}`), data);
    assert.deepEqual(skeletonLit(s, 'pose'), [`pose:${kind}`]);
    let hits = 0;
    for (let seed = 900; seed < 925; seed++) {
      const d = draw({ ...s, heats: [kind] }, seed);
      const items = randomItems(d, 'pose');
      assert.ok(items.every(x => x.group === kind));
      if (items.length) hits++;
    }
    assert.ok(hits > 0, kind + ' must be reachable');
  }
});
test('outerwear-only does not add random nude or other garments', () => {
  const s = choose(settings({ counts: { clothing: 1 } }), 'clothing', 'clothing:outer');
  for (let seed = 900; seed < 940; seed++) assert.ok(randomItems(draw(s, seed), 'clothing').every(x => x.group === 'outer' || x.group === 'era' && x.mutex === 'outer'));
});
test('one body-type choice works for male-only figures', () => {
  const s = choose(settings({ heats: ['tease'], girl: false, boy: true, counts: { feature: 1 } }), 'feature', 'feature:body_f');
  let hits = 0;
  for (let seed = 900; seed < 930; seed++) {
    const items = randomItems(draw(s, seed), 'feature');
    assert.ok(items.every(x => ['body_f', 'body_m'].includes(x.group)));
    if (items.some(x => x.group === 'body_m')) hits++;
  }
  assert.ok(hits > 0);
});
test('explicit job selection works; unchecked job does not bypass other kinds', () => {
  const s = choose(settings({ heats: ['tease'], counts: { feature: 1 } }), 'feature', 'feature:job');
  assert.deepEqual(skeletonLit(s, 'feature'), ['feature:job']);
  let hits = 0;
  for (let seed = 900; seed < 925; seed++) if (randomItems(draw(s, seed), 'feature').some(x => x.group === 'job')) hits++;
  assert.ok(hits > 0);
  const eyes = choose({ ...s, drawJob: true }, 'feature', 'feature:eyes');
  assert.ok(randomItems(draw(eyes, 900), 'feature').every(x => x.group === 'eyes'));
});
test('weather-only does not randomly supplement props or lens effects', () => {
  const s = choose(settings({ heats: ['tease'], counts: { env: 1 } }), 'env', 'env:weather');
  assert.deepEqual(skeletonLit(s, 'env'), ['env:weather']);
  for (let seed = 900; seed < 940; seed++) assert.ok(randomItems(draw(s, seed), 'env').every(x => x.group === 'weather' || x.group === 'other' && x.sub === 'weather'));
});
test('props and lens effects have separate choices', () => {
  for (const k of ['props', 'lens', 'theme', 'effect', 'furniture', 'background', 'sky']) assert.ok(SKELETON.env.some(([g]) => g === k), k);
  const s = choose(settings({ heats: ['tease'], counts: { env: 1 } }), 'env', 'env:lens');
  for (let seed = 900; seed < 925; seed++) assert.ok(randomItems(draw(s, seed), 'env').every(x => x.group === 'other' && x.sub === 'fx_lens'));
});
test('pinned actions and their necessary dependencies are retained', () => {
  const s = choose(settings({ counts: { pose: 1 } }), 'pose', 'pose:face');
  const d = draw(s, 900, ['1girl', '1boy', 'sex']);
  assert.ok(d.sections.pose.includes('sex'));
  const crying = draw(settings({ counts: { pose: 0 } }), 901, ['crying']);
  assert.ok(crying.sections.pose.includes('crying'));
  assert.ok(crying.sections.feature.includes('tears'));
  const weather = choose(settings({ heats: ['tease'], counts: { env: 1 } }), 'env', 'env:weather');
  const fishing = draw(weather, 900, ['fishing']);
  assert.ok(fishing.sections.env.includes('fishing rod'), 'pinned fishing retains its necessary rod');
  const required = draw({ ...weather, mustDraw: { 'pose:activity': 1 } }, 900);
  assert.ok(required.trace.kept.some(x => x.source === 'must_draw'), 'required draw bypasses the selected kinds');
});
test('selected nudity has legal candidates outside sex and bath scenes', () => {
  for (const heat of ['tease', 'flash']) {
    const s = choose(settings({ heats: [heat], counts: { clothing: 1 } }), 'clothing', 'clothing:nude');
    for (let seed = 900; seed < 906; seed++) {
      assert.ok(randomItems(draw(s, seed), 'clothing').some(x => x.group === 'nude'), `${heat} seed ${seed} fills nudity`);
    }
  }
});
test('selected race is attempted without a probability gate', () => {
  const s = choose(settings({ sceneMode: 'diverse', heats: ['tease'], counts: { feature: 1 } }), 'feature', 'feature:race');
  for (let seed = 900; seed < 906; seed++) assert.ok(randomItems(draw(s, seed), 'feature').some(x => x.group === 'race'), `seed ${seed} fills race`);
});
test('one accessory kind adds at most one random accessory', () => {
  const s = choose(settings({ sceneMode: 'diverse', heats: ['tease'], girl: true, boy: true, counts: { clothing: 1 } }), 'clothing', 'clothing:acc');
  for (let seed = 900; seed < 940; seed++) {
    const items = randomItems(draw(s, seed), 'clothing');
    assert.ok(items.length <= 1, `seed ${seed}: ${items.map(x => x.tag)}`);
  }
});
test('every selectable kind is reachable and limits its direct random additions', () => {
  for (const [section, slots] of Object.entries(SKELETON)) for (const [kind] of slots) {
    const key = `${section}:${kind}`;
    const heat = section === 'pose' && ['flash', 'sex'].includes(kind) ? kind : 'tease';
    const s = choose(settings({ sceneMode: 'diverse', heats: [heat], counts: { [section]: 1 } }), section, key);
    let hits = 0;
    for (let seed = 900; seed < 920; seed++) {
      const d = draw(s, seed), items = randomItems(d, section);
      assert.ok(items.every(x => supplementKindKeys(x).includes(key)), `${key} seed ${seed}: ${items.map(x => x.tag)}`);
      assert.ok(items.length <= 1, `${key} seed ${seed} adds extra roots`);
      if (items.length) hits++;
      const noTrace = drawOne(lex, s, new Set(), new Set(), mulberry32(seed), seed);
      assert.equal(d.positive, noTrace.positive, `${key} trace must not affect drawing`);
    }
    assert.ok(hits > 0, `${key} must have a reachable candidate`);
  }
});
test('default free supplementation preserves previous seeded recipes', () => {
  const fixture = JSON.parse(readFileSync(resolve(import.meta.dirname, 'supplement_baseline.json'), 'utf8'));
  for (const row of fixture) {
    const s = sanitizeSettings({ ...base, rating: 'explicit', heats: [row.heat] }, data);
    assert.equal(draw(s, row.seed).positive, row.positive, `seed ${row.seed} ${row.heat}`);
  }
});
assert.deepEqual(failures, [], 'supplement contracts');

// Behavior tests for composition handoff and readable candidate summaries.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const root = resolve(import.meta.dirname, '..');
const web = existsSync(resolve(root, 'web6')) ? 'web6' : 'web';
const { candidateSummary } = await import(pathToFileURL(resolve(root, web, 'composition.js')));
const startersModule = resolve(root, web, 'starters.js');
assert.ok(existsSync(startersModule), 'Both workspaces share the existing Fuse starter catalog and picker');
const { STARTERS, pickStarters, refreshStarters } = await import(pathToFileURL(startersModule));
assert.equal(STARTERS.length, 30, 'reuse all existing Fuse starters');
const first = pickStarters(() => true, [], () => 0);
assert.equal(first.length, 3);
assert.equal(new Set(first.map(s => s.name)).size, 3, 'no duplicate choices');
const next = pickStarters(() => true, first.map(s => s.name), () => 0);
assert.ok(next.every(s => !first.includes(s)), 'reshuffling avoids all three previous choices when possible');
const filtered = pickStarters(tag => tag !== 'night', [], () => 0);
assert.ok(filtered.every(s => !s.tags.includes('night')), 'filter whole stories instead of silently losing a required card');
const one = STARTERS[0];
assert.deepEqual(pickStarters(tag => one.tags.includes(tag), [one.name], () => 0), [one], 'reuse eligible choices if fewer than three alternatives exist');
assert.deepEqual(pickStarters(() => false), [], 'empty eligible pool is safe');
assert.notDeepEqual(pickStarters(() => true, [], () => 0), pickStarters(() => true, [], () => 0.99), 'the supplied random source changes the selection');
assert.equal(typeof refreshStarters, 'function', 'invalid cached choices are refreshed in both workspaces');
assert.equal(refreshStarters(first, () => true, () => 0.99), first, 'valid choices remain stable across ordinary redraws');
const blocked = new Set(first.map(s => s.tags[0]));
const replacement = refreshStarters(first, tag => !blocked.has(tag), () => 0);
assert.equal(replacement.length, 3, 'all three banned stories are replaced when legal alternatives exist');
assert.ok(replacement.every(s => s.tags.every(tag => !blocked.has(tag))));
assert.equal(refreshStarters([], () => true, () => 0).length, 3, 'choices return when an empty eligible pool becomes usable');
assert.deepEqual(refreshStarters(first, () => false), [], 'no eligible stories remains safe');
const data = JSON.parse(await readFile(resolve(root, 'web/lexicon.json'), 'utf8'));
const lex = new Map(data.tags.map(t => [t.tag, t]));
assert.equal(new Set(STARTERS.map(s => s.name)).size, 30, 'shared stories have unique names');
for (const story of STARTERS) for (const tag of story.tags) assert.ok(lex.has(tag), `${story.name}: ${tag} exists`);
const E = await import(pathToFileURL(resolve(root, 'web/engine.js')));
const indexed = E.indexLexicon(data);
const appSource = await readFile(resolve(root, web, 'app.js'), 'utf8');
const starterFilter = appSource.match(/const starterAllowed = [^\n]+/)[0];
for (const rating of ['general', 'sensitive', 'explicit']) {
  const wrapped = new Map(data.tags.map(it => [it.tag, { item: it, group: it.sub, tag: it.tag, gate: it.gate }]));
  const allowed = runInNewContext(starterFilter + '\nstarterAllowed', { lib: { byTag: wrapped }, settings: { rating }, bans: new Set(), ratingBlocked: E.ratingBlocked });
  for (const tag of ['large breasts', 'bent over']) assert.equal(allowed(tag), !E.ratingBlocked(lex.get(tag), rating), 'Starter eligibility uses canonical lexicon rating');
}
for (const story of STARTERS) {
  let pins = new Set();
  for (const tag of story.tags) pins = E.applyPin(indexed, pins, new Set(), tag).pinned;
  assert.ok(story.tags.every(tag => pins.has(tag)), `${story.name}: every starter card survives placement`);
}
const summary = candidateSummary({ mine: ['red hair'], extra: ['long hair', 'kimono', 'standing', 'street', 'night'] }, lex);
assert.deepEqual(summary.map(x => x.tag), ['red hair', 'kimono', 'standing', 'street']);
assert.equal(summary[0].kind, '髮色');
assert.equal(summary[0].label, '紅髮');
assert.deepEqual(candidateSummary({ mine: [], extra: ['unknown', 'smile'] }, lex).map(x => x.tag), ['smile']);
assert.deepEqual(candidateSummary({ mine: [], extra: [] }, lex), []);

const memory = new Map();
globalThis.localStorage = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: k => memory.delete(k) };
const S = await import(pathToFileURL(resolve(root, web, 'store.js')));
assert.equal(S.handOffFuse(['red hair', 'kimono'], { 'red hair': 1.2 }), true);
assert.deepEqual(S.takeFuse(), { tags: ['red hair', 'kimono'], weights: { 'red hair': 1.2 } });
assert.equal(S.takeFuse(), null, 'handoff is consumed only once');
S.handOffFuse(['red hair']);
const key = 'mochi.fuse.handoff.v1';
const stale = JSON.parse(memory.get(key));
stale.at = Date.now() - 31 * 60 * 1000;
memory.set(key, JSON.stringify(stale));
assert.equal(S.takeFuse(), null, 'stale handoff must not replace a new composition');
S.handOffFuse(['red hair']);
const invalid = JSON.parse(memory.get(key)); invalid.tags = 'red hair';
memory.set(key, JSON.stringify(invalid));
assert.equal(S.takeFuse(), null);
localStorage.setItem = () => { throw new Error('quota'); };
assert.equal(S.handOffFuse(['red hair']), false, 'UI must stay put when storage fails');
// Prepare sound between interactions without playing or resuming audio before a gesture.
const soundSource = (await readFile(resolve(root, web, 'sfx.js'), 'utf8')).replace(/export (function|const) /g, '$1 ');
for (const enabled of [true, false]) {
  const frames = [], idle = [], timers = [];
  let created = 0, resumed = 0, played = 0;
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const audioNode = () => ({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), gain: param(), frequency: param(), detune: param(), Q: param(), pan: param(), connect(n) { return n; }, start() { played++; }, stop() {} });
  class AudioContext {
    constructor() { created++; this.state = 'suspended'; this.sampleRate = 100; this.currentTime = 0; this.destination = audioNode(); }
    resume() { resumed++; this.state = 'running'; return Promise.resolve(); }
    createDynamicsCompressor = audioNode;
    createGain = audioNode;
    createOscillator = audioNode;
    createBiquadFilter = audioNode;
    createBufferSource = audioNode;
    createStereoPanner = audioNode;
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  }
  const sound = runInNewContext(soundSource + '\ngetSfx();', {
    window: { AudioContext }, document: { readyState: 'complete', hidden: false },
    localStorage: { getItem: () => enabled ? 'on' : 'off', setItem() {} },
    addEventListener() {}, requestAnimationFrame: fn => frames.push(fn),
    requestIdleCallback: fn => idle.push(fn), setTimeout: fn => timers.push(fn),
    performance: { now: () => 1000 },
  });
  assert.equal(created, 0, 'sound initialization does not block startup rendering');
  while (frames.length) frames.shift()();
  assert.equal(idle.length, enabled ? 1 : 0, 'enabled sound prepares during idle before the first interaction');
  while (idle.length) idle.shift()();
  assert.equal(created, enabled ? 1 : 0, 'muted sound does not allocate an audio context');
  assert.equal(resumed, 0, 'idle preparation never starts audio');
  assert.equal(played, 0, 'idle preparation is silent');
  sound.stamp();
  assert.equal(created, enabled ? 1 : 0, 'first sound reuses the prepared engine');
  assert.equal(resumed, enabled ? 1 : 0, 'enabled sound resumes when requested');
  assert.ok(enabled ? played > 0 : played === 0, 'sound switch still controls playback');
}
console.log('Composition summaries, one-shot handoff and idle sound preparation passed');

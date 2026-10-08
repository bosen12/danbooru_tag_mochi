import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const file = resolve(root, 'web/language.js');
assert.ok(existsSync(file), 'web must provide an early browser-language resolver');
const source = readFileSync(file, 'utf8');
function boot(languages, saved = null, blocked = false) {
  const values = new Map(saved ? [['mochi.language.v1', saved]] : []);
  const localStorage = {
    getItem(k) { if (blocked) throw Error('blocked'); return values.get(k) ?? null; },
    setItem(k, v) { if (blocked) throw Error('blocked'); values.set(k, v); },
    removeItem(k) { if (blocked) throw Error('blocked'); values.delete(k); },
  };
  const document = { documentElement: { lang: '', dataset: {} } };
  const ctx = { navigator: { languages, language: languages[0] }, localStorage, document };
  vm.runInNewContext(source, ctx);
  return { ...ctx, values };
}
for (const locale of ['zh-TW', 'zh-HK', 'zh-CN', 'zh-Hant']) assert.equal(boot([locale]).document.documentElement.lang, 'zh-Hant');
assert.equal(boot(['ja-JP', 'en-US', 'zh-TW']).document.documentElement.lang, 'en');
assert.equal(boot(['ja-JP', 'zh-TW', 'en']).document.documentElement.lang, 'zh-Hant');
assert.equal(boot(['fr-FR']).document.documentElement.lang, 'en');
assert.equal(boot(['zh-TW'], 'en').document.documentElement.lang, 'en');
assert.equal(boot(['en-US'], 'zh-Hant').document.documentElement.lang, 'zh-Hant');
assert.equal(boot(['en-US'], 'invalid').document.documentElement.lang, 'en');
assert.equal(boot(['zh-TW'], null, true).document.documentElement.lang, 'zh-Hant');
const ctx = boot(['en-US'], 'zh-Hant');
ctx.MochiLanguage.set('auto');
assert.equal(ctx.values.has('mochi.language.v1'), false);
assert.equal(ctx.MochiLanguage.resolve(), 'en');
ctx.MochiLanguage.set('en');
assert.equal(ctx.values.get('mochi.language.v1'), 'en');
const restricted = boot(['en-US'], null, true);
restricted.MochiLanguage.set('zh-Hant');
assert.equal(restricted.MochiLanguage.resolve(), 'zh-Hant');

globalThis.MochiLanguage = { resolve: () => 'en' };
const { t, registerLexicon, takeLanguageState } = await import(pathToFileURL(resolve(root, 'web/i18n.js')));
registerLexicon(JSON.parse(readFileSync(resolve(root, 'web/lexicon.json'), 'utf8')));
assert.equal(t('紅髮'), 'red hair');
assert.equal(t('紅髮 1.2'), 'red hair 1.2');
assert.equal(t('試印 C：你的 1 張，引擎補 28 張'), 'Proof C · 1 pinned · 28 engine additions');
assert.equal(t('一張圖只留一個：跟黑髮、棕髮 等 12 個互斥'), 'One per image · 12 cards share this slot, including black hair, brown hair');
assert.equal(t('牌組「紅髮」'), 'Deck “紅髮”', 'User deck names must remain intact');
assert.equal(t('找不到「紅髮」'), 'No results for “紅髮”', 'Search input must remain intact');
assert.equal(t('你的 5 張・引擎補 30 張'), '5 pinned · 30 engine additions');
assert.equal(t('seed 123, (red hair:1.2), <lora:demo>'), 'seed 123, (red hair:1.2), <lora:demo>', 'Machine values must remain intact');
assert.equal(t('天氣'), 'Weather');
assert.equal(t('你的 1 張・引擎補 1 張'), '1 pinned · 1 engine addition', 'A lone 1 takes a singular unit');
assert.equal(t('你的 11 張・引擎補 21 張'), '11 pinned · 21 engine additions');
assert.equal(t('紅髮（red hair）・長相'), 'red hair · Appearance', 'The tag is not repeated after its English name');
assert.equal(t('牌組「$&紅髮」'), 'Deck “$&紅髮”', 'Replacement patterns in user content stay literal');
assert.equal(t('尺度'), 'Content level', 'Content level and rating are different controls');
assert.equal(t('分級'), 'Rating');
globalThis.location = { pathname: '/fuse.html' };
globalThis.history = { state: null, replaceState(value) { this.state = value; } };
const snapshots = new Map();
globalThis.sessionStorage = { getItem: (k) => snapshots.get(k), removeItem: (k) => snapshots.delete(k) };
const key = 'mochi.language.state.v1', state = { bed: { pins: ['red hair'], weights: { 'red hair': 1.2 } }, seeds: [1, 2, 3, 4], picked: 2 };
snapshots.set(key, JSON.stringify({ route: '/fuse.html', at: Date.now(), state }));
assert.deepEqual(takeLanguageState(), state);
assert.equal(takeLanguageState(), null, 'A language snapshot is consumed once');
snapshots.set(key, JSON.stringify({ route: '/', at: Date.now(), state }));
assert.equal(takeLanguageState(), null, 'Do not restore another route');
snapshots.set(key, JSON.stringify({ route: '/fuse.html', at: Date.now() - 121000, state }));
assert.equal(takeLanguageState(), null, 'Ignore expired snapshots');
sessionStorage.getItem = () => { throw Error('blocked'); };
history.state = { mochiLanguageState: { route: '/fuse.html', at: Date.now(), state }, existing: 'preserved' };
assert.deepEqual(takeLanguageState(), state);
assert.deepEqual(history.state, { existing: 'preserved' }, 'Do not alter unrelated history state');
console.log('language resolution, presentation translation, user content and composition snapshots: passed');

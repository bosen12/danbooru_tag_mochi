// Focused release invariants; the larger historical engine suite is available with --full.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { indexLexicon, defaultSettings, applyPin, drawOne, mulberry32, missingPins, ratingBlocked } from '../web/engine.js';
const data = JSON.parse(readFileSync(resolve(import.meta.dirname, '../web/lexicon.json'), 'utf8'));
const lex = indexLexicon(data);
let pinned = applyPin(lex, new Set(), new Set(), 'black hair').pinned;
pinned = applyPin(lex, pinned, new Set(), 'red hair').pinned;
assert.ok(pinned.has('red hair') && !pinned.has('black hair'), 'Selecting a hair color replaces a conflicting pin');
pinned = applyPin(lex, pinned, new Set(), 'kimono').pinned;
const banned = new Set(['black hair']);
let draws = 0;
for (const rating of ['general', 'sensitive', 'explicit']) {
  const settings = { ...defaultSettings(data), girl: true, boy: false, rating, eras: ['modern'], heats: ['tease', 'flash', 'sex'] };
  for (let i = 0; i < 12; i++) {
    const seed = 20261008 + i;
    const shot = drawOne(lex, settings, pinned, banned, mulberry32(seed), seed);
    assert.deepEqual(missingPins(shot.positive, pinned), [], 'Allowed pinned cards survive the draw');
    const tags = shot.positive.split(', ').map(tag => tag.trim());
    assert.equal(tags.includes('black hair'), false, 'Banned cards do not return');
    for (const tag of tags) {
      assert.equal(['loli', 'shota', 'teen', 'child'].includes(tag), false, 'Hard-banned tags do not enter prompts');
      const item = lex.byTag.get(tag);
      if (item) assert.equal(ratingBlocked(item, rating), false, `${tag} must obey ${rating} rating`);
    }
    if (i === 0) {
      assert.equal(drawOne(lex, settings, pinned, banned, mulberry32(seed), seed).positive, shot.positive, 'Same seed and settings produce the same prompt');
    }
    draws++;
  }
}
// Breast size is weighted by how common each size is, not uniform across six options.
{
  const settings = { ...defaultSettings(data), girl: true, boy: false, rating: 'general', eras: ['modern'], heats: ['activity'] };
  const count = new Map();
  const N = 600;
  for (let i = 1; i <= N; i++) {
    for (const tag of drawOne(lex, settings, new Set(), new Set(), mulberry32(i), i).positive.split(', ')) count.set(tag, (count.get(tag) || 0) + 1);
  }
  const share = (tag) => (count.get(tag) || 0) / N;
  assert.ok(share('huge breasts') + share('gigantic breasts') < 0.25, 'Huge and gigantic breasts stay uncommon at General');
  assert.ok(share('medium breasts') > share('gigantic breasts') * 3, 'Medium breasts are far more common than gigantic');
}
// Free feature slots add details, not new premises: in Normal scenes non-human traits stay rare.
{
  const N = 400;
  const nonhuman = (sceneMode) => {
    const settings = { ...defaultSettings(data), girl: true, boy: false, rating: 'general', eras: ['modern'], sceneMode };
    let n = 0;
    for (let i = 1; i <= N; i++) {
      for (const tag of drawOne(lex, settings, new Set(), new Set(), mulberry32(i), i).positive.split(', ')) if (lex.byTag.get(tag)?.sub === 'nonhuman') n++;
    }
    return n / N;
  };
  assert.ok(nonhuman('normal') < 0.15, 'Normal scenes rarely add non-human traits on their own');
  assert.ok(nonhuman('weird') > nonhuman('normal'), 'Weird scenes keep the old, uniform free-feature draw');
}
// Hand motifs (giant hand, shadow hands…) rewrite the whole picture: Normal scenes only use them when pinned.
{
  const settings = { ...defaultSettings(data), girl: true, boy: false, rating: 'general', heats: ['tease'], eras: ['modern'], sceneMode: 'normal' };
  let random = 0;
  for (let i = 1; i <= 400; i++) if (/giant hand|shadow hands|too many hands|disembodied hand/.test(drawOne(lex, settings, new Set(), new Set(), mulberry32(i), i).positive)) random++;
  assert.equal(random, 0, 'Normal scenes do not add hand motifs on their own');
  const pin = applyPin(lex, new Set(), new Set(), 'giant hand').pinned;
  assert.ok(drawOne(lex, settings, pin, new Set(), mulberry32(7), 7).positive.includes('giant hand'), 'A pinned hand motif still appears');
}
console.log(`Release engine invariants: ${draws} draws across three ratings passed`);

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
console.log(`Release engine invariants: ${draws} draws across three ratings passed`);

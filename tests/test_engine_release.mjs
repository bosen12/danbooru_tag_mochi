// Focused release invariants; the larger historical engine suite is available with --full.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { indexLexicon, defaultSettings, applyPin, drawOne, mulberry32, missingPins, ratingBlocked } from '../web/engine.js';
import { genderCount } from '../web/rules/cast.js';
const data = JSON.parse(readFileSync(resolve(import.meta.dirname, '../web/lexicon.json'), 'utf8'));
const lex = indexLexicon(data);
// The cast may include explicitly pinned people outside the selected gender;
// automatic named characters must still respect the user's gender selection.
{
  const base = { ...defaultSettings(data), drawCharacter: true, rating: 'general', eras: ['modern'], heats: ['activity'], counts: { feature: 0, clothing: 0, pose: 0, env: 0 } };
  const femaleCharacter = data.tags.find(it => it.group === 'character' && it.gate === 'female' && it.series);
  const maleCharacter = data.tags.find(it => it.group === 'character' && it.gate === 'male' && it.series);
  assert.ok(femaleCharacter && maleCharacter, 'Both genders have character cards');
  const scenarios = [
    { name: 'Female selection, only a pinned man', girl: true, boy: false, pins: ['1boy'], female: 0, male: 0 },
    { name: 'Male selection, only a pinned woman', girl: false, boy: true, pins: ['1girl'], female: 0, male: 0 },
    { name: 'Female selection, mixed cast', girl: true, boy: false, pins: ['1girl', '1boy'], female: 1, male: 0 },
    { name: 'Male selection, mixed cast', girl: false, boy: true, pins: ['1girl', '1boy'], female: 0, male: 1 },
    { name: 'Both selected, mixed cast', girl: true, boy: true, pins: ['1girl', '1boy'], female: 1, male: 1 },
    { name: 'Female selection, manual male character', girl: true, boy: false, pins: ['1girl', '1boy', maleCharacter.tag], female: 1, male: 1 },
    { name: 'Male selection, manual female character', girl: false, boy: true, pins: ['1girl', '1boy', femaleCharacter.tag], female: 1, male: 1 },
  ];
  for (const scenario of scenarios) for (const characterSameSeries of [false, true]) for (let i = 0; i < 12; i++) {
    const seed = 711000 + i;
    const settings = { ...base, girl: scenario.girl, boy: scenario.boy, characterSameSeries };
    let pins = new Set();
    for (const tag of scenario.pins) pins = applyPin(lex, pins, new Set(), tag).pinned;
    const shot = drawOne(lex, settings, pins, new Set(), mulberry32(seed), seed);
    const tags = shot.positive.split(', ');
    const chars = tags.map(t => lex.byTag.get(t)).filter(it => it?.group === 'character');
    assert.ok(scenario.pins.every(t => tags.includes(t)), `${scenario.name}: manual pins survive`);
    assert.equal(genderCount(tags, true), scenario.pins.includes('1girl') ? 1 : 0, `${scenario.name}: character draws do not add women`);
    assert.equal(genderCount(tags, false), scenario.pins.includes('1boy') ? 1 : 0, `${scenario.name}: character draws do not add men`);
    // A pinned character's series may lack the selected gender. Never fill from another series.
    const requiredFemale = characterSameSeries && scenario.pins.includes(maleCharacter.tag) ? 0 : scenario.female;
    const requiredMale = characterSameSeries && scenario.pins.includes(femaleCharacter.tag) ? 0 : scenario.male;
    assert.ok(chars.filter(it => it.gate === 'female').length >= requiredFemale, `${scenario.name}: selected women get characters when available`);
    assert.ok(chars.filter(it => it.gate === 'male').length >= requiredMale, `${scenario.name}: selected men get characters when available`);
    assert.ok(chars.filter(it => it.gate === 'female').length <= scenario.female, `${scenario.name}: no extra female characters`);
    assert.ok(chars.filter(it => it.gate === 'male').length <= scenario.male, `${scenario.name}: no extra male characters`);
    if (!scenario.girl && !scenario.pins.includes(femaleCharacter.tag)) assert.ok(chars.every(it => it.gate !== 'female'), `${scenario.name}: no randomly added female characters`);
    if (!scenario.boy && !scenario.pins.includes(maleCharacter.tag)) assert.ok(chars.every(it => it.gate !== 'male'), `${scenario.name}: no randomly added male characters`);
    if (characterSameSeries) assert.ok(new Set(chars.map(it => it.series)).size <= 1, 'Same-series rule still applies');
  }
  const characterBans = new Set(data.tags.filter(it => it.group === 'character').map(it => it.tag));
  for (const characterSameSeries of [false, true]) {
    const seed = 711100;
    const tags = drawOne(lex, { ...base, girl: true, boy: false, characterSameSeries }, new Set(['1girl', '1boy']), characterBans, mulberry32(seed), seed).positive.split(', ');
    assert.ok(tags.includes('1girl') && tags.includes('1boy'), 'Banning characters keeps the cast');
    assert.ok(tags.every(t => !characterBans.has(t)), 'Empty eligible character pools never fall back to banned characters or other genders');
  }
  // 釘了 1girl 又釘一張要兩個人的動作（快抓胸）：開機擲的人數可能是 2girls，但畫面最後只有釘的一個女生。
  // 角色照畫面上真的有的人數抽，不照開機擲的（2026-10-14 專案主回報：一個女生卻抽了兩個角色）。
  for (const [girl, boy, girls, boys] of [[true, false, 1, 0], [true, true, 1, 1]]) {
    let pins = new Set();
    for (const tag of ['1girl', 'mature female', 'imminent breast grab']) pins = applyPin(lex, pins, new Set(), tag).pinned;
    for (let i = 0; i < 30; i++) {
      const seed = 712000 + i;
      const tags = drawOne(lex, { ...base, rating: 'explicit', heats: ['tease'], girl, boy }, pins, new Set(), mulberry32(seed), seed).positive.split(', ');
      const chars = tags.map(t => lex.byTag.get(t)).filter(it => it?.group === 'character');
      assert.equal(genderCount(tags, true), girls, 'pinned 1girl stays one woman');
      assert.ok(chars.filter(it => it.gate === 'female').length <= genderCount(tags, true), `no more female characters than women on screen (girl=${girl} boy=${boy}): ${tags.join(', ')}`);
      assert.ok(chars.filter(it => it.gate === 'male').length <= genderCount(tags, false), `no more male characters than men on screen (girl=${girl} boy=${boy})`);
      if (!boy) assert.equal(genderCount(tags, false), 0, 'girls only: no man added for the two-person act');
    }
  }
  console.log('Character gender filtering: 228 draws plus empty-pool checks passed');
}
// Selfies describe the view; they do not require a phone to be visible in the picture.
{
  const settings = { ...defaultSettings(data), girl: true, boy: false, rating: 'general', eras: ['modern'], heats: ['activity'], counts: { feature: 0, clothing: 0, pose: 0, env: 0 } };
  const tagsFor = (pins, seed) => new Set(drawOne(lex, settings, pins, new Set(), mulberry32(seed), seed).positive.split(', '));
  for (const activity of ['selfie', 'mirror selfie']) {
    const pins = applyPin(lex, new Set(), new Set(), activity).pinned;
    for (let i = 0; i < 20; i++) {
      const tags = tagsFor(pins, 441760 + i);
      assert.ok(tags.has(activity), `${activity} stays available without a phone`);
      for (const prop of ['cellphone', 'smartphone', 'camera', 'selfie stick']) assert.equal(tags.has(prop), false, `${activity} does not automatically add ${prop}`);
      if (activity === 'mirror selfie') assert.ok(tags.has('mirror'), 'Mirror selfies keep their mirror');
      const withPhone = tagsFor(applyPin(lex, pins, new Set(), 'cellphone').pinned, 441760 + i);
      assert.ok(withPhone.has(activity) && withPhone.has('cellphone'), 'An explicitly selected phone stays with the selfie');
      const restored = tagsFor(new Set([activity, 'smartphone']), 441760 + i);
      assert.ok(restored.has(activity) && restored.has('smartphone') && restored.has('cellphone'), 'Restored smartphone pins keep their cellphone dependency');
    }
  }
  const phoneOnlyBans = new Set(data.tags.filter(item => ['act_daily', 'obj_hand'].includes(item.sub) && !['selfie', 'smartphone', 'cellphone'].includes(item.tag)).map(item => item.tag));
  const mustPhone = { ...settings, heats: ['tease'], weights: { activity: 0, tease: 1, flash: 0, sex: 0 }, mustDraw: { 'pose:act_daily': 1, 'env:obj_hand': 1 } };
  for (let i = 0; i < 20; i++) {
    const tags = new Set(drawOne(lex, mustPhone, new Set(), phoneOnlyBans, mulberry32(441760 + i), 441760 + i).positive.split(', '));
    assert.ok(tags.has('selfie') && tags.has('smartphone') && tags.has('cellphone'), 'A must-draw smartphone keeps its cellphone dependency alongside the selfie');
  }
  for (const [activity, props] of [['talking on phone', ['cellphone']], ['taking picture', ['cellphone', 'camera']], ['livestream', ['cellphone']]]) {
    const pins = applyPin(lex, new Set(), new Set(), activity).pinned;
    for (let i = 0; i < 20; i++) {
      const tags = tagsFor(pins, 441860 + i);
      assert.ok(tags.has(activity) && props.some(prop => tags.has(prop)), `${activity} keeps its activity prop`);
    }
  }
}
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
// The real share is about 0.13-0.14; 400 draws wobble past 0.15 whenever new cards shift the random order, so sample 2000.
{
  const N = 2000;
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
// Clothing 0 + an exposure pose slot: garment actions (skirt lift, shirt pull…) are drawable without
// adding the garment (the prompt implies it); once clothes are worn they must still match; nude still blocks them.
{
  const keys = ['body', 'face', 'camera', 'gaze', 'activity', 'tease', 'flash', 'sex'];
  const base = { ...defaultSettings(data), rating: 'sensitive', heats: ['flash'], girl: true, boy: false, counts: { feature: 0, clothing: 0, pose: 1, env: 0 }, offGroups: keys.filter(k => k !== 'flash').map(k => 'pose:' + k) };
  const lift = (t) => lex.byTag.get(t)?.sub === 'flash_lift';
  let lifts = 0, garments = 0;
  for (let i = 0; i < 200; i++) {
    const tags = drawOne(lex, base, new Set(['1girl']), new Set(), mulberry32(31000 + i), 31000 + i).positive.split(', ');
    if (tags.some(lift)) lifts++;
    // A card that itself implies its garment (hand under shirt → shirt) keeps that lexicon dependency.
    const implied = new Set(tags.flatMap(t => lex.byTag.get(t)?.implies || []));
    garments += tags.filter(t => { const it = lex.byTag.get(t); return it?.section === 'clothing' && it.layer === 'garment' && !implied.has(t); }).length;
  }
  assert.ok(lifts >= 20, `Clothing 0 still reaches lift/pull actions (${lifts}/200)`);
  assert.equal(garments, 0, 'Clothing 0 adds no garment beyond what a drawn card implies');
  const pants = applyPin(lex, new Set(['1girl']), new Set(), 'pants').pinned;
  for (let i = 0; i < 80; i++) {
    const tags = drawOne(lex, base, pants, new Set(), mulberry32(32000 + i), 32000 + i).positive.split(', ');
    assert.ok(!tags.includes('skirt lift') && !tags.includes('dress lift'), 'Worn pants still exclude skirt and dress lifts');
  }
  const nude = applyPin(lex, new Set(['1girl']), new Set(), 'completely nude').pinned;
  for (let i = 0; i < 80; i++) {
    // Explicit rating: nude is only kept there (Sensitive drops the pin).
    const tags = drawOne(lex, { ...base, rating: 'explicit' }, nude, new Set(), mulberry32(33000 + i), 33000 + i).positive.split(', ');
    const needsCloth = ['skirt lift', 'shirt lift', 'dress lift', 'clothes lift', 'clothes pull', 'pants pull', 'shirt pull', 'hand under clothes', 'hand under shirt', 'undressing', 'clothing aside'];
    assert.ok(tags.includes('completely nude') && !tags.some(t => needsCloth.includes(t)), 'Nude excludes clothing actions');
  }
  // A camisole is a top (Sensitive drops the pull itself and keeps the camisole): pulling a camisole needs one worn, and wearing one rules out bikini actions
  // (camisole was missing from the garment keys — about 1.4% of pinned draws came out "camisole | hand in bikini").
  const cami = applyPin(lex, new Set(['1girl']), new Set(), 'camisole pull').pinned;
  for (const [rating, clothing] of [['explicit', 0], ['explicit', 2], ['sensitive', 0], ['sensitive', 2]]) {
    for (let i = 0; i < 300; i++) {
      const tags = drawOne(lex, { ...base, rating, heats: ['flash', 'sex'], counts: { ...base.counts, clothing, pose: 2 } }, cami, new Set(), mulberry32(5000 + i), 5000 + i).positive.split(', ');
      assert.ok((rating !== 'explicit' || tags.includes('camisole pull')) && !tags.some(t => /bikini/.test(t)), `Camisole pull never comes with a bikini (${rating}, clothing ${clothing}): ${tags.join(', ')}`);
    }
  }
}
// Characters: never drawn unless "Draw characters" is on; banned characters (underage, real people…) are not cards.
{
  const settings = { ...defaultSettings(data), girl: true, boy: true };
  let n = 0;
  for (let i = 1; i <= 200; i++) for (const tag of drawOne(lex, settings, new Set(), new Set(), mulberry32(i), i).positive.split(', ')) if (lex.byTag.get(tag)?.group === 'character') n++;
  assert.equal(n, 0, 'Characters stay out of draws while Draw characters is off');
  const ban = new Set(data.characterBan || []);
  assert.ok(ban.has('anya (spy x family)'), 'Underage characters are on the ban list');
  assert.equal(data.tags.filter(t => ban.has(t.tag)).length, 0, 'Banned characters are not cards');
}
console.log(`Release engine invariants: ${draws} draws across three ratings passed`);

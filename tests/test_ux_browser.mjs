// Uses real pages with fixture APIs; never connects to ComfyUI or Discord.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const p of [process.env.PLAYWRIGHT_MODULE, 'playwright', resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(p); } catch {}
  }
  throw new Error('Install Playwright or set PLAYWRIGHT_MODULE');
})();
const root = resolve(import.meta.dirname, '..');
const frontend = existsSync(resolve(root, 'web6/index.html')) ? 'web6' : 'web';
const out = process.env.BROWSER_RESULTS_DIR || await mkdtemp(resolve(tmpdir(), 'mochi-ux-'));
await mkdir(out, { recursive: true });
const writes = [], works = [
  { id: 'recipe', name: 'Recipe only', rating: 'general', positive: 'red hair, standing', pinned: ['red hair'], createdAt: new Date().toISOString() },
  { id: 'broken', name: 'Missing image', rating: 'general', positive: 'red hair', pinned: ['red hair'], image: { file: 'missing.png' }, createdAt: new Date().toISOString() },
];
let imageFails = true;
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/recipes/files/')) {
    if (imageFails) return res.writeHead(404).end();
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="150"><rect width="100" height="150" fill="#987"/></svg>');
  }
  if (url.pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD'].includes(req.method)) writes.push(url.pathname);
    const data = {
      '/api/ping': { ok: true }, '/api/gen/active': { ok: true, jobs: [] },
      '/api/recipes': { ok: true, items: works }, '/api/decks': { ok: true, decks: [] },
      '/api/usage': { counts: {}, mine: {}, last: {} }, '/api/lora-push': { version: 0 },
      '/api/discord/config': { ok: true, configured: false, enabled: false, mode: 'webhook' },
      '/api/workflows': { ok: true, items: [] }, '/api/checkpoints': { items: [] },
      '/api/loras': { items: [], categories: [] },
      '/api/sampling': { ok: true, base: { steps: 28, cfg: 5, sampler_name: 'euler', scheduler: 'normal' }, hires: { fast: {}, deep: {} } },
    }[url.pathname] || { ok: true, items: [] };
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(data));
  }
  const name = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
  let file = resolve(root, frontend, name);
  if (!existsSync(file)) file = resolve(root, 'web', name);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
await context.addInitScript(() => localStorage.setItem('mochi.tour.seen.v1', 'true'));
const page = await context.newPage(), errors = [];
page.setDefaultTimeout(15000);
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelectorAll('.quick-starters [data-starter]').length === 3);
  // Start with the reported settings: pose 1, expression only, adult heat allowed.
  await page.evaluate(async () => {
    const S = await import('./store.js'), E = await import('./engine.js');
    const data = await (await fetch('./lexicon.json')).json();
    S.saveSettings(E.sanitizeSettings({ rating: 'explicit', heats: ['sex'], counts: { feature: 0, clothing: 0, pose: 1, env: 1 }, offGroups: ['pose:body', 'pose:camera', 'pose:gaze', 'pose:activity'] }, data));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('.skel-row[data-section="pose"]')?.dataset.open === 'true');
  if (!(await page.locator('.more-rules').evaluate(n => n.open))) await page.locator('.more-rules > summary').click();
  await page.locator('.skel-row[data-section="pose"] .skel-more summary').click();
  assert.equal(await page.locator('.skel-row[data-section="pose"] [data-key="pose:sex"]').isVisible(), true);
  assert.match(await page.locator('.skel-guide').innerText(), /自由補抽/);
  await page.locator('.skel-row[data-section="pose"] [data-key="pose:sex"]').click();
  assert.equal(await page.locator('[data-key="pose:sex"]').getAttribute('aria-pressed'), 'true');
  await page.locator('.skel-row[data-section="pose"] [data-key="pose:face"]').click();
  assert.equal(await page.locator('[data-key="pose:face"]').getAttribute('aria-pressed'), 'true');
  const starterNames = () => page.locator('.quick-starters [data-starter]').evaluateAll(nodes => nodes.map(n => n.dataset.starter));
  const previousStarters = await starterNames();
  await page.locator('.quick-starters-more').click();
  const refreshedStarters = await starterNames();
  assert.equal(refreshedStarters.length, 3);
  assert.ok(refreshedStarters.every(name => !previousStarters.includes(name)), 'replace all three when enough stories remain');
  assert.equal(await page.locator('.quick-starters-more').evaluate(n => n === document.activeElement), true, 'reshuffle keeps keyboard focus');
  await page.locator('#rating button[data-v="explicit"]').click();
  assert.deepEqual(await starterNames(), refreshedStarters, 'ordinary redraw must not reshuffle choices');
  const selectedName = refreshedStarters[0];
  const selectedTags = await page.evaluate(async name => (await import('./starters.js')).STARTERS.find(s => s.name === name).tags, selectedName);
  await page.locator('.quick-starters [data-starter]').first().click();
  for (const tag of selectedTags) assert.ok(await page.locator('#pool-well [data-tag]').evaluateAll((nodes, tag) => nodes.some(n => n.dataset.tag === tag), tag), `starter retains ${tag}`);
  await page.locator('#pool-clear').click();
  await page.waitForFunction(() => document.querySelectorAll('.quick-starters [data-starter]').length === 3);
  const size = page.locator('#rules select[aria-label="尺寸"]');
  assert.equal(await size.count(), 1);
  assert.equal(await size.evaluate(n => !!n.closest('details')), false, 'size should be visible');
  await page.evaluate(async () => {
    const S = await import('./store.js');
    // 2026-10-20：只抽牌的（status drawn）重新整理就不留了，這裡用一張印好的。
    S.saveShots([{ id: 'copy-fixture', positive: 'red hair, kimono, standing', mine: ['red hair'], drawn: ['kimono', 'standing'], status: 'done', image: '/favicon.svg?filename=copy.png', seed: 123, rating: 'general', at: Date.now() }]);
  });
  await page.reload();
  await page.locator('.shot-actions').waitFor();
  const copy = page.getByRole('button', { name: '複製提示詞', exact: true });
  // 2026-10-16：牌不再攤在牆上（只抽牌的也是），點「牌·N」開成品詳情視窗看；牆上只有動作列和那顆鈕。
  assert.ok(await copy.evaluate(n => !!n.closest('.shot-actions') && !n.closest('.shot').querySelector('.shot-cards') && !!n.closest('.shot').querySelector('.shot-toggle[aria-haspopup="dialog"]')), 'copy action sits in the shot actions; the cards open in the detail window, not on the wall');
  await copy.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'red hair, kimono, standing');
  // Handoff must classify the original lexicon entry, not the display-card wrapper.
  await page.evaluate(async () => {
    const S = await import('./store.js'), E = await import('./engine.js');
    const data = await (await fetch('./lexicon.json')).json();
    const settings = E.sanitizeSettings({ rating: 'general', girl: true, boy: false, counts: { feature: 1, clothing: 1, pose: 1, env: 1 } }, data);
    S.saveSettings(settings);
    localStorage.setItem('mochi.fuse.settings.v1', JSON.stringify(settings));
    S.handOffFuse(['large breasts', 'bent over', 'red hair'], { 'large breasts': 1.2 });
  });
  await page.goto(origin + '/fuse.html');
  await page.locator('#registers [data-tag="red hair"]').waitFor();
  assert.equal(await page.locator('#registers .plate-card[data-tag="large breasts"]').count(), 1, 'General handoff retains an allowed body-type card');
  assert.equal(await page.locator('#registers .plate-card[data-tag="bent over"]').count(), 0, 'General handoff filters a blocked pose');
  // Use a real weight and ensure explicit transfer keeps it.
  await page.evaluate(async () => { const S = await import('./store.js'); S.handOffFuse(['red hair', 'kimono'], { 'red hair': 1.2 }); });
  await page.goto(origin + '/fuse.html');
  await page.waitForFunction(() => document.querySelector('#trials [aria-checked="true"]'));
  assert.ok(await page.locator('#registers [data-tag="red hair"]').count());
  assert.ok(await page.locator('#registers [data-tag="kimono"]').count());
  await page.locator('#trials button').nth(1).click();
  assert.match(await page.locator('.pv-state').innerText(), /已選試印 B/);
  assert.match(await page.locator('.pv-hint').innerText(), /尚未生成/);
  assert.equal(await page.locator('.trial-summary').count(), 4);
  const different = page.locator('#trials button').filter({ has: page.locator('.trial-summary .is-different') }).first();
  if (await different.count()) assert.match(await different.getAttribute('aria-label'), /與已選試印不同/, 'screen readers receive the differences');
  assert.ok((await page.locator('.trial-summary').first().innerText()).includes('红') || (await page.locator('.trial-summary').first().innerText()).includes('紅髮'));
  await page.locator('#print-bar select[aria-label="尺寸"]').selectOption('portrait');
  assert.match(await page.locator('.pb-detail').innerText(), /直/);
  const pos = page.locator('#print-bar .pb-links button');
  assert.equal(await pos.evaluate(n => !!n.closest('details')), false);
  await page.locator('#print-bar .pb-links a').click();
  await page.waitForURL(origin + '/');
  await page.waitForFunction(() => document.querySelector('#pool-well [data-tag="red hair"]'));
  assert.equal(await page.evaluate(async () => (await import('./weights.js')).weightsOfPositive('(red hair:1.2)')['red hair']), 1.2);
  const noteWeights = await page.locator('#pool-well [data-tag="red hair"]').evaluate(n => n.textContent);
  assert.match(noteWeights, /1\.2/);
  await page.locator('#pool-to-fuse').click();
  await page.waitForURL('**/fuse.html');
  await page.waitForFunction(() => document.querySelector('.trial-summary'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('#trials').parentElement.id === 'mobile-proofs');
  assert.equal(await page.locator('.trials-hint').isVisible(), true);
  assert.equal(await page.locator('#trials').count(), 1);
  assert.ok(await page.locator('#trials').evaluate(n => n.getBoundingClientRect().top < innerHeight));
  await page.screenshot({ path: resolve(out, 'fuse-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.waitForFunction(() => document.querySelector('#trials').parentElement.classList.contains('proof-flow'));
  await page.screenshot({ path: resolve(out, 'fuse-desktop.png'), fullPage: true });
  await page.goto(origin + '/album.html');
  await page.locator('[data-id="recipe"]').waitFor();
  assert.match(await page.locator('[data-id="recipe"] .album-noimg').innerText(), /只有配方/);
  await page.locator('[data-id="recipe"]').click();
  assert.equal(await page.locator('.album-big').evaluate(n => n.tagName), 'DIV');
  await page.keyboard.press('Escape');
  await page.locator('[data-id="broken"]').click();
  await page.locator('.album-image-note').waitFor({ state: 'visible' });
  assert.match(await page.locator('.album-image-note').innerText(), /圖片讀取失敗/);
  assert.equal(await page.locator('.album-big img').isVisible(), false, 'hide the broken image while explaining the failure');
  imageFails = false;
  await page.locator('.album-image-note button').click();
  await page.waitForFunction(() => document.querySelector('.album-big img')?.naturalWidth > 0);
  assert.equal(await page.locator('.album-image-note').isVisible(), false);
  // Smaller loading batches must still support pinning, keyboard navigation and fresh searches.
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(async () => {
    const S = await import('./store.js'), E = await import('./engine.js');
    const data = await (await fetch('./lexicon.json')).json();
    const settings = E.sanitizeSettings({ rating: 'general', girl: true, boy: true, counts: { feature: 1, clothing: 1, pose: 1, env: 1 } }, data);
    S.saveSettings(settings);
    localStorage.setItem('mochi.fuse.settings.v1', JSON.stringify(settings));
  });
  for (const route of ['/', '/fuse.html']) {
    await page.goto(origin + route);
    const grid = route === '/' ? '#lib-grid' : '#case-grid';
    await page.locator(grid + ' .card').first().waitFor();
    if (route === '/') await page.locator('#suit-tabs button').filter({ hasText: '角色' }).click();
    else await page.locator('#case-tabs [data-tab="chara"]').click();
    // 墨池換花色時分頁先亮、字盒下一格才重畫（app.js 的 afterPaint）：等牌換成角色牌再挑。
    await page.waitForFunction((grid) => document.querySelector(grid + ' .card')?.dataset.suit === 'chara', grid);
    const card = page.locator(grid + ' .card').first(), tag = await card.getAttribute('data-tag');
    await card.click();
    await page.waitForFunction(({ grid, tag }) => [...document.querySelectorAll(grid + ' .card')].some(n => n.dataset.tag === tag && n.dataset.state === 'pinned'), { grid, tag });
    await card.focus();
    for (let i = 0; i < 24; i++) await page.keyboard.press('ArrowDown');
    assert.ok(await page.locator(grid + ' .card').count() > 48, 'keyboard navigation loads beyond the first batches');
    assert.ok(await page.evaluate(grid => document.querySelector(grid).contains(document.activeElement), grid), 'keyboard focus remains in the card grid');
    const tags = await page.locator(grid + ' .card').evaluateAll(nodes => nodes.map(n => n.dataset.tag));
    assert.equal(new Set(tags).size, tags.length, 'incremental loading never duplicates cards');
    const search = page.locator(route === '/' ? '#lib-q' : '#case-q');
    await search.fill('zzzz-no-such-character-zzzz');
    await page.waitForFunction(grid => document.querySelector(grid).querySelectorAll('.card').length === 0, grid);
    await page.waitForTimeout(200);
    assert.equal(await page.locator(grid + ' .card').count(), 0, 'old observer batches do not reappear in an empty search');
    await search.fill('');
    await page.locator(grid + ' .card').first().waitFor();
    if (route === '/fuse.html') {
      await page.locator(grid + ' .card').nth(1).click();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.waitForFunction(() => Number.parseFloat(document.querySelector('#registers').style.getPropertyValue('--pool-card')) > 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'deferred card sizing survives newer pins and viewport changes');
    }
  }
  // 合成池跟著分頁走（store.js 的 TAB_POOL）：剛才在墨池放的牌，去疊印台再回來還在。
  await page.goto(origin + '/');
  await page.locator('#pool-well .card').first().waitFor();
  // 後面要看空池的起手組合：清空合成池（離開這頁時存下的就是空的）。
  await page.locator('#pool-clear').click();
  await page.waitForFunction(() => !document.querySelector('#pool-well .card'));
  // 疊印台的卡池也跟著分頁走（TAB_FUSE）：前面放過牌，清版之後空版的起手組合才會出來。
  await page.goto(origin + '/fuse.html');
  await page.locator('#registers .starters:not(.starters-decks) .starter-name, #clear:not([disabled])').first().waitFor();
  if (await page.locator('#clear:not([disabled])').count()) {
    await page.locator('#clear').click();
    await page.locator('#registers .starters:not(.starters-decks) .starter-name').first().waitFor();
  }
  await page.goto(origin + '/');
  await page.locator('.quick-starters [data-starter]').first().waitFor();
  await page.evaluate(async () => {
    const S = await import('./store.js'), E = await import('./engine.js');
    const data = await (await fetch('./lexicon.json')).json();
    const settings = E.sanitizeSettings({ rating: 'explicit', heats: ['sex'], counts: { feature: 1, clothing: 1, pose: 1, env: 1 } }, data);
    S.saveSettings(settings);
    localStorage.setItem('mochi.fuse.settings.v1', JSON.stringify(settings));
  });
  for (const lang of ['zh-Hant', 'en']) {
    await page.evaluate(lang => localStorage.setItem('mochi.language.v1', lang), lang);
    for (const width of [320, 390, 768, 1440]) for (const route of ['/', '/fuse.html']) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(origin + route);
      await page.locator(route === '/' ? '.quick-starters [data-starter]' : '.trial-summary').first().waitFor();
      if (route === '/') {
        assert.equal(await page.locator('.quick-starters [data-starter]').count(), 3);
        if (lang === 'en') assert.equal(/[\u3400-\u9fff]/.test(await page.locator('.quick-starters').innerText()), false, 'shared starters translate');
      }
      if (route === '/fuse.html') {
        const stories = page.locator('#registers .starters:not(.starters-decks) .starter-name');
        assert.equal(await stories.count(), 3, 'Fuse still draws three shared starter stories');
        if (lang === 'en') assert.equal(/[\u3400-\u9fff]/.test((await stories.allTextContents()).join('')), false);
      }
      if (route === '/' && !(await page.locator('.more-rules').evaluate(n => n.open))) await page.locator('.more-rules > summary').click();
      if (route === '/') {
        const characterSwitch = page.locator('#rules .switch').filter({ hasText: lang === 'en' ? 'Draw characters' : '抽角色' });
        await page.waitForFunction(lang => document.querySelector('#rules .switch[title]') && [...document.querySelectorAll('#rules .switch')].some(n => n.title.includes(lang === 'en' ? 'selected gender' : '「人物」選中的性別')), lang);
        assert.match(await characterSwitch.getAttribute('title'), lang === 'en' ? /selected gender.*pinned characters stay/ : /「人物」選中的性別.*手動釘的角色照留/);
      }
      if (route === '/fuse.html') await page.locator('#rules-btn').click();
      for (const section of ['feature', 'clothing', 'pose', 'env']) {
        const more = page.locator(`.skel-row[data-section="${section}"] .skel-more`);
        if (!(await more.evaluate(n => n.open))) await more.locator('summary').click();
      }
      if (lang === 'en') {
        await page.waitForFunction(() => !/[\u3400-\u9fff]/.test(document.querySelector('.skel-picker')?.innerText || ''));
        assert.match(await page.locator('[data-key="pose:sex"]').innerText(), /Sex/);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${lang} ${width} overflow`);
      const tools = await page.locator('.mast-tools').evaluate(n => [...n.children].filter(x => x.checkVisibility()).every(x => x.getBoundingClientRect().right <= innerWidth + 1));
      assert.equal(tools, true, `${lang} ${width} clipped tools`);
      if (lang === 'en' && route === '/fuse.html') assert.match(await page.locator('.pv-state').innerText(), /Proof A selected/);
      if (width === 390) await page.screenshot({ path: resolve(out, `supplement-${lang}-${route === '/' ? 'mochi' : 'fuse'}.png`), fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, [], 'review must not generate or change backend data');
  console.log('UX browser journeys passed. Screenshots: ' + out);
} finally {
  await context.close(); await browser.close(); await new Promise(r => server.close(r));
}

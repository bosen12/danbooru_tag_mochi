// 深度檢查第二批的操作改善，真的頁面＋假的 API（不連 ComfyUI、Discord，/api/gen、/api/interrupt 一律擋）：
//   照這張再印（作品冊、日誌 → 墨池：牌、時代、種子、模型）、手機的「⋯」、牌名籤開卡冊、
//   手機卡冊往上滑的小工具列、成品詳情「換掉這張重抽」、疊印台影子「換一張」、試印摘要略過釘住的牌。
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
const out = process.env.BROWSER_RESULTS_DIR || await mkdtemp(resolve(tmpdir(), 'mochi-deep-ux-'));
await mkdir(out, { recursive: true });
const svg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" width="832" height="1216"><rect width="832" height="1216" fill="${fill}"/></svg>`;
const now = new Date().toISOString();
const work = {
  id: 'w-fixture', name: '紅髮・和服', rating: 'general', era: 'edo', seed: 4242, width: 832, height: 1216,
  positive: 'masterpiece, 1girl, red hair, kimono, standing, street', pinned: ['red hair'],
  checkpoint: 'beta.safetensors', loras: [{ folder: 'loras', file: 'inkwash.safetensors', strength: 0.7, trigger: '' }],
  image: { file: 'fixture.png' }, createdAt: now,
};
const logEntry = {
  t: 'gen', id: 'job-fixture', at: Date.now(), ms: 9000, origin: 'mochi', kind: 'gen', ok: true, era: 'mixed',
  positive: '1girl, blonde hair, school uniform, sitting, classroom', seed: 777, width: 832, height: 1216,
  ckpt: 'alpha.safetensors', loras: [], rating: 'general', image: '/api/image?filename=log.png&type=output',
};
const blocked = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/recipes/files/') || url.pathname === '/api/image') {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.end(svg(url.pathname === '/api/image' ? '#6a7f96' : '#a3655a'));
  }
  if (url.pathname.startsWith('/api/')) {
    const data = {
      '/api/ping': { ok: true }, '/api/gen/active': { ok: true, jobs: [] },
      '/api/recipes': { ok: true, items: [work] }, '/api/decks': { ok: true, decks: [] },
      '/api/genlog': { ok: true, items: [logEntry], more: false, total: 1 },
      '/api/usage': { counts: { 'red hair': 3, kimono: 2 }, mine: {}, last: {} }, '/api/lora-push': { version: 0 },
      '/api/discord/config': { ok: true, configured: false, enabled: false, mode: 'webhook' },
      '/api/workflows': { ok: true, items: [] },
      '/api/checkpoints': { items: [{ ckpt_name: 'alpha.safetensors', file: 'alpha.safetensors', title: 'Alpha' }, { ckpt_name: 'beta.safetensors', file: 'beta.safetensors', title: 'Beta' }], current: 'alpha.safetensors' },
      '/api/loras': { items: [{ folder: 'loras', file: 'inkwash.safetensors', name: 'inkwash', title: 'Ink Wash', trainedWords: [] }], categories: [] },
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
const errors = [];
async function newPage(viewport, extra = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'], ...extra });
  // 生圖、中斷一律擋：測試絕不送東西給 ComfyUI。
  await context.route(/\/api\/(gen|gen\/cancel|interrupt)(\?|$)/, (route) => {
    blocked.push(route.request().url());
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'blocked in test' }) });
  });
  await context.addInitScript(() => localStorage.setItem('mochi.tour.seen.v1', 'true'));
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page };
}
const contexts = [];
const timings = {};
const shot = async (page, name) => page.screenshot({ path: resolve(out, name), fullPage: false });
try {
  /* ---------- 1. 作品冊：照這張再印 → 墨池套好牌、時代、種子，問要不要換模型 ---------- */
  {
    const { context, page } = await newPage({ width: 1440, height: 960 });
    contexts.push(context);
    await page.goto(origin + '/album.html');
    await page.locator('.album-tile').first().click();
    const again = page.locator('.sheet-foot .btn-primary');
    assert.equal(await again.innerText(), '照這張再印', 'primary action reprints the work');
    const chips = page.locator('.album-detail a.album-chip');
    assert.ok(await chips.count() >= 4, 'card names are clickable chips');
    assert.match(await page.locator('.album-facts').innerText(), /inkwash 0\.7/, 'LoRA name and strength, not [object Object]');
    assert.equal(await chips.first().getAttribute('href'), 'book.html#card=red%20hair', 'your pinned card comes first');
    assert.equal(await page.locator('.sheet-foot .foot-more-btn').count(), 0, 'desktop keeps every action in the row');
    assert.ok(await page.locator('.sheet-foot').getByText('只帶你選的牌').isVisible());
    await shot(page, 'album-detail-desktop.png');
    const a0 = Date.now();
    await again.click();
    await page.waitForURL(origin + '/');
    await page.locator('#recipe-note').waitFor();
    timings.reprintToNoteMs = Date.now() - a0;
    const pool = await page.locator('#pool-well .card[data-tag]').evaluateAll((n) => n.map((x) => x.dataset.tag));
    for (const tag of ['red hair', 'kimono', 'standing', 'street']) assert.ok(pool.includes(tag), `pool has ${tag}`);
    const state = await page.evaluate(() => ({ s: JSON.parse(localStorage.getItem('mochi.settings.v1')), seed: JSON.parse(localStorage.getItem('seedControl.v1')) }));
    assert.deepEqual(state.s.eras, ['edo'], 'era follows the work');
    assert.deepEqual([state.s.width, state.s.height], [832, 1216], 'size follows the work');
    assert.equal(state.s.eraMix, false);
    assert.deepEqual(state.seed, { mode: 'fixed', value: 4242 }, 'seed is fixed to the work');
    const note = await page.locator('#recipe-note').innerText();
    assert.match(note, /照這張再印/);
    assert.match(note, /種子固定 4242/);
    // 檔名換成清單上的名字（LoRA 的檔名常是亂碼）。
    await page.waitForFunction(() => /這張用 Beta＋Ink Wash/.test(document.querySelector('#recipe-note')?.textContent || ''));
    await shot(page, 'mochi-recipe-note.png');
    await page.getByRole('button', { name: '換成這組模型' }).click();
    await page.waitForFunction(() => localStorage.getItem('yz-ckpt') === 'beta.safetensors');
    await page.waitForFunction(() => /Ink Wash/.test(document.querySelector('#lora-pick-btn')?.textContent || ''));
    await page.locator('#recipe-note').waitFor({ state: 'detached' });
    await context.close();
  }
  /* ---------- 2. 日誌：照這張再印（混合時代）；手機底部只有主鈕＋⋯ ---------- */
  {
    const { context, page } = await newPage({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    contexts.push(context);
    await page.goto(origin + '/album.html');
    await page.locator('.album-tile').first().click();
    const foot = page.locator('.sheet-foot');
    assert.equal(await foot.locator(':scope > *').count(), 2, 'phone: primary + more');
    assert.equal(await foot.locator(':scope > .btn-primary').innerText(), '照這張再印');
    await foot.locator('.foot-more-btn').click();
    const items = await page.locator('.foot-more-menu > *').evaluateAll((n) => n.map((x) => x.textContent.trim()));
    assert.deepEqual(items, ['只帶你選的牌', '複製 POS', '開原圖', '從作品冊拿掉']);
    await shot(page, 'album-detail-phone-more.png');
    const del = page.locator('.foot-more-menu .album-del');
    await del.click();
    assert.equal(await page.locator('.foot-more-menu').isVisible(), true, 'armed delete keeps the menu open for the second press');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.foot-more-menu').isHidden(), true, 'Escape closes the menu first');
    await page.keyboard.press('Escape');
    await page.goto(origin + '/album.html?tab=log');
    await page.locator('.log-row').first().click();
    assert.equal(await page.locator('.sheet-foot > .btn-primary').innerText(), '照這張再印');
    assert.ok(await page.locator('.album-detail a.album-chip[href="book.html#card=blonde%20hair"]').count(), 'log chips link to the card book');
    await page.locator('.sheet-foot > .btn-primary').click();
    await page.waitForURL(origin + '/');
    await page.locator('#recipe-note').waitFor();
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('mochi.settings.v1')));
    assert.equal(s.eraMix, true, 'mixed era stays mixed');
    assert.match(await page.locator('#recipe-note').innerText(), /時代：混合/);
    await shot(page, 'mochi-recipe-note-phone.png');
    await context.close();
  }
  /* ---------- 3. 牌名籤 → 卡冊打開那張；4. 手機卡冊往上滑的小工具列 ---------- */
  {
    const { context, page } = await newPage({ width: 390, height: 844 }, { hasTouch: true, isMobile: true });
    contexts.push(context);
    await page.goto(origin + '/book.html#card=red%20hair');
    await page.locator('.sheet h2').filter({ hasText: '紅髮' }).waitFor();
    assert.equal(new URL(page.url()).hash, '', '#card is removed after opening');
    await shot(page, 'book-card-from-hash.png');
    await page.keyboard.press('Escape');
    await page.locator('.overlay').waitFor({ state: 'detached' });
    const mini = page.locator('#book-mini');
    // 往下捲一段再往上滑一點：頂欄冒出來，小工具列接在底下。
    const peek = async (y) => {
      const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      // 牌格可能比 y 矮（排序、篩選之後）：從捲得到的最底往上滑。
      const low = await page.evaluate((y) => Math.min(y + 400, document.documentElement.scrollHeight - innerHeight), y);
      await page.evaluate((v) => scrollTo(0, v), low);
      await frames();
      await page.evaluate((v) => scrollTo(0, v), low - 300);
      await frames();
      await page.waitForFunction(() => document.querySelector('#book-mini').dataset.show === 'true', null, { timeout: 3000 }).catch(async () => {
        throw new Error('mini toolbar did not show: ' + JSON.stringify(await page.evaluate(() => ({ y: scrollY, h: document.documentElement.scrollHeight, mast: document.documentElement.dataset.mast, tools: document.querySelector('#book-tools').getBoundingClientRect().bottom }))));
      });
    };
    assert.equal(await mini.getAttribute('data-show'), 'false');
    await page.evaluate(() => scrollTo(0, 1500));
    await page.waitForTimeout(80);
    await page.evaluate(() => scrollTo(0, 3000));
    await page.waitForTimeout(120);
    assert.equal(await mini.getAttribute('data-show'), 'false', 'scrolling down keeps it away');
    await page.evaluate(() => scrollTo(0, 2900));
    await page.waitForTimeout(120);
    assert.equal(await mini.getAttribute('data-show'), 'true', 'scrolling up brings the toolbar back');
    const box = await mini.locator('.book-mini-in').boundingBox();
    assert.equal(Math.round(box.height), 44, 'toolbar is 44px');
    const mastBox = await page.locator('.mast').boundingBox();
    await page.waitForTimeout(400);
    const placed = await mini.boundingBox();
    assert.ok(Math.abs(placed.y - (mastBox.y + mastBox.height)) <= 2, `toolbar hangs right under the peeking header (${placed.y} vs ${mastBox.y + mastBox.height})`);
    await shot(page, 'book-mini-toolbar.png');
    await mini.locator('[data-menu="sort"]').click();
    await mini.locator('.book-mini-item').filter({ hasText: '少到多' }).click();
    assert.match(await page.locator('#book-sort [aria-checked="true"]').innerText(), /少到多/, 'mini sort drives the real sort');
    await peek(2900);
    await mini.locator('[data-menu="suit"]').click();
    await mini.locator('.book-mini-item').filter({ hasText: '髮色' }).first().click().catch(async () => mini.locator('.book-mini-item').nth(2).click());
    assert.notEqual(await page.locator('#book-suits [aria-pressed="true"]').innerText(), '全部', 'mini suit drives the real suit tabs');
    await peek(1200);
    assert.equal(await mini.locator('.book-mini-clear').isVisible(), true, 'clear shows when filtered');
    await shot(page, 'book-mini-filtered.png');
    await mini.locator('.book-mini-clear').click();
    assert.match(await page.locator('#book-suits [aria-pressed="true"]').innerText(), /全部/, 'clear resets the suit');
    await page.setViewportSize({ width: 1280, height: 900 });
    assert.equal(await mini.isVisible(), false, 'desktop never shows the mini toolbar');
    await context.close();
  }
  /* ---------- 2b. 墨池成品詳情：點抽到的牌 → 換掉這張重抽 ---------- */
  {
    const { context, page } = await newPage({ width: 1440, height: 960 });
    contexts.push(context);
    await page.goto(origin + '/');
    await page.locator('.quick-starters [data-starter]').first().waitFor();
    const before = await page.evaluate(async () => {
      const S = await import('./store.js'), E = await import('./engine.js'), D = await import('./draw-with-seed.js');
      const data = await (await fetch('./lexicon.json')).json();
      const lex = E.indexLexicon(data);
      const settings = E.sanitizeSettings({ rating: 'general' }, data);
      S.saveSettings(settings);
      const d = D.drawWithSeed(lex, settings, new Set(), new Set(), 12345, { trace: true });
      // 跟墨池的成品一樣只收牌：品質詞、分級詞不算（app.js 的 makeShot）。
      const tags = [...new Set(['subject', 'feature', 'clothing', 'pose', 'env', 'style'].flatMap((k) => d.sections[k] || []))];
      S.saveShots([{ id: 'fx-done', seed: 12345, positive: d.positive, mine: [], drawn: tags.map((tag) => ({ tag, src: 'random' })), era: d.era, rating: 'general', width: 832, height: 1216, loras: [], ckpt: '', status: 'done', image: '/api/image?filename=fx.png&type=output', at: new Date().toISOString() }]);
      return tags;
    });
    await page.reload();
    await page.locator('.shot .shot-toggle').first().click();
    // 點一張衣服牌（人數牌由規則決定，換掉它不是常見的用法）。
    const target = page.locator('.sheet-shot .fans .fan:not([data-suit="cast"]) .card[data-tag]').last();
    const tag = await target.getAttribute('data-tag');
    await target.click();
    const reroll = page.locator('.sheet .reroll-card');
    assert.equal(await reroll.innerText(), '換掉這張重抽');
    assert.ok(await reroll.evaluate((n) => n.classList.contains('btn-primary')), 'reroll is the primary action');
    await shot(page, 'mochi-card-reroll.png');
    const r0 = Date.now();
    await reroll.click();
    await page.locator('#wall .shot .shot-swap').first().waitFor();
    timings.rerollMs = Date.now() - r0;
    const swapText = await page.locator('#wall .shot .shot-swap').first().innerText();
    assert.match(swapText, /^⇄換了：.+ → .+/);
    assert.ok(!/masterpiece|sfw|general/.test(swapText), 'only cards are listed as swapped');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mochi.shots.v1')));
    const fresh = saved.find((s) => s.swap);
    assert.ok(fresh, 'the swapped shot is saved with its swap');
    assert.ok(fresh.swap.from.includes(tag), 'the clicked card was swapped out');
    assert.equal(fresh.seed, 12345, 'same seed');
    const after = [...fresh.mine, ...fresh.drawn.map((d) => d.tag)];
    assert.ok(!after.includes(tag), 'the clicked card is gone');
    const kept = before.filter((t) => t !== tag && !fresh.swap.from.includes(t));
    assert.ok(kept.every((t) => after.includes(t)), 'every other card stays');
    assert.ok(blocked.some((u) => new URL(u).pathname === '/api/gen'), 'a printed shot is sent to print again (blocked in test)');
    await page.waitForTimeout(300);
    await shot(page, 'mochi-wall-swapped.png');
    await context.close();
  }
  /* ---------- 2c. 疊印台：影子小視窗的「換一張」；5. 試印摘要略過釘住的牌 ---------- */
  {
    const { context, page } = await newPage({ width: 1440, height: 960 });
    contexts.push(context);
    await page.goto(origin + '/');
    await page.evaluate(async () => {
      const S = await import('./store.js'), E = await import('./engine.js');
      const data = await (await fetch('./lexicon.json')).json();
      const settings = E.sanitizeSettings({ rating: 'general', counts: { feature: 2, clothing: 2, pose: 1, env: 1 } }, data);
      localStorage.setItem('mochi.fuse.settings.v1', JSON.stringify(settings));
      S.handOffFuse(['red hair', 'kimono']);
    });
    await page.goto(origin + '/fuse.html?debug');
    await page.locator('.trial-summary').first().waitFor();
    await page.waitForFunction(() => window.fuse?.trials?.length === 4 && window.fuse.trials.every(Boolean));
    const summaries = await page.locator('.trial-summary').allInnerTexts();
    assert.ok(summaries.every((t) => !/紅髮|和服/.test(t)), 'pinned cards are not repeated in each proof summary');
    const same = await page.locator('.trials-same').count() ? await page.locator('.trials-same').innerText() : '';
    if (same) assert.match(same, /^四張都一樣：/);
    await shot(page, 'fuse-trials-summary.png');
    // 試印的種子每次開頁都不一樣：有的位置規則上真的換不出別張（會說「抽不出別張」），換下一張影子試。
    let swappedOnce = false;
    for (let k = 0; k < 6 && !swappedOnce; k++) {
      const ghost = page.locator('#plate .ghost-card').nth(k);
      const gtag = await ghost.getAttribute('data-tag');
      const picked = await page.evaluate(() => { const i = [...document.querySelectorAll('#trials .trial')].findIndex((n) => n.getAttribute('aria-checked') === 'true'); return { i, others: window.fuse.trials.map((t) => t.positive), was: window.fuse.trials[i].positive }; });
      await ghost.click();
      await page.locator('.pop .swap-ghost').waitFor();
      if (k === 0) await shot(page, 'fuse-ghost-pop.png');
      const g0 = Date.now();
      await page.locator('.pop .swap-ghost').click();
      timings.swapGhostMs = Date.now() - g0;
      const res = await page.evaluate(() => window.fuse.trials.map((t) => ({ extra: t.extra, positive: t.positive, swapped: t.swapped || null })));
      const t = res[picked.i];
      res.forEach((x, j) => j !== picked.i && assert.equal(x.positive, picked.others[j], 'other proofs are untouched'));
      const toastText = await page.locator('#toast').innerText();
      if (t.positive === picked.was) {
        assert.match(toastText, /抽不出別張/, 'a slot that cannot change says so');
        continue;
      }
      swappedOnce = true;
      assert.ok(t.swapped && t.swapped.from.includes(gtag), 'the swap records the old card');
      assert.ok(!t.extra.includes(gtag), 'the swapped ghost is gone from the selected proof');
      assert.match(toastText, /試印 [A-D] 換了：/);
    }
    assert.ok(swappedOnce, 'at least one ghost could be swapped');
    await page.waitForTimeout(200);
    await shot(page, 'fuse-ghost-swapped.png');
    await context.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log(`Deep UX checks passed; timings ${JSON.stringify(timings)}; screenshots in ${out}`);
} finally {
  for (const c of contexts) await c.close().catch(() => {});
  await browser.close();
  await new Promise((r) => server.close(r));
}

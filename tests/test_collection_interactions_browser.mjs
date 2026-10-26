// Browser regressions with an isolated fixture API; never contacts ComfyUI or Discord.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const name of [process.env.PLAYWRIGHT_MODULE, 'playwright', resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(name); } catch {}
  }
  throw new Error('Playwright not found. Install playwright and its Chromium browser.');
})();
const root = resolve(import.meta.dirname, '..'), frontend = existsSync(resolve(root, 'web6/index.html')) ? 'web6' : 'web';
const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="tan"/></svg>';
const work = { id: 'fixture', name: 'Fixture', createdAt: '2026-01-01', positive: '1girl, red hair', pinned: ['red hair'], width: 100, height: 140, rating: 'general', image: { file: 'fixture.svg' } };
let decks, holdGets, heldGets, failGets, holdWrites, heldWrites, writes, deferProcessing, heldProcessing, failNextWrite, imageMode, heldImages;
const json = (res, data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/fixture.html') return res.end('<!doctype html><html lang="zh-Hant"><head><link rel="stylesheet" href="styles.css"></head><body><button id="opener">Open</button><div id="toast" class="toast" role="status"></div></body></html>');
  if (url.pathname === '/flight.svg') { heldImages.push(success => { res.setHeader('Content-Type', 'image/svg+xml'); res.end(svg); }); return; }
  // 卡冊「用它做過的圖」：work.svg 讀得到；gone.svg 是原圖不在（404，要清掉）；down.svg 是 ComfyUI 沒開（502，要留著）。
  if (url.pathname === '/api/genlog/files/work.svg') { res.setHeader('Content-Type', 'image/svg+xml'); return res.end(svg); }
  if (url.pathname === '/api/genlog/files/gone.svg') return res.writeHead(404).end();
  if (url.pathname === '/api/genlog/files/down.svg') return res.writeHead(502).end();
  if (url.pathname.startsWith('/api/recipes/files/')) {
    const send = (success) => { if (success) { res.setHeader('Content-Type', 'image/svg+xml'); res.end(svg); } else res.writeHead(404).end(); };
    if (url.searchParams.has('retry')) { if (imageMode === 'hold') heldImages.push(send); else send(imageMode === 'success'); } else send(false);
    return;
  }
  if (url.pathname === '/api/decks' && req.method === 'GET') {
    if (failGets) return res.writeHead(503).end();
    const snapshot = structuredClone(decks), send = () => json(res, { decks: snapshot });
    if (holdGets) heldGets.push(send); else send();
    return;
  }
  if (url.pathname.startsWith('/api/decks') && req.method !== 'GET') {
    let body = ''; for await (const chunk of req) body += chunk;
    const data = body ? JSON.parse(body) : {};
    writes.push({ method: req.method, ...data });
    const processWrite = () => {
      if (failNextWrite) { failNextWrite = false; res.statusCode = 503; return json(res, { ok: false, error: 'Fixture unavailable' }); }
      if (req.method === 'DELETE') decks = decks.filter(d => d.id !== decodeURIComponent(url.pathname.split('/').pop()));
      else { const d = { ...data, id: data.id || 'new-' + writes.length }; decks = [...decks.filter(x => x.id !== d.id), d]; }
      const response = structuredClone({ ok: true, decks, deck: decks.find(d => d.id === data.id) || decks.at(-1) });
      const send = () => json(res, response);
      if (holdWrites) heldWrites.push(send); else send();
    };
    if (deferProcessing) heldProcessing.push(processWrite); else processWrite();
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    json(res, ({ '/api/ping': { ok: true }, '/api/usage': { counts: {}, mine: {}, last: {} }, '/api/recipes': { items: [work] }, '/api/gen/active': { jobs: [] }, '/api/genlog/bytag': { total: 3, items: ['work', 'gone', 'down'].map((f, i) => ({ id: 'g' + i, at: Date.now() - i, positive: work.positive, image: '/api/genlog/files/' + f + '.svg', width: 100, height: 140, origin: 'mochi', mine: ['red hair'] })) }, '/api/genlog/stats': { cards: {}, models: [] } })[url.pathname] || { ok: true, items: [] }); return;
  }
  let name = decodeURIComponent(url.pathname).slice(1) || 'index.html', file = resolve(root, frontend, name);
  if (!existsSync(file)) file = resolve(root, 'web', name);
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try { res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream'); res.end(await readFile(file)); } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const failures = [];
async function shot(page, name) { if (process.env.BROWSER_RESULTS_DIR) { await mkdir(process.env.BROWSER_RESULTS_DIR, { recursive: true }); await page.screenshot({ path: resolve(process.env.BROWSER_RESULTS_DIR, name + '.png'), fullPage: true }); } }
async function waitFor(condition) { for (let i = 0; i < 100; i++) { if (condition()) return; await new Promise(r => setTimeout(r, 20)); } throw new Error('Fixture request did not arrive'); }
async function test(name, run, reducedMotion = 'reduce') {
  if (process.env.COLLECTION_SCENARIO && !name.includes(process.env.COLLECTION_SCENARIO)) return;
  decks = [{ id: 'old', name: 'Same', tags: ['red hair'], weights: {} }]; holdGets = false; heldGets = []; failGets = false; holdWrites = false; heldWrites = []; writes = []; deferProcessing = false; heldProcessing = []; failNextWrite = false; imageMode = 'failure'; heldImages = [];
  const context = await browser.newContext({ locale: 'zh-TW', reducedMotion, viewport: { width: 1280, height: 1000 } });
  await context.route('https://**/*', r => r.abort());
  await context.addInitScript(() => {
    localStorage.setItem('mochi.book.box.v1', JSON.stringify(['red hair']));
    for (const room of ['book', 'album']) localStorage.setItem(`mochi.tour.${room}.v1`, '1');
    window.imageAnimations = 0;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) { if (this.matches('.album-big img')) window.imageAnimations++; return animate.apply(this, args); };
  });
  const page = await context.newPage();
  try { await run(page); console.log('PASS', name); } catch (e) { failures.push(`${name}: ${e.message}`); console.error('FAIL', name, e.message); }
  finally { heldProcessing.splice(0).forEach(f => f()); heldGets.splice(0).forEach(f => f()); heldWrites.splice(0).forEach(f => f()); heldImages.splice(0).forEach(f => f(false)); await context.close(); }
}
async function book(page) { await page.goto(origin + '/book.html'); await page.locator('.book-cell').first().waitFor(); await page.locator('#box-pill').click(); }
async function quota(page) { await page.evaluate(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k.includes('handoff')) throw new DOMException('Full', 'QuotaExceededError'); return original.call(this, k, v); }; }); }
async function handoffStayed(page, path) { await page.waitForTimeout(600); assert.equal(new URL(page.url()).pathname, path, 'failed handoff retains the source page'); assert.match(await page.locator('.toast').last().textContent(), /無法交接選牌/); }
async function deckPanel(page, seed = false) {
  await page.goto(origin + '/fixture.html');
  await page.evaluate(async (seed) => { window.deckModule = await import('./decks.js'); if (seed) await deckModule.loadDecks(); }, seed);
  await page.evaluate(() => deckModule.openDecks({ where: '卡盒', current: () => ['red hair'], has: () => true, zh: t => t, apply: () => {} }));
}
try {
  await test('card box preserves cards when handoff storage fails', async page => { await book(page); await quota(page); await page.locator('.box-go').click(); await handoffStayed(page, '/book.html'); assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('mochi.book.box.v1'))), ['red hair']); assert.equal(await page.locator('.box-slot').count(), 1); });
  await test('single card handoff stays in card details on failure', async page => { await book(page); await page.locator('.box-close').click(); await page.locator('.book-cell .card').first().click(); await quota(page); await page.getByRole('button', { name: '帶去墨池合成池', exact: true }).click(); await handoffStayed(page, '/book.html'); assert.equal(await page.locator('.book-detail').count(), 1); });
  await test('book work handoff preserves the open work on failure', async page => {
    await book(page); await page.locator('.box-close').click(); await page.locator('.book-cell .card').first().click();
    await page.locator('.book-work').first().click(); await quota(page); await page.getByRole('button', { name: /這張的 .* 張牌帶回墨池/ }).click();
    await handoffStayed(page, '/book.html'); assert.equal(await page.locator('.book-work-full').count(), 1);
  });
  await test('book works hide only images the server says are gone', async page => {
    await book(page); await page.locator('.box-close').click(); await page.locator('.book-cell .card').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.book-work').length === 2);
    await page.waitForTimeout(300);
    assert.deepEqual(await page.locator('.book-work img').evaluateAll(a => a.map(i => i.getAttribute('src').split('/').pop())), ['work.svg', 'down.svg'], '404 is removed; 502 (ComfyUI off) stays');
    assert.match(await page.locator('.book-works-head').textContent(), /2 張圖/);
  });
  await test('album handoff preserves details on failure', async page => { await page.goto(origin + '/album.html'); await page.locator('.album-tile').click(); await quota(page); await page.getByRole('button', { name: '照這張再印', exact: true }).click(); await handoffStayed(page, '/album.html'); assert.equal(await page.locator('.album-detail').count(), 1); });
  await test('Escape restores box focus and external focus is preserved', async page => { await book(page); await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'box-pill'); await page.locator('#box-pill').click(); await page.evaluate(() => document.querySelector('#book-q').focus()); await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'book-q'); });
  await test('initial slow deck load resolves same-name update before saving', async page => { holdGets = true; await deckPanel(page); await waitFor(() => heldGets.length > 0); await page.locator('.deck-name').fill('Same'); await page.locator('.deck-save').dispatchEvent('submit'); await page.waitForTimeout(80); assert.equal(writes.length, 0, 'save must wait until existing names are known'); holdGets = false; heldGets.splice(0).forEach(f => f()); await waitFor(() => writes.length === 1); assert.equal(writes[0].id, 'old'); });
  await test('late GET cannot overwrite a saved deck in cache or open panel', async page => { await page.goto(origin + '/fixture.html'); await page.evaluate(async () => { window.deckModule = await import('./decks.js'); await deckModule.loadDecks(); }); await page.evaluate(() => deckModule.openDecks({ where: '卡盒', current: () => ['red hair'], has: () => true, zh: t => t, apply: () => {} })); await page.waitForTimeout(80); holdGets = true; await page.evaluate(() => { window.staleRead = deckModule.loadDecks(); }); await waitFor(() => heldGets.length > 0); await page.locator('.deck-name').fill('New'); holdWrites = true; await page.locator('.deck-save').dispatchEvent('submit'); await page.locator('.deck-save').dispatchEvent('submit'); await waitFor(() => writes.length > 0); await page.waitForTimeout(100); assert.equal(writes.length, 1, 'pending submit sends one POST'); heldWrites.splice(0).forEach(f => f()); await page.locator('.deck-title').filter({ hasText: 'New' }).waitFor(); heldGets.splice(0).forEach(f => f()); await page.waitForTimeout(120); assert.equal(await page.locator('.deck-title').filter({ hasText: 'New' }).count(), 1, 'late GET keeps saved panel row'); assert.equal(await page.evaluate(() => deckModule.cachedDecks().some(d => d.name === 'New')), true); });
  await test('late GET cannot resurrect deleted deck and pending delete sends once', async page => { await page.goto(origin + '/fixture.html'); await page.evaluate(async () => { window.deckModule = await import('./decks.js'); await deckModule.loadDecks(); }); holdGets = true; await page.evaluate(() => deckModule.openDecks({ where: '卡盒', current: () => ['red hair'], has: () => true, zh: t => t, apply: () => {} })); await waitFor(() => heldGets.length > 0); holdWrites = true; await page.locator('.deck-del').dispatchEvent('click'); await page.locator('.deck-del').dispatchEvent('click'); await waitFor(() => writes.length > 0); await page.waitForTimeout(100); assert.equal(writes.length, 1); heldWrites.splice(0).forEach(f => f()); await page.locator('.deck-row').waitFor({ state: 'detached' }); heldGets.splice(0).forEach(f => f()); await page.waitForTimeout(120); assert.equal(await page.locator('.deck-row').count(), 0); assert.equal(await page.evaluate(() => deckModule.cachedDecks().length), 0); });
  await test('deleted row refuses another click while its exit animation is running', async page => {
    await deckPanel(page, true); await page.locator('.deck-row').waitFor(); await page.locator('.deck-del').click();
    await waitFor(() => writes.length === 1); await page.waitForTimeout(40);
    await page.locator('.deck-del').dispatchEvent('click'); await page.waitForTimeout(100); assert.equal(writes.length, 1);
  }, 'no-preference');
  await test('cached names wait for pending refresh before creating a previously unknown name', async page => {
    await page.goto(origin + '/fixture.html'); await page.evaluate(async () => { window.deckModule = await import('./decks.js'); await deckModule.loadDecks(); });
    decks.push({ id: 'remote', name: 'Remote', tags: ['red hair'] }); holdGets = true;
    await page.evaluate(() => deckModule.openDecks({ where: '卡盒', current: () => ['red hair'], has: () => true, zh: t => t, apply: () => {} }));
    await waitFor(() => heldGets.length > 0); await page.locator('.deck-name').fill('Remote'); await page.locator('.deck-save').dispatchEvent('submit'); await page.waitForTimeout(100);
    assert.equal(writes.length, 0); heldGets.splice(0).forEach(f => f()); await waitFor(() => writes.length === 1); assert.equal(writes[0].id, 'remote');
  });
  await test('inverse server processing cannot lose a successfully saved deck', async page => {
    await page.goto(origin + '/fixture.html'); deferProcessing = true;
    await page.evaluate(async () => { window.deckModule = await import('./decks.js'); window.firstWrite = deckModule.saveDeck({ id: 'one', name: 'One', tags: ['red hair'] }); }); await waitFor(() => heldProcessing.length === 1);
    await page.evaluate(() => { window.secondWrite = deckModule.saveDeck({ id: 'two', name: 'Two', tags: ['red hair'] }); }); await page.waitForTimeout(100);
    if (heldProcessing.length === 2) {
      // An implementation allowing both requests can receive the second write before the first.
      heldProcessing.pop()(); await page.evaluate(() => secondWrite); heldProcessing.pop()(); await page.evaluate(() => firstWrite);
    } else {
      // Serialization prevents the inverse processing order at the API boundary.
      assert.equal(writes.length, 1); heldProcessing.shift()(); await page.evaluate(() => firstWrite);
      await waitFor(() => heldProcessing.length === 1); heldProcessing.shift()(); await page.evaluate(() => secondWrite);
    }
    assert.deepEqual(await page.evaluate(() => deckModule.cachedDecks().map(d => d.id).sort()), decks.map(d => d.id).sort());
    assert.equal(await page.evaluate(() => deckModule.cachedDecks().some(d => d.id === 'one') && deckModule.cachedDecks().some(d => d.id === 'two')), true);
  });
  await test('failed queued write rejects its caller and leaves the next write usable', async page => {
    await page.goto(origin + '/fixture.html'); failNextWrite = true;
    await page.evaluate(async () => {
      window.deckModule = await import('./decks.js');
      window.failedWrite = deckModule.saveDeck({ id: 'bad', name: 'Bad', tags: ['red hair'] }).then(() => false, () => true);
      window.nextWrite = deckModule.saveDeck({ id: 'good', name: 'Good', tags: ['red hair'] });
    });
    assert.equal(await page.evaluate(() => failedWrite), true); await page.evaluate(() => nextWrite);
    assert.equal(await page.evaluate(() => deckModule.cachedDecks().some(d => d.id === 'good')), true);
  });
  for (const target of ['detail', 'box']) await test('late card art reveals in ' + target + ' flight clone', async page => {
    await book(page); await page.locator('.box-close').click();
    await page.evaluate(() => {
      const card = document.querySelector('.book-cell .card'); card.querySelector('.card-art')?.remove();
      const art = document.createElement('span'); art.className = 'card-art'; art.innerHTML = '<img src="/flight.svg" srcset="/flight.svg 1x" alt="">'; card.append(art);
    });
    await waitFor(() => heldImages.length > 0);
    if (target === 'detail') await page.locator('.book-cell .card').first().click(); else { await page.locator('.book-cell:not(.is-skel)').first().hover(); await page.locator('.book-cell .box-add').first().click(); }
    const ghost = target === 'detail' ? 'body > .card-art' : '.box-ghost';
    assert.equal(await page.locator(ghost + ' img').getAttribute('srcset'), null, 'flight uses its source selected image without a new responsive selection');
    heldImages.splice(0).forEach(f => f(true));
    await page.waitForFunction(selector => document.querySelector(selector + ' img')?.dataset.ready === '1', ghost, { timeout: 1000 });
  }, 'no-preference');
  await test('failed initial deck connection can be retried without creating a duplicate', async page => {
    failGets = true; await deckPanel(page); await page.locator('.deck-note').filter({ hasText: '讀不到牌組' }).waitFor();
    await page.locator('.deck-name').fill('Same'); await page.locator('.deck-save').dispatchEvent('submit');
    await page.locator('.toast').filter({ hasText: '讀不到牌組' }).waitFor(); assert.equal(writes.length, 0); assert.equal(await page.locator('.deck-save-btn').isEnabled(), true);
    failGets = false; await page.locator('.deck-save-btn').click(); await waitFor(() => writes.length === 1); assert.equal(writes[0].id, 'old');
  });
  await test('the latest started deck GET wins when reads resolve out of order', async page => {
    await page.goto(origin + '/fixture.html'); holdGets = true;
    await page.evaluate(async () => { window.deckModule = await import('./decks.js'); window.firstRead = deckModule.loadDecks(); }); await waitFor(() => heldGets.length === 1);
    decks = [{ id: 'fresh', name: 'Fresh', tags: ['red hair'] }];
    await page.evaluate(() => { window.secondRead = deckModule.loadDecks(); }); await waitFor(() => heldGets.length === 2);
    heldGets.pop()(); await page.evaluate(() => secondRead); heldGets.pop()(); await page.evaluate(() => firstRead);
    assert.equal(await page.evaluate(() => deckModule.cachedDecks()[0].id), 'fresh');
  });
  for (const motion of ['reduce', 'no-preference']) await test('album retry pending, failure and recovery with ' + motion, async page => {
    await page.goto(origin + '/album.html'); await page.locator('.album-tile').click();
    const retry = page.getByRole('button', { name: '重試讀取圖片', exact: true }), note = page.locator('.album-image-note');
    await retry.waitFor(); await retry.focus(); imageMode = 'hold'; await page.keyboard.press('Enter'); await waitFor(() => heldImages.length === 1);
    assert.equal(await retry.isVisible(), true, 'retry remains visible while loading'); assert.equal(await retry.isDisabled(), true); assert.equal(await note.getAttribute('aria-busy'), 'true'); assert.match(await note.textContent(), /正在重新讀取圖片/); await shot(page, 'collection-retry-pending-' + motion);
    assert.match(await page.locator('.album-big .album-noimg').textContent(), /正在重新讀取圖片/, 'Image placeholder must not keep reporting failure while a retry is pending');
    heldImages.splice(0).forEach(f => f(false)); await page.waitForFunction(() => !document.querySelector('.album-image-note button').disabled); assert.equal(await retry.isVisible(), true);
    assert.equal(await page.locator('.album-big .album-noimg').textContent(), '圖片讀取失敗');
    await shot(page, 'collection-retry-failed-' + motion);
    await retry.focus(); const before = await page.evaluate(() => imageAnimations); await page.keyboard.press('Enter'); await waitFor(() => heldImages.length === 1); heldImages.splice(0).forEach(f => f(true));
    await page.waitForFunction(() => document.querySelector('.album-big img').naturalWidth > 0 && !document.querySelector('.album-big img').hidden);
    assert.equal(await page.evaluate(() => document.activeElement.className), 'album-big', 'recovered link retains useful keyboard focus');
    assert.equal(await page.evaluate(() => imageAnimations > 0), motion === 'no-preference');
    if (motion === 'no-preference') assert.equal(await page.evaluate(before => imageAnimations > before, before), true, 'recovery fades in the image');
    await shot(page, 'collection-retry-recovered-' + motion);
  }, motion);
} finally { await browser.close(); server.closeAllConnections(); await new Promise(r => server.close(r)); }
assert.deepEqual(failures, [], failures.join('\n'));
console.log('Collection interaction regressions passed.');

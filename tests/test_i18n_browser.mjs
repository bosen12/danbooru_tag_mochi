// Real web6 pages with isolated API fixtures. Never sends a generation to ComfyUI.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = resolve(import.meta.dirname, '..'), out = process.env.BROWSER_RESULTS_DIR || await mkdtemp(resolve(tmpdir(), 'mochi-browser-'));
const frontend = existsSync(resolve(root, 'web6/index.html')) ? 'web6' : 'web';
await mkdir(out, { recursive: true });
const requests = [];
const at = Date.now(), ref = '/api/image?filename=fixture.svg&type=output';
const works = [{ id: 'fixture', name: '紅髮・我的作品', createdAt: new Date(at).toISOString(), positive: '1girl, red hair, kimono, outdoors', seed: 120, width: 832, height: 1216, rating: 'general', era: 'edo', pinned: ['red hair'], image: { file: 'fixture.svg' }, thumb: { file: 'fixture.svg' }, checkpoint: '我的底模.safetensors' }];
const history = [{ id: 'g1', at, ok: true, origin: 'fuse', positive: works[0].positive, mine: ['red hair'], seed: 120, width: 832, height: 1216, rating: 'general', era: 'edo', image: ref, ckpt: '我的底模.safetensors', drawMs: 45200, queueMs: 2300, loras: [] }, { id: 'g2', at: at - 86400000 * 5, ok: false, origin: 'mochi', positive: '1girl, red hair', seed: 123, rating: 'general', error: '' }];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/recipes/files/') || url.pathname === '/api/image') {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="832" height="1216"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#60404b"/><stop offset="1" stop-color="#d9b17b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#a)"/><circle cx="416" cy="430" r="190" fill="#e9d9b7"/><path d="M220 1050Q70 620 416 650Q762 620 612 1050Z" fill="#243339"/></svg>'); return;
  }
  if (url.pathname.startsWith('/api/')) {
    requests.push({ path: url.pathname, method: req.method });
    const data = {
      '/api/ping': { ok: true }, '/api/loras': { items: [], categories: [] },
      '/api/lora-push': { version: 0 }, '/api/checkpoints': { items: [] },
      '/api/workflows': { ok: true, items: [] }, '/api/comfy': { ok: true, url: 'http://127.0.0.1:8188' },
      '/api/sampling': { ok: true, base: { steps: 28, cfg: 5, sampler_name: 'euler', scheduler: 'normal' }, hires: { fast: {}, deep: {} } },
      '/api/gen/active': { ok: true, jobs: [] },
      '/api/genlog/stats': { ok: true, cards: { 'red hair': [8, 3, 2] }, models: [{ kind: 'ckpt', name: '我的底模', n: 8, fav: 3, discard: 2, failed: 1, drawMs: 45200, last: at, cards: ['red hair', 'kimono'], best: { image: ref, width: 832, height: 1216, rating: 'general' } }], total: 8, fav: 3, discard: 2 },
      '/api/genlog': { ok: true, items: history, total: history.length },
      '/api/genlog/bytag': { ok: true, items: [history[0]], total: 1 },
      '/api/recipes': { ok: true, items: works }, '/api/decks': { ok: true, decks: [{ id: 'custom', name: '紅髮・我的牌組', tags: ['red hair', 'kimono'], weights: { 'red hair': 1.2 } }] },
      '/api/usage': { counts: {}, mine: {}, last: {} },
      '/api/discord/config': { ok: true, configured: false, enabled: false, mode: 'webhook' },
    }[url.pathname] || { ok: true, items: [] };
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return;
  }
  let name = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
  let file = resolve(root, frontend, name);
  if (!existsSync(file)) file = resolve(root, 'web', name);
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch({ headless: true });
const results = [], untranslated = new Set();
async function scan(page, name) {
  await page.waitForTimeout(120);
  const data = await page.evaluate(() => {
    const han = /[\u3400-\u9fff]/, texts = [], issues = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode, p = n.parentElement;
      if (!p || p.closest('script, style, code, pre, textarea, [data-no-i18n], .language-picker') || !han.test(n.data)) continue;
      if (p.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && getComputedStyle(p).color !== 'rgba(0, 0, 0, 0)') texts.push(n.data.trim());
    }
    for (const n of document.querySelectorAll('.mast a, .language-picker, .panel-head .btn, .plate-acts button')) {
      const r = n.getBoundingClientRect();
      if (r.width && (r.left < -1 || r.right > innerWidth + 1)) issues.push({ text: n.textContent, rect: r.toJSON() });
    }
    return { texts: [...new Set(texts)].filter(Boolean), issues, lang: document.documentElement.lang, title: document.title, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
  data.texts.forEach((t) => untranslated.add(t));
  results.push({ name, ...data });
  return data;
}
try {
  for (const width of [320, 390, 1440]) {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width, height: 960 }, reducedMotion: 'reduce' });
    await context.route('https://**/*', (r) => r.abort());
    await context.addInitScript(() => localStorage.setItem('mochi.settings.v1', JSON.stringify({ rating: 'general', n: 1 })));
    for (const route of ['/', '/fuse.html', '/book.html', '/album.html']) {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin + route + '?debug');
      await page.waitForFunction(() => !('booting' in document.documentElement.dataset));
      await page.locator('#language-select').waitFor();
      const name = `${width}-${route.replace(/\W/g, '') || 'ink'}`;
      await scan(page, name);
      await page.screenshot({ path: resolve(out, name + '.png'), fullPage: false });
      if (route === '/') {
        if (width < 1024) await page.locator('#lib-toggle').click();
        await page.locator('#lib-q').fill('紅髮');
        await page.waitForTimeout(200);
        await page.locator('#lib-grid .card[data-tag="red hair"]').click();
        if (width < 1024) await page.locator('.picker-done').click();
        assert.ok(await page.locator('#pool-well .card[data-tag="red hair"]').count(), 'Chinese search must work in English');
        await scan(page, name + '-pinned');
        await page.selectOption('#language-select', 'zh-Hant');
        await page.waitForFunction(() => document.documentElement.lang === 'zh-Hant' && document.querySelector('#pool-well .card[data-tag="red hair"]'));
        assert.equal(await page.locator('#pool-title').textContent(), '合成池');
        await page.selectOption('#language-select', 'en');
        await page.waitForFunction(() => document.documentElement.lang === 'en' && document.querySelector('#pool-well .card[data-tag="red hair"]'));
      }
      if (route === '/fuse.html') {
        await page.evaluate(() => { fuse.place('red hair'); fuse.pick(2); });
        const before = await page.evaluate(() => ({ bed: fuse.bed, proofs: fuse.trials.map((p) => p.positive) }));
        await scan(page, name + '-layers');
        await page.screenshot({ path: resolve(out, name + '-layers.png') });
        await page.selectOption('#language-select', 'zh-Hant');
        await page.waitForFunction(() => document.documentElement.lang === 'zh-Hant' && window.fuse?.bed?.pins.includes('red hair'));
        const after = await page.evaluate(() => ({ bed: fuse.bed, proofs: fuse.trials.map((p) => p.positive) }));
        assert.deepEqual(after, before, 'Language switching must preserve proof prompts and weights');
        await page.selectOption('#language-select', 'en');
        await page.waitForFunction(() => document.documentElement.lang === 'en' && window.fuse?.bed?.pins.includes('red hair'));
      }
      for (const selector of route === '/' ? ['#pool-decks', '#pool-paste', '#wf-pick-btn', '#lora-pick-btn', '#ckpt-pick-btn', '#dc-btn', '.pose-btn'] : route === '/fuse.html' ? ['#rules-btn', '#decks-btn'] : route === '/book.html' ? ['#book-ach', '#book-grid .card:first-child'] : ['.album-tile', '#album-tabs button:nth-child(2)', '#album-log .log-row', '#album-tabs button:nth-child(3)']) {
        const n = page.locator(selector).first();
        if (await n.count()) {
          await n.click(); await page.waitForTimeout(250); await scan(page, name + selector);
          if (selector === '.album-tile') assert.equal(await page.locator('.sheet h2').textContent(), works[0].name, 'User image names must remain unchanged');
          if (selector === '.pose-btn') {
            await page.getByRole('button', { name: 'Open pose editor', exact: true }).click();
            await scan(page, name + '-pose-editor');
            await page.keyboard.press('Escape'); await page.waitForTimeout(180);
          }
          await page.keyboard.press('Escape'); await page.waitForTimeout(180);
        }
      }
      await page.locator('#tour-btn').click();
      await page.waitForTimeout(200); await scan(page, name + '-tour');
      await page.keyboard.press('Escape');
      if (width === 1440) {
        await page.keyboard.press('?'); await scan(page, name + '-keys'); await page.keyboard.press('Escape');
      }
      assert.deepEqual(errors, [], name + ' page errors');
      await page.close();
    }
    if (width !== 320) for (const route of ['/intro.html', '/tutorial.html']) {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin + route);
      try { await page.waitForFunction(() => !!window.__intro, null, { timeout: 60000 }); }
      catch (e) { console.log(JSON.stringify({ route, errors, body: (await page.locator('body').innerText()).slice(0, 800) })); throw e; }
      await scan(page, `${width}${route}-gate`);
      await page.evaluate(() => document.querySelector('#gate').classList.add('is-gone'));
      const seconds = route === '/intro.html' ? [4, 28, 38, 55, 74, 91, 106, 128, 154, 175] : [4, 18, 35, 52, 69, 85, 101, 117, 133, 149, 166, 182, 198, 214, 230, 245, 260];
      for (const second of seconds) {
        await page.evaluate((t) => __intro.seek(t), second);
        await scan(page, `${width}${route}-${second}`);
        if (width === 1440 && [18, 128, 166].includes(second)) await page.screenshot({ path: resolve(out, route.slice(1, -5) + '-' + second + '.png') });
      }
      assert.deepEqual(errors, [], route + ' page errors');
      await page.close();
    }
    await context.close();
  }
  const context = await browser.newContext({ locale: 'zh-TW' });
  await context.route('https://**/*', (r) => r.abort());
  const page = await context.newPage(); await page.goto(origin + '/');
  assert.equal(await page.locator('html').getAttribute('lang'), 'zh-Hant');
  await page.selectOption('#language-select', 'en'); await page.waitForFunction(() => document.documentElement.lang === 'en');
  await page.goto(origin + '/book.html'); assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  await page.selectOption('#language-select', 'auto'); await page.waitForFunction(() => document.documentElement.lang === 'zh-Hant');
  assert.equal(await page.evaluate(() => localStorage.getItem('mochi.language.v1')), null);
  await context.close();
  assert.equal(requests.some((r) => ['/api/gen', '/api/discord'].includes(r.path)), false, 'Must not generate images or send messages');
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ results, untranslated: [...untranslated] }, null, 2));
  const geometryIssues = results.filter((r) => r.overflow || r.issues.length).map((r) => ({ name: r.name, issues: r.issues, overflow: r.overflow }));
  const residual = [...untranslated].filter((text) => /[\u3400-\u9fff]/.test(text.replaceAll('我的底模', '')));
  console.log(JSON.stringify({ scenarios: results.length, untranslatedUI: residual, geometryIssues }, null, 2));
  assert.deepEqual(geometryIssues, [], 'No horizontal page or navigation overflow');
  assert.deepEqual(residual, [], 'All visible UI copy is translated; custom model names are preserved');
} finally {
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ results, untranslated: [...untranslated] }, null, 2));
  await browser.close(); server.close();
}

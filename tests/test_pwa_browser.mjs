// 安裝成 App（PWA）：每個房間、介紹頁都掛了 manifest 和 install-app.js；Chrome 的安裝檢查沒有錯；
// 瀏覽器說可以裝（beforeinstallprompt）時頂欄出現「安裝成 App」，按了叫出安裝視窗、裝好就消失；
// 已經是 App 視窗開的不出現。假的 API，不連 ComfyUI、不生圖。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const name of [process.env.PLAYWRIGHT_MODULE, 'playwright', resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(name); } catch {}
  }
  throw new Error('Playwright not found. Run: npm install --no-save playwright && npx playwright install chromium');
})();
const root = resolve(import.meta.dirname, '..');
const frontend = existsSync(resolve(root, 'web6/index.html')) ? 'web6' : 'web';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    if (/\/api\/(gen|interrupt)/.test(url.pathname)) { res.writeHead(403); return res.end(); }
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(url.pathname === '/api/ping' ? { ok: false } : url.pathname === '/api/custom-cards' ? { ok: true, cards: [] } : []));
  }
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).slice(1);
  for (const dir of [frontend, 'web']) {
    const file = resolve(root, dir, rel);
    if (!file.startsWith(resolve(root, dir) + sep) || !existsSync(file)) continue;
    try { res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream'); return res.end(await readFile(file)); } catch {}
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const manifest = JSON.parse(await readFile(resolve(root, frontend, 'manifest.json'), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.ok(manifest.id && manifest.start_url, 'manifest has a stable id and start url');
assert.equal(manifest.orientation, undefined, 'no orientation lock (tablets, landscape phones)');
assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
assert.deepEqual(manifest.shortcuts.map((s) => s.url), ['fuse.html', 'book.html', 'album.html', 'parse.html']);

const profile = mkdtempSync(resolve(tmpdir(), 'mochi-pwa-'));
const ctx = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1280, height: 900 } });
try {
  await ctx.addInitScript(() => { localStorage.setItem('mochi.tour.seen.v1', 'true'); localStorage.setItem('mochi.community.asked.v1', '1'); });
  for (const path of ['', 'fuse.html', 'book.html', 'album.html', 'parse.html', 'about.html']) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin + '/' + path);
    await page.waitForLoadState('load');
    await page.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(installabilityErrors.map((e) => e.errorId), [], `${path || 'index'}: Chrome can install it`);
    const r = await page.evaluate(async () => {
      let prompted = false;
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = () => { prompted = true; };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      dispatchEvent(e);
      for (let i = 0; i < 40 && !document.querySelector('.install-app-btn'); i++) await new Promise((r) => setTimeout(r, 100));
      const btn = document.querySelector('.install-app-btn');
      const shown = !!btn && btn.offsetParent !== null && e.defaultPrevented;
      btn?.click();
      await new Promise((r) => setTimeout(r, 200));
      return { shown, prompted, gone: !document.querySelector('.install-app-btn') };
    });
    assert.deepEqual(r, { shown: true, prompted: true, gone: true }, `${path || 'index'}: install button`);
    assert.deepEqual(errors, [], `${path || 'index'}: no page errors`);
    await page.close();
  }
  // 已經是 App 視窗開的：不出現。
  const page = await ctx.newPage();
  await page.emulateMedia({ media: 'screen' });
  await page.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); });
  await page.goto(origin + '/');
  await page.waitForLoadState('load');
  const shownInApp = await page.evaluate(async () => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => {};
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    dispatchEvent(e);
    await new Promise((r) => setTimeout(r, 1500));
    return !!document.querySelector('.install-app-btn');
  });
  assert.equal(shownInApp, false, 'no install button inside the installed app');
  console.log('PWA (manifest, installability, install button): passed');
} finally {
  await ctx.close();
  server.close();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}

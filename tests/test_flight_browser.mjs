// Real browser regression of cloned card art. Isolated assets; no generation APIs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
for (const mod of [process.env.PLAYWRIGHT_MODULE, 'playwright', resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
  try { pw = require(mod); break; } catch {}
}
assert.ok(pw, 'Playwright is installed');
const root = resolve(import.meta.dirname, '..'), web = existsSync(resolve(root, 'web6')) ? 'web6' : 'web';
const out = process.env.BROWSER_RESULTS_DIR || await mkdtemp(resolve(tmpdir(), 'mochi-flight-'));
await mkdir(out, { recursive: true });
const requests = [];
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/fixture') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/card.css"><style>body{background:#152025}.target{position:absolute;left:500px;top:250px;width:88px;height:129px}</style><div class="target"></div>');
  }
  if (path.startsWith('/art/')) {
    requests.push(path);
    if (path.includes('missing')) return res.writeHead(404).end();
    if (path.includes('slow')) await new Promise(r => setTimeout(r, 140));
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'max-age=3600');
    return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="293"><rect width="200" height="293" fill="#196890"/><circle cx="100" cy="140" r="70" fill="#ffd45b"/></svg>');
  }
  if (path.startsWith('/api/')) return res.writeHead(403).end();
  let file = resolve(root, web, path.slice(1));
  if (!existsSync(file)) file = resolve(root, 'web', path.slice(1));
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await pw.chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 }, reducedMotion: 'no-preference' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);
  const first = await page.evaluate(async oldClone => {
    const cards = await import('/cards.js'), images = await import('/card-images.js'), { flight } = await import('/motion.js');
    const card = { tag: 'test', zh: '測試', suit: 'look', rating: 'general' };
    const source = cards.cardNode(card, { art: () => '/art/slow.svg' });
    // A freshly built destination has not loaded yet. cloneNode loses its load callback.
    const ghost = !oldClone && images.cloneCard ? images.cloneCard(source) : source.cloneNode(true);
    window.flightHandle = flight(ghost, { left: 20, top: 30, width: 88 }, document.querySelector('.target'), { duration: 1600 });
    window.flightGhost = ghost;
    await new Promise(resolve => ghost.querySelector('img').addEventListener('load', resolve, { once: true }));
    await new Promise(r => setTimeout(r, 320));
    const img = ghost.querySelector('img');
    return { opacity: Number(getComputedStyle(img).opacity), ready: img.dataset.ready, complete: img.complete && img.naturalWidth > 0 };
  }, process.argv.includes('--old-clone'));
  await page.screenshot({ path: resolve(out, 'cold-midflight.png') });
  assert.ok(first.complete && first.opacity > 0.99 && first.ready === '1', 'Loaded cloned art remains visible after the loading-mask delay: ' + JSON.stringify(first));
  await page.evaluate(() => flightHandle.cancel());
  const loaded = await page.evaluate(async () => {
    const { cloneCard, bindArt } = await import('/card-images.js');
    const source = document.createElement('div'); source.className = 'card';
    const img = document.createElement('img'); img.className = 'card-art';
    bindArt(img, null, { src: '/art/full.svg', srcset: '/art/thumb.svg 200w, /art/full.svg 480w', sizes: '120px' });
    source.append(img); document.body.append(source); img.loading = 'eager'; await img.decode();
    const expected = img.currentSrc;
    const clone = cloneCard(source); clone.style.width = '480px'; document.body.append(clone);
    await clone.querySelector('img').decode();
    return { expected, actual: clone.querySelector('img').currentSrc, ready: clone.querySelector('img').dataset.ready, srcset: clone.querySelector('img').getAttribute('srcset') };
  });
  assert.equal(loaded.actual, loaded.expected, 'Flight reuses the already decoded thumbnail');
  assert.equal(loaded.srcset, null, 'Flight does not choose a larger responsive source');
  assert.equal(loaded.ready, '1');
  assert.ok(!requests.includes('/art/full.svg'), 'No additional high-resolution request while flying');
  const resized = await page.evaluate(async () => {
    const { bindArt, cloneCard } = await import('/card-images.js');
    const source = document.createElement('div'); source.className = 'card';
    const img = document.createElement('img'); img.style.cssText = 'width:90px;height:130px';
    bindArt(img, { full: '/art/resize-full.svg', list: [{ w: 160, url: '/art/resize-mini.svg' }] }, null);
    source.append(img); document.body.append(source); img.loading = 'eager'; await img.decode();
    await new Promise(r => setTimeout(r, 60));
    const expected = img.currentSrc;
    const clone = cloneCard(source), copied = clone.querySelector('img');
    copied.style.cssText = 'width:400px;height:585px'; document.body.append(clone); await copied.decode();
    window.dispatchEvent(new Event('resize')); await new Promise(r => setTimeout(r, 450));
    return { expected, actual: copied.currentSrc };
  });
  assert.ok(resized.expected.endsWith('/art/resize-mini.svg'));
  assert.equal(resized.actual, resized.expected, 'Viewport changes do not remeasure flying thumbnails');
  assert.ok(!requests.includes('/art/resize-full.svg'), 'Resize does not fetch large flight art');
  const fallback = await page.evaluate(async () => {
    const { bindArt, cloneCard } = await import('/card-images.js');
    const source = document.createElement('div'); source.className = 'card';
    const img = document.createElement('img');
    bindArt(img, { full: '/art/fallback.svg', list: [{ w: 160, url: '/art/missing-mini.svg' }] }, null);
    source.append(img);
    const clone = cloneCard(source); document.body.append(clone);
    const copied = clone.querySelector('img');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Clone fallback did not load')), 3000);
      copied.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
    });
    return { src: copied.currentSrc, ready: copied.dataset.ready, width: copied.naturalWidth };
  });
  assert.ok(fallback.src.endsWith('/art/fallback.svg') && fallback.width > 0 && fallback.ready === '1', 'Cold clones retain mini-to-original fallback');
  const borrowed = await page.evaluate(async () => {
    const { cloneCard } = await import('/card-images.js');
    const source = document.querySelector('img[src="/art/full.svg"]')?.parentElement || [...document.querySelectorAll('.card')].find(n => n.querySelector('img')?.complete);
    const sourceImg = source.querySelector('img');
    const destination = document.createElement('div'); destination.className = 'card'; destination.dataset.tag = 'borrowed';
    const next = document.createElement('img'); next.src = '/art/slow-unloaded.svg'; destination.append(next);
    const clone = cloneCard(destination, source); document.body.append(clone);
    await clone.querySelector('img').decode();
    return { tag: clone.dataset.tag, actual: clone.querySelector('img').currentSrc, expected: sourceImg.currentSrc };
  });
  assert.equal(borrowed.tag, 'borrowed', 'Destination card identity stays intact');
  assert.equal(borrowed.actual, borrowed.expected, 'A new destination can borrow the loaded departure art');
  const missing = await page.evaluate(async () => {
    const { cloneCard } = await import('/card-images.js');
    const source = document.createElement('div'); source.className = 'card'; source.innerHTML = '<span class="card-spine">Label</span><img src="/art/missing-original.svg">';
    const clone = cloneCard(source); document.body.append(clone);
    await new Promise(r => setTimeout(r, 180));
    return { images: clone.querySelectorAll('img').length, label: clone.textContent };
  });
  assert.equal(missing.images, 0, 'Unavailable art keeps the card label instead of a broken image');
  assert.equal(missing.label, 'Label');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await page.evaluate(async () => {
    const { cloneCard } = await import('/card-images.js');
    const source = document.createElement('div'); source.className = 'card'; source.innerHTML = '<span class="card-art"><img src="/art/slow-reduced.svg"></span>';
    const clone = cloneCard(source);
    const loaded = new Promise(r => clone.querySelector('img').addEventListener('load', r, { once: true }));
    document.body.append(clone); await loaded;
    return { opacity: getComputedStyle(clone.querySelector('img')).opacity, ready: clone.querySelector('img').dataset.ready };
  });
  assert.equal(reduced.ready, '1'); assert.equal(reduced.opacity, '1', 'Reduced motion still reveals loaded card art');
  assert.deepEqual(errors, []);
  await page.close();
  console.log('Cold flight art, thumbnail reuse, borrowed art, fallback, missing art and reduced motion passed. Screenshots: ' + out);
} finally { await browser.close(); await new Promise(r => server.close(r)); }

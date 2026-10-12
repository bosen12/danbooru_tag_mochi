// Isolated real-page motion checks; generation and Discord endpoints are never forwarded.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
for (const m of [process.env.PLAYWRIGHT_MODULE, 'playwright', resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
  try { pw = require(m); break; } catch {}
}
assert.ok(pw, 'Playwright is installed');
const root = resolve(import.meta.dirname, '..'), web = existsSync(resolve(root, 'web6')) ? 'web6' : 'web';
const out = process.env.BROWSER_RESULTS_DIR || await mkdtemp(resolve(tmpdir(), 'mochi-motion-details-'));
await mkdir(out, { recursive: true });
const writes = [], failures = [], errors = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    if (!['GET', 'HEAD'].includes(req.method)) { writes.push(url.pathname); return res.writeHead(403).end(); }
    const data = {
      '/api/ping': { ok: true }, '/api/gen/active': { ok: true, jobs: [] },
      '/api/usage': { counts: {}, mine: {}, last: {} }, '/api/decks': { ok: true, decks: [] },
      '/api/recipes': { ok: true, items: [] }, '/api/lora-push': { version: 0 },
      '/api/discord/config': { ok: true, configured: false, enabled: false },
      '/api/sampling': { ok: true, base: { steps: 28, cfg: 5, sampler_name: 'euler', scheduler: 'normal' }, hires: { fast: {}, deep: {} } },
    }[url.pathname] || { ok: true, items: [], categories: [] };
    res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(data));
  }
  let file = resolve(root, web, decodeURIComponent(url.pathname).slice(1) || 'index.html');
  if (!existsSync(file)) file = resolve(root, 'web', decodeURIComponent(url.pathname).slice(1));
  if (!file.startsWith(root + sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await pw.chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
async function check(name, fn) {
  try { await fn(); console.log('PASS ' + name); }
  catch (e) { failures.push(name + ': ' + e.message); console.error('FAIL ' + name + ': ' + e.message); }
}
try {
  for (const lang of ['zh-Hant', 'en']) for (const reduced of [false, true]) for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 960 }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(lang => { localStorage.setItem('mochi.tour.seen.v1', 'true'); localStorage.setItem('mochi.language.v1', lang); }, lang);
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    const label = `${lang}/${reduced ? 'reduced' : 'normal'}-${mobile ? 'mobile' : 'desktop'}`;
    await page.goto(origin);
    await page.waitForSelector('.quick-starters-more');
    await page.evaluate(async () => {
      const S = await import('./store.js'), E = await import('./engine.js');
      const data = await (await fetch('./lexicon.json')).json();
      S.saveSettings(E.sanitizeSettings({ rating: 'general', counts: { feature: 1, clothing: 1, pose: 1, env: 1 } }, data));
    });
    await page.reload(); await page.waitForSelector('.quick-starters-more');
    await check(label + ' starter replacement uses the existing motion rhythm', async () => {
      await page.locator('.quick-starters-more').click();
      const state = await page.locator('.quick-starters').evaluate(n => ({
        focused: n.querySelector('.quick-starters-more') === document.activeElement,
        names: [...n.querySelectorAll('[data-starter]')].map(b => getComputedStyle(b).animationName),
      }));
      assert.ok(state.focused, 'Replacement restores the reshuffle button focus');
      assert.equal(state.names.length, 3);
      assert.ok(state.names.every(n => reduced ? n === 'none' : n === 'starter-in'), JSON.stringify(state));
    });
    if (!(await page.locator('.more-rules').evaluate(n => n.open))) await page.locator('.more-rules > summary').click();
    await page.waitForTimeout(380);
    const details = page.locator('.skel-row[data-section="pose"] .skel-more');
    await check(label + ' nested disclosure belongs to its own open state', async () => {
      const state = await details.evaluate(n => ({ open: n.open, rotate: getComputedStyle(n.querySelector('summary'), '::before').rotate }));
      assert.equal(state.open, false);
      assert.ok(['none', '0deg'].includes(state.rotate), 'Outer rules must not rotate a closed inner disclosure: ' + state.rotate);
      await details.locator('summary').click(); await page.waitForTimeout(40);
      const duration = await details.evaluate(n => getComputedStyle(n, '::details-content').transitionDuration);
      assert.ok(reduced ? duration.split(',').every(d => parseFloat(d) === 0) : duration.split(',').some(d => parseFloat(d) > 0), 'Disclosure transition: ' + duration);
      await details.locator('summary').click();
      await page.waitForTimeout(250);
      assert.equal(await details.evaluate(n => n.open), false);
      await details.evaluate(n => { n.open = true; n.open = false; n.open = true; });
      await page.waitForTimeout(reduced ? 20 : 380);
      assert.ok(await details.locator('.skel-chip').first().isVisible(), 'Rapid disclosure changes settle open');
    });
    await page.screenshot({ path: resolve(out, `${lang}-${reduced ? 'reduced' : 'normal'}-${mobile ? 'mobile' : 'desktop'}-rules.png`), fullPage: true });
    await page.goto(origin + '/fuse.html'); await page.waitForSelector('.trial-summary');
    await check(label + ' proof selection preserves labels and only transitions difference emphasis', async () => {
      await page.evaluate(() => { window.originalSummaryRows = [...document.querySelectorAll('.trial-summary > span')]; });
      await page.locator('#trials button').nth(1).click();
      const state = await page.evaluate(() => ({
        stable: originalSummaryRows.every((n, i) => n === document.querySelectorAll('.trial-summary > span')[i]),
        transitions: [...document.querySelectorAll('.trial-summary > span')].map(n => getComputedStyle(n).transitionProperty),
        animated: [...document.querySelectorAll('.trial-summary')].flatMap(n => n.getAnimations()).length,
      }));
      assert.ok(state.stable, 'Selecting a proof must not replace the summary labels');
      if (!reduced) assert.ok(state.transitions.every(p => p.includes('color')), 'Differences use the existing color transition');
      assert.equal(state.animated, 0, 'Reading the summaries is not interrupted by whole-block animation');
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ' no horizontal overflow');
    await context.close();
  }
  assert.deepEqual(errors, [], 'No page errors'); assert.deepEqual(writes, [], 'No generation or external writes');
  assert.deepEqual(failures, [], 'Motion detail regressions');
  console.log('Motion details passed. Screenshots: ' + out);
} finally { await browser.close(); await new Promise(r => server.close(r)); }

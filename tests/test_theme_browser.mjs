// 淺色模式（theme.js）：預設深色；頂欄有外觀切換、切了馬上換色並記住；重開頁第一個畫面就是存的顏色；
// 跟系統照作業系統的淺／深；英文版選項是英文；手機頂欄擠不下時換個地方放、頂欄不多一排。各房間、介紹頁都掛了 theme.js（在 <head>，畫面出來之前跑）。
// 假的 API，不連 ComfyUI、不生圖。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { homedir } from 'node:os';
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
const PAGES = ['index.html', 'fuse.html', 'book.html', 'album.html', 'parse.html', 'about.html'];

// 靜態：theme.js 在 <head> 裡、而且是一般 script（不是 module、不 defer）：畫面出來之前就換好顏色。
for (const page of PAGES) {
  const html = await readFile(resolve(root, frontend, page), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /<script src="theme\.js"><\/script>/, `${page}: theme.js runs in <head> before paint`);
}

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

// 底色的亮度（0～1）：淺色要亮、深色要暗。
const paperLightness = () => {
  const c = getComputedStyle(document.body).backgroundColor;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = c;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    for (const r of ['mochi', 'fuse', 'book', 'album', 'parse']) localStorage.setItem(`mochi.tour.${r}.v1`, '1');
    localStorage.setItem('mochi.tour.seen.v1', 'true');
    localStorage.setItem('mochi.community.asked.v1', '1');
  });

  for (const path of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/${path}`);
    await page.evaluate(() => localStorage.removeItem('mochi.theme.v1'));
    await page.reload();
    await page.waitForSelector('#theme-select', { state: 'attached', timeout: 15000 });
    // 預設深色，切換放在語言地球左邊。
    const first = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      value: document.getElementById('theme-select').value,
      beforeLanguage: (() => {
        const lang = document.querySelector('.language-picker');
        const picker = document.querySelector('.theme-picker');
        return !lang || picker.nextElementSibling === lang;
      })(),
    }));
    assert.deepEqual(first, { theme: 'dark', value: 'dark', beforeLanguage: true }, `${path}: dark by default, picker beside the globe`);
    assert.ok((await page.evaluate(paperLightness)) < 0.25, `${path}: dark paper`);

    // 切淺色：馬上換、記住、meta theme-color 跟著換。
    await page.selectOption('#theme-select', 'light');
    const switched = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      saved: localStorage.getItem('mochi.theme.v1'),
      scheme: document.documentElement.style.colorScheme,
      meta: document.querySelector('meta[name="theme-color"]')?.content ?? null,
    }));
    assert.equal(switched.theme, 'light', `${path}: switches at once`);
    assert.equal(switched.saved, 'light', `${path}: remembers the choice`);
    assert.equal(switched.scheme, 'light', `${path}: native controls follow`);
    if (switched.meta !== null) assert.equal(switched.meta, '#f4f1ea', `${path}: window bar colour follows`);
    await page.waitForTimeout(600);
    assert.ok((await page.evaluate(paperLightness)) > 0.85, `${path}: light paper`);

    // 重開頁：第一支 script 跑完就已經是淺色（不會先黑一下）。
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState === 'interactive') window.__themeAtParse = document.documentElement.dataset.theme;
      }, { once: true });
    });
    await page.reload();
    await page.waitForSelector('#theme-select', { state: 'attached', timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__themeAtParse), 'light', `${path}: light before first paint after reload`);
    assert.equal(await page.inputValue('#theme-select'), 'light', `${path}: picker shows the saved choice`);
    assert.deepEqual(errors, [], `${path}: no page errors`);
    await page.close();
  }

  // 別的分頁換了：這頁跟著換。
  {
    const a = await ctx.newPage();
    const b = await ctx.newPage();
    await a.goto(`${origin}/`);
    await b.goto(`${origin}/book.html`);
    await a.waitForSelector('#theme-select', { state: 'attached' });
    await b.waitForSelector('#theme-select', { state: 'attached' });
    await a.selectOption('#theme-select', 'dark');
    await b.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 5000 });
    assert.equal(await b.inputValue('#theme-select'), 'dark', 'other tabs follow');
    await a.close();
    await b.close();
  }

  // 跟系統：照作業系統的淺／深，系統換了跟著換。
  {
    const page = await ctx.newPage();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(`${origin}/`);
    await page.waitForSelector('#theme-select', { state: 'attached' });
    await page.selectOption('#theme-select', 'auto');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light', 'auto follows a light system');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => document.documentElement.dataset.themePref), 'auto');
    await page.close();
  }

  // 頂欄擠不下（手機）：切換換個地方放，頂欄不會因為它多一排；照樣看得到、按得到。
  for (const [lang, width] of [['zh', 360], ['zh', 390], ['en', 390]]) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript((l) => localStorage.setItem('mochi.language.v1', l === 'en' ? 'en' : 'zh-Hant'), lang);
    await page.goto(`${origin}/`);
    await page.waitForSelector('#theme-select', { state: 'attached' });
    await page.waitForTimeout(2200);
    const r = await page.evaluate(() => {
      const t = document.querySelector('.theme-picker');
      const mast = document.querySelector('.mast-primary').closest('.mast');
      const box = t.getBoundingClientRect();
      const now = mast.getBoundingClientRect().height;
      const parent = t.parentElement, next = t.nextSibling;
      t.remove();
      const without = mast.getBoundingClientRect().height;
      parent.insertBefore(t, next);
      return { slot: t.dataset.slot, grew: Math.round(now - without), visible: box.width >= 20 && box.right <= innerWidth && box.left >= 0 };
    });
    assert.equal(await page.evaluate(() => document.documentElement.lang.slice(0, 2)), lang, `${lang} ${width}: language`);
    assert.ok(r.visible && r.slot !== 'none', `${lang} ${width}: picker visible (${r.slot})`);
    assert.ok(r.grew <= 1, `${lang} ${width}: masthead no taller with the picker (${r.slot}, +${r.grew}px)`);
    await page.selectOption('#theme-select', 'light');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light', `${lang} ${width}: switches from its phone spot`);
    await page.close();
  }

  // 英文版：選項是英文。
  {
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('mochi.language.v1', 'en'));
    await page.goto(`${origin}/`);
    await page.waitForSelector('#theme-select', { state: 'attached' });
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.deepEqual(await page.$$eval('#theme-select option', (o) => o.map((x) => x.textContent)), ['Dark', 'Light', 'System']);
    await page.close();
  }
  await ctx.close();
  console.log('theme (default dark, picker, persistence, before paint, tabs, system, English): passed');
} finally {
  await browser.close();
  server.close();
}

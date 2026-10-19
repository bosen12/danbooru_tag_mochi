// 墨池的 Discord 分頻道（web6/discord-routes.js）：真的面板、假的 API（記憶體裡的頻道清單）。
// 比對、存檔檢查在伺服器那頭，由 scripts/test_discord_routes.py 測；這裡測畫面：新增、搜尋、偏好角色、
// 上限、至少一種條件、編輯、兩段式刪除、從一張圖開頻道。不連 Discord、不生圖。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => {
  const { homedir } = require('node:os');
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
  for (const name of tries) {
    try { return require(name); } catch {}
  }
  throw new Error('Playwright not found. Run: npm install --no-save playwright && npx playwright install chromium');
})();
const root = resolve(import.meta.dirname, '..');
const frontend = existsSync(resolve(root, 'web6/index.html')) ? 'web6' : 'web';
const HOOK = 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnopqrstuvwxyz';

// 假的 /api/discord/config：只記頻道清單，網址只回末四碼（跟 server.py 一樣）。
let routes = [];
const saves = [];
let seq = 0;
const status = () => ({ ok: true, mode: 'webhook', configured: routes.length > 0, otherConfigured: false, routes: routes.map(({ webhook, ...r }) => ({ ...r, webhookTail: '…' + webhook.slice(-4), sent: 0, failed: 0, lastError: '' })), tokenTail: '', webhookTail: '', channelId: '', enabled: true, compact: false, sent: 0, failed: 0, lastError: '', queued: 0 });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
  if (url.pathname === '/api/discord/config') {
    if (req.method === 'POST') {
      let raw = ''; for await (const part of req) raw += part;
      const body = JSON.parse(raw);
      const op = body.route;
      if (op?.op === 'save') {
        saves.push(op);
        const at = routes.findIndex((r) => r.id === op.id);
        const { op: _, ...fields } = op;
        const route = { ...(at >= 0 ? routes[at] : { id: 'r' + ++seq, webhook: op.webhook }), ...fields, webhook: op.webhook || routes[at]?.webhook, paused: false };
        if (at >= 0) routes[at] = route; else routes.push(route);
      } else if (op?.op === 'delete') routes = routes.filter((r) => r.id !== op.id);
      return json(status());
    }
    return json(status());
  }
  if (url.pathname === '/api/discord') return json({ ok: true });
  if (/\/api\/(gen|interrupt)/.test(url.pathname)) { res.writeHead(403); return res.end(); }
  if (url.pathname.startsWith('/api/')) return json(url.pathname === '/api/ping' ? { ok: false } : []);
  const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).slice(1);
  for (const dir of [frontend, 'web']) {
    const file = resolve(root, dir, rel);
    if (!file.startsWith(resolve(root, dir) + sep) || !existsSync(file)) continue;
    try {
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      return res.end(await readFile(file));
    } catch {}
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const errors = [];
let fails = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('PASS', name); } catch (e) { fails++; console.log('FAIL', name, String(e.message || e).split('\n')[0]); }
};
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('mochi.screensaver.v1', JSON.stringify({ idle: 0 }));
    for (const r of ['mochi', 'fuse', 'book', 'album']) localStorage.setItem(`mochi.tour.${r}.v1`, '1');
    localStorage.setItem('mochi.language.v1', 'zh-Hant');
    localStorage.setItem('mochi.fav.chars.v1', JSON.stringify(['kochou shinobu']));
    if (!localStorage.getItem('mochi.shots.v1')) localStorage.setItem('mochi.shots.v1', JSON.stringify([{ id: 's1', seed: 1, positive: '1girl, yor briar, smile', rating: 'general', status: 'done', image: '/favicon.svg?filename=x.png', width: 832, height: 1216, mine: [], drawn: [], at: new Date().toISOString() }]));
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.goto(origin + '/');
  await page.waitForFunction(() => document.getElementById('dc-btn') && !('booting' in document.documentElement.dataset), null, { timeout: 30000 });
  const slot = page.locator('#dc-routes');

  await step('面板最上面有分頻道區塊', async () => {
    await page.locator('#dc-btn').click();
    await slot.getByText('分頻道', { exact: true }).waitFor();
    await slot.getByText('還沒有頻道。').waitFor();
  });

  await step('新增：沒名字、沒網址、沒條件時不能存', async () => {
    await slot.getByRole('button', { name: '＋ 新增頻道' }).click();
    const save = slot.getByRole('button', { name: '新增頻道' });
    assert.equal(await save.isDisabled(), true);
    await slot.getByPlaceholder('例如：芙莉蓮、全年齡收藏').fill('約兒');
    await slot.locator('input[type=password]').fill(HOOK);
    assert.equal(await save.isDisabled(), true);
    await slot.getByText('至少設一種條件（分級、角色或 tag）').waitFor();
  });

  await step('角色：搜尋中文、點偏好角色、滿 3 個鎖住、任一／全部', async () => {
    const pick = slot.locator('[data-pick="chars"]');
    await pick.locator('input[type=search]').fill('約兒');
    await pick.locator('.dcr-hit', { hasText: '約兒' }).first().click();
    await pick.locator('.dcr-chosen .dcr-chip', { hasText: '約兒' }).waitFor();
    assert.equal(await pick.locator('.dcr-mode').isHidden(), true, '只有一個時不顯示任一／全部');
    await pick.locator('.dcr-favs .dcr-chip', { hasText: '胡蝶忍' }).click();
    assert.equal(await pick.locator('.dcr-chosen .dcr-chip').count(), 2);
    await pick.getByRole('button', { name: '全部都要' }).click();
    await pick.locator('input[type=search]').fill('菲歐娜');
    await pick.locator('.dcr-hit').first().click();
    assert.equal(await pick.locator('.dcr-chosen .dcr-chip').count(), 3);
    assert.equal(await pick.locator('input[type=search]').isDisabled(), true);
    assert.equal(await pick.locator('.dcr-full').textContent(), '最多 3 個');
  });

  await step('存檔送出的內容對', async () => {
    await slot.getByRole('button', { name: '全年齡' }).click();
    const save = slot.getByRole('button', { name: '新增頻道' });
    assert.equal(await save.isDisabled(), false);
    await save.click();
    await slot.locator('.dcr-row', { hasText: '約兒' }).waitFor();
    const s = saves.at(-1);
    assert.deepEqual(s.chars, ['yor briar', 'kochou shinobu', 'fiona frost']);
    assert.equal(s.charMode, 'all');
    assert.deepEqual(s.ratings, ['general']);
    assert.equal(s.webhook, HOOK);
    assert.equal(s.compact, true);
    const sum = await slot.locator('.dcr-row .dcr-sum').textContent();
    assert.match(sum, /全年齡/);
    assert.match(sum, /約兒/);
    assert.match(sum, /（全部）/);
  });

  await step('網頁上看不到完整網址', async () => {
    const html = await slot.innerHTML();
    assert.ok(!html.includes(HOOK), '完整的 webhook 網址出現在畫面上');
  });

  await step('編輯：帶入原本的設定、網址留空沿用', async () => {
    await slot.locator('.dcr-row').getByRole('button', { name: '編輯' }).click();
    assert.equal(await slot.locator('[data-pick="chars"] .dcr-chosen .dcr-chip').count(), 3);
    assert.match(await slot.locator('input[type=password]').getAttribute('placeholder'), /已存/);
    await slot.getByRole('button', { name: '存頻道' }).click();
    await slot.locator('.dcr-row').waitFor();
    assert.equal(saves.at(-1).webhook, '', '編輯時網址留空');
    assert.equal(routes.length, 1);
    assert.equal(routes[0].webhook, HOOK, '沿用已存的網址');
  });

  await step('刪除要按兩次', async () => {
    const del = slot.locator('.dcr-row').getByRole('button', { name: '刪除' });
    await del.click();
    await slot.getByRole('button', { name: '確定刪除？' }).click();
    await slot.getByText('還沒有頻道。').waitFor();
    assert.equal(routes.length, 0);
  });

  await step('從一張圖開頻道：帶入角色、分級、名稱', async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('dc-modal')?.classList.contains('open'));
    await page.locator('#wall .shot img').first().click();
    await page.getByRole('button', { name: '用這張開 Discord 頻道' }).click();
    await slot.locator('.dcr-editor').waitFor();
    const chips = await slot.locator('[data-pick="chars"] .dcr-chosen .dcr-chip span').allTextContents();
    assert.deepEqual(chips, ['約兒']);
    assert.equal(await slot.getByRole('button', { name: '全年齡' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await slot.getByPlaceholder('例如：芙莉蓮、全年齡收藏').inputValue(), '約兒');
  });

  await step('主控台沒有錯誤', async () => assert.deepEqual(errors, []));
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}
if (fails) {
  console.log(`${fails} failed`);
  process.exit(1);
}
console.log('discord routes browser checks passed');

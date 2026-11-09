// Real setup panel and translations, fake API. Never installs nodes or generates images.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Playwright: PLAYWRIGHT_MODULE, then a project/global install, then a local Codex runtime copy.
const { chromium } = (() => {
  const { homedir } = require('node:os');
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', resolve(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
  for (const name of tries) {
    try { return require(name); } catch {}
  }
  throw new Error('Playwright not found. Run: npm install --no-save playwright && npx playwright install chromium');
})();
const root = resolve(import.meta.dirname, '..'), frontend = existsSync(resolve(root, 'web6/index.html')) ? 'web6' : 'web';
const texts = {
  install: '選用：安裝 LoRA Manager 到 ComfyUI，安裝 Python 套件並加入詳情連結補丁；裝完要重開 ComfyUI',
  patch: '選用：修改 LoRA Manager 的 loras.js，讓詳情連結直接開啟指定 LoRA；不用重開 ComfyUI',
};
let snap, answers = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/setup') {
    if (req.method === 'POST') {
      let raw = ''; for await (const part of req) raw += part;
      const answer = JSON.parse(raw); answers.push(answer);
      snap = { ...snap, active: false, items: snap.items.map(it => ({ ...it, state: 'skip', text: '這次先不要' })) };
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ ok: true, ...snap })); return;
  }
  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html><head><script src="/language.js"></script><link rel="stylesheet" href="/styles.css"></head><body><script type="module" src="/i18n.js"></script><script type="module" src="/setup-panel.js"></script></body></html>'); return;
  }
  const name = decodeURIComponent(url.pathname).replace(/^\//, '');
  let file = resolve(root, frontend, name);
  if (!existsSync(file)) file = resolve(root, 'web', name);
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({ '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  for (const locale of ['en-US', 'zh-TW']) for (const action of ['install', 'patch']) {
    snap = { started: true, active: true, restart: false, items: [{ id: 'lora', title: 'LoRA Manager', state: 'ask', action, text: texts[action], answers: ['yes', 'no', 'never'] }] };
    answers = [];
    const context = await browser.newContext({ locale, viewport: { width: 390, height: 844 } });
    await context.route('https://**/*', r => r.abort());
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const panel = page.locator('#setup-panel');
    await panel.waitFor();
    assert.equal(await panel.locator('.setup-answers button').count(), 3);
    assert.deepEqual(answers, [], 'Showing the question must not send an installation answer');
    const buttons = await panel.locator('.setup-answers button').allTextContents();
    assert.deepEqual(buttons, locale === 'en-US' ? ['Allow', 'Not now', 'Never ask'] : ['允許', '這次不要', '不要再問']);
    if (locale === 'en-US') assert.equal(/[\u3400-\u9fff]/.test(await panel.innerText()), false, 'Setup copy is translated');
    const answer = action === 'patch' ? 'never' : 'no';
    await panel.getByRole('button', { name: buttons[answer === 'never' ? 2 : 1], exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.setup-answers'));
    assert.deepEqual(answers, [{ id: 'lora', answer }]);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Setup panel: installation/patch choices in English/Traditional Chinese passed');
  // ComfyUI not running: only waits left -> one title line, the eight identical waits merged into one row;
  // a choice made in this tab is kept; once ComfyUI starts and work begins, the panel opens by itself.
  const waitTitles = ['LoRA Manager', 'Hires 放大模型', '姿勢參考', '修臉（FaceDetailer）', '圖片解析（WD14 Tagger）', '烘焙卡面', '敏感、色情卡面', '角色卡面'];
  const waitingSnap = () => ({ started: true, active: true, restart: false, items: [
    { id: 'cards', title: '卡面插畫', state: 'done', text: '' },
    ...waitTitles.map((title, i) => ({ id: 'w' + i, title, state: 'wait', text: '等 ComfyUI 開起來' })),
  ] });
  const openPage = async (locale) => {
    const context = await browser.newContext({ locale, viewport: { width: 1440, height: 900 } });
    await context.route('https://**/*', r => r.abort());
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const panel = page.locator('#setup-panel');
    await panel.waitFor();
    return { context, page, panel, errors };
  };
  for (const locale of ['en-US', 'zh-TW']) {
    snap = waitingSnap();
    const { context, page, panel, errors } = await openPage(locale);
    assert.equal(await panel.getAttribute('data-collapsed'), 'true', 'Waiting for ComfyUI starts collapsed');
    assert.equal(await panel.locator('.setup-head').getAttribute('aria-expanded'), 'false');
    await page.waitForFunction(() => !/[\u3400-\u9fff]/.test(document.querySelector('.setup-title').textContent) || document.documentElement.lang !== 'en');
    assert.equal(await panel.locator('.setup-title').textContent(), locale === 'en-US' ? 'First-time setup: waiting for ComfyUI (8 left)' : '第一次使用：等 ComfyUI 開起來（還有 8 項）');
    await panel.locator('.setup-head').click();
    assert.equal(await panel.getAttribute('data-collapsed'), 'false');
    assert.equal(await panel.locator('.setup-item').count(), 1, 'Eight identical waits become one row');
    assert.equal(await panel.locator('.setup-names > span').count(), 8);
    if (locale === 'en-US') assert.equal(/[\u3400-\u9fff]/.test(await panel.innerText()), false, 'Waiting copy is translated');
    await page.reload();
    await panel.waitFor();
    assert.equal(await panel.getAttribute('data-collapsed'), 'false', 'A choice made in this tab is kept');
    assert.deepEqual(errors, []);
    await context.close();
  }
  {
    snap = waitingSnap();
    const { context, page, panel, errors } = await openPage('zh-TW');
    assert.equal(await panel.getAttribute('data-collapsed'), 'true');
    snap = { ...snap, items: snap.items.map(it => it.id === 'w0' ? { ...it, state: 'run', text: '安裝到 ComfyUI 的 custom_nodes' } : it) };
    await page.waitForFunction(() => document.querySelector('#setup-panel')?.dataset.collapsed === 'false', null, { timeout: 10000 });
    assert.match(await panel.locator('.setup-title').textContent(), /^第一次使用：準備中 0\/8$/);
    assert.equal(await panel.locator('.setup-item').count(), 2, 'The running step gets its own row; the rest still share one');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('Setup panel: waiting for ComfyUI stays one collapsed line and opens when work starts');
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}

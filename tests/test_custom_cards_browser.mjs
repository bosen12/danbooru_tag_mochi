// 自製牌（web6 卡冊的「自製」花色）：真的伺服器（隔離的資料夾、假烘焙）＋真的頁面。
// 卡冊：貼提示詞拆牌（封鎖、建議、分級下限）、烤預覽、存檔、取消會丟預覽、詳情、刪除與復原；
// 墨池：放進合成池是一格（成員收在裡面）、送出的提示詞有成員和詞庫外的字、拿出時成員一起走；
// 疊印台：成員逐張上卡池（角色牌在「人物」那一層）、試印的提示詞有詞庫外的字；英文版編輯面板沒有漏翻。
// 不連 ComfyUI、不生圖：/api/gen、/api/interrupt 一律攔下。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
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
const tmp = mkdtempSync(resolve(tmpdir(), 'mochi-custom-'));
const port = await new Promise((ok) => { const s = createServer().listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const env = {
  ...process.env, WEB_DIR: frontend, PORT: String(port), PYTHONUTF8: '1', NO_SETUP: '1', NO_CARD_BAKE: '1', NO_CARD_FETCH: '1',
  NO_LORA_MANAGER_FETCH: '1', NO_UPSCALE_FETCH: '1', NO_POSE_FETCH: '1', NO_FACE_FETCH: '1', NO_OUTPUT_PRUNE: '1', NO_HIRES_PRUNE: '1',
  CUSTOM_CARD_FAKE_BAKE: '1', COMFY_API: 'http://127.0.0.1:1', OPEN_BROWSER: '0',
  CUSTOM_CARDS_PATH: resolve(tmp, 'custom_cards.json'), CUSTOM_CARDS_DIR: resolve(tmp, 'custom_cards'),
  CARD_USAGE_PATH: resolve(tmp, 'usage.json'), CARD_DECKS_PATH: resolve(tmp, 'decks.json'), CARD_FAV_CHARS_PATH: resolve(tmp, 'fav.json'),
  GEN_LOG_PATH: resolve(tmp, 'gen_log.jsonl'), RECIPE_DATA_DIR: resolve(tmp, 'recipes'), APP_SETTINGS: resolve(tmp, 'settings.json'),
  WORKFLOW_DATA_DIR: resolve(tmp, 'workflows'), DISCORD_SECRETS_PATH: resolve(tmp, 'discord.json'),
};
const py = (process.env.TEST_PY || 'python').split(' ');
const srv = spawn(py[0], [...py.slice(1), 'server.py'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
srv.stdout.on('data', (d) => (log += d));
srv.stderr.on('data', (d) => (log += d));
const origin = `http://127.0.0.1:${port}`;
const drafts = () => (existsSync(resolve(tmp, 'custom_cards/drafts')) ? readdirSync(resolve(tmp, 'custom_cards/drafts')) : []);
const PROMPT = '1girl, falin touden, solo focus, mature female, (huge breasts:1.2), cow print bikini, bikini, cowboy shot, standing, bursting breasts, beach, outdoors, people, sparkle eyelashes, blond hair, loli';

// 卡冊開頁後使用次數晚到會整排重畫花色分頁：點到被換掉的那顆就沒反應。點了要確認真的選中，沒有就再點。
async function pickSuitTab(page, selector) {
  for (let i = 0; i < 10; i++) {
    await page.click(selector);
    try {
      await page.waitForFunction((sel) => document.querySelector(sel)?.getAttribute('aria-pressed') === 'true', selector, { timeout: 1000 });
      return;
    } catch {}
  }
  throw new Error('suit tab never got selected: ' + selector);
}

let browser;
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(origin + '/api/custom-cards')).ok) break; } catch {}
    if (i > 80) throw new Error('server did not start\n' + log);
    await new Promise((r) => setTimeout(r, 250));
  }
  browser = await chromium.launch({ headless: true });
  const open = async (path, { lang = 'zh', settings = { rating: 'sensitive', n: 1 } } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, permissions: ['clipboard-read', 'clipboard-write'], locale: lang === 'en' ? 'en-US' : 'zh-TW' });
    await ctx.addInitScript(([s, lang]) => {
      localStorage.setItem('mochi.tour.seen.v1', 'true');
      localStorage.setItem('mochi.community.asked.v1', '1');
      localStorage.setItem('mochi.book.tour.v1', '1');
      localStorage.setItem('mochi.settings.v1', JSON.stringify(s));
      localStorage.setItem('mochi.fuse.settings.v1', JSON.stringify(s));
      localStorage.setItem('mochi.language.v1', lang === 'en' ? 'en' : 'zh-Hant');
    }, [settings, lang]);
    const page = await ctx.newPage();
    const errors = [];
    const gen = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/gen**', (r) => { if (r.request().method() === 'POST') gen.push(JSON.parse(r.request().postData() || '{}')); return r.abort(); });
    await page.route('**/api/interrupt**', (r) => r.abort());
    await page.goto(origin + '/' + path);
    return { page, ctx, errors, gen };
  };

  // ---------- 卡冊：取消會丟預覽 ----------
  {
    const { page, ctx, errors } = await open('book.html');
    await page.waitForSelector('.book-cell[data-tag="1girl"]');
    await pickSuitTab(page, '#book-suits .suit-tab:last-child');
    assert.match(await page.textContent('.book-empty b'), /還沒有自製牌/);
    await page.click('.group-chip.cc-new');
    await page.waitForSelector('.cce');
    await page.click('.cce-mode button[data-v="paste"]');
    await page.fill('.cce-paste', '1girl, beach');
    await page.waitForTimeout(400);
    await page.click('.cce-face-ctl .btn');
    await page.waitForFunction(() => document.querySelector('.cce-face-pic')?.dataset.kind === 'preview', null, { timeout: 15000 });
    assert.equal(drafts().filter((f) => !f.endsWith('.tmp')).length, 2, 'preview and its thumbnail are in drafts');
    await page.click('.sheet-foot .btn:has-text("取消")');
    await page.waitForTimeout(800);
    assert.deepEqual(drafts(), [], 'cancel drops the preview');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---------- 卡冊：編輯器的字盒（花色、細分類、搜尋、分級、放大卡）跟墨池的字盒同一套 ----------
  {
    const { page, ctx, errors } = await open('book.html', { settings: { rating: 'general', n: 1 } });
    await page.waitForSelector('.book-cell[data-tag="1girl"]');
    await pickSuitTab(page, '#book-suits .suit-tab:last-child');
    await page.click('.group-chip.cc-new');
    await page.waitForSelector('.cce-grid > .card');
    const cards = () => page.evaluate(() => document.querySelectorAll('.cce-grid > .card').length);
    const first = await cards();
    await page.evaluate(() => { const b = document.querySelector('.cce-grid-box'); b.scrollTop = b.scrollHeight; });
    await page.waitForFunction((n) => document.querySelectorAll('.cce-grid > .card').length > n, first);
    // 細分類：選了花色才出現，跟字盒一樣有「全部」和細分類籤。
    await page.click('.cce-suits .suit-tab[data-suit="look"]');
    const chips = await page.evaluate(() => [...document.querySelectorAll('.cce-groups .group-chip')].map((b) => b.textContent.trim()));
    assert.equal(chips[0], '全部');
    assert.ok(chips.length > 5, 'appearance has sub-category chips: ' + chips.join(','));
    await page.click('.cce-suits .suit-tab[data-suit="chara"]');
    assert.ok(await page.locator('.cce-groups .chip-gender').count(), 'characters get the gender chips');
    // 搜尋：完全相符排第一、Enter 加第一張；點牌只改勾，捲動位置不跳。
    await page.click('.cce-suits .suit-tab[data-suit="all"]');
    await page.fill('.cce-q', '紅髮');
    assert.equal(await page.evaluate(() => document.querySelector('.cce-grid .is-enter-target')?.dataset.tag), 'red hair');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.cce-chip[data-tag="red hair"]');
    assert.ok(await page.$eval('.cce-grid > .card[data-tag="red hair"]', (n) => n.classList.contains('is-in')));
    await page.fill('.cce-q', '');
    await page.evaluate(() => { document.querySelector('.cce-grid-box').scrollTop = 500; });
    const tag = await page.evaluate(() => { const top = document.querySelector('.cce-grid-box').getBoundingClientRect().top; return [...document.querySelectorAll('.cce-grid > .card')].find((n) => n.getBoundingClientRect().top > top + 20).dataset.tag; });
    await page.click(`.cce-grid > .card[data-tag="${tag}"]`);
    assert.equal(await page.evaluate(() => document.querySelector('.cce-grid-box').scrollTop), 500, 'picking a card keeps the scroll position');
    // 分級：全年齡看不到色情的牌；搜得到就說要在哪一級，按鈕把這張的分級調上去。
    await page.fill('.cce-q', 'nude');
    await page.waitForSelector('.cce-grid .lib-hint');
    assert.match(await page.textContent('.cce-grid .lib-hint'), /才看得到/);
    await page.click('.cce-grid .lib-hint .btn');
    await page.waitForSelector('.cce-grid > .card[data-tag="nude"]');
    assert.equal(await page.getAttribute('.cce-rating button[aria-checked="true"]', 'data-v'), 'explicit');
    // 被花色篩掉：說在哪一格、給「看全部」。
    await page.click('.cce-suits .suit-tab[data-suit="scene"]');
    await page.fill('.cce-q', 'kimono');
    assert.match(await page.textContent('.cce-grid'), /在「服裝」裡/);
    // 字盒沒有的字：一鍵當詞庫外的字加進來。
    await page.fill('.cce-q', 'sparkle eyelashes');
    await page.click('.cce-miss .btn');
    await page.waitForSelector('.cce-chip.is-extra[data-text="sparkle eyelashes"]');
    // 滑鼠停著：浮出跟字盒同一張放大卡。
    await page.click('.cce-suits .suit-tab[data-suit="look"]');
    const box = await page.locator('.cce-grid > .card').first().boundingBox();
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForFunction(() => document.getElementById('card-peek')?.dataset.show === 'true', null, { timeout: 3000 });
    // 右邊的成員籤也浮放大卡，多一行現在的權重。
    await page.mouse.move(5, 5);
    await page.waitForFunction(() => document.getElementById('card-peek')?.dataset.show !== 'true');
    await page.click('.cce-chip[data-tag="red hair"] .cce-wbtn >> nth=1');
    await page.click('.cce-chip[data-tag="red hair"] .cce-wbtn >> nth=1');
    // 按過的那張要移開再停回來才浮（放大卡的規則：按下去的不擋路）。
    await page.mouse.move(5, 5, { steps: 3 });
    await page.waitForTimeout(200);
    const chipBox = await page.locator('.cce-chip[data-tag="red hair"] .cce-chip-name').boundingBox();
    await page.mouse.move(chipBox.x + 2, chipBox.y + 2);
    await page.mouse.move(chipBox.x + chipBox.width / 2, chipBox.y + chipBox.height / 2, { steps: 4 });
    await page.waitForFunction(() => document.getElementById('card-peek')?.dataset.show === 'true', null, { timeout: 3000 });
    assert.match(await page.textContent('#card-peek'), /red hair[\s\S]*權重\s*1\.2/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---------- 卡冊：貼提示詞、拆牌、存檔 ----------
  let customTag = '';
  {
    const { page, ctx, errors } = await open('book.html', { settings: { rating: 'general', n: 1 } });
    await page.waitForSelector('.book-cell[data-tag="1girl"]');
    await pickSuitTab(page, '#book-suits .suit-tab:last-child');
    await page.click('.group-chip.cc-new');
    await page.waitForSelector('.cce');
    await page.fill('.cce-name', '法琳海邊');
    await page.click('.cce-mode button[data-v="paste"]');
    await page.fill('.cce-paste', PROMPT);
    await page.waitForTimeout(500);
    const got = await page.evaluate(() => ({
      chips: [...document.querySelectorAll('.cce-chip')].map((c) => c.dataset.tag || c.dataset.text),
      notes: Object.fromEntries([...document.querySelectorAll('.cce-chip')].map((c) => [c.dataset.tag || c.dataset.text, [...c.querySelectorAll('.cce-note')].map((n) => n.textContent)])),
      banned: document.querySelector('.cce-banned')?.textContent || '',
      sug: document.querySelector('.cce-sug')?.textContent || '',
      ratings: [...document.querySelectorAll('.cce-rating button')].map((b) => [b.dataset.v, b.disabled, b.getAttribute('aria-checked')]),
      face: document.querySelector('.cce-face-in').value,
      fill: document.querySelector('.cce-fill').textContent,
    }));
    for (const t of ['1girl', 'falin touden', 'huge breasts', 'cow print bikini', 'bikini', 'bursting breasts', 'beach', 'people']) assert.ok(got.chips.includes(t), `member ${t}`);
    assert.ok(!/null|undefined/.test(await page.textContent('.cce-content')), 'no stray null/undefined in the card contents');
    assert.ok(got.chips.includes('sparkle eyelashes') && got.chips.includes('blond hair'), 'unknown words go to “not in lexicon”');
    assert.ok(!got.chips.includes('loli') && /loli/.test(got.banned), 'banned words are dropped and reported');
    assert.match(got.sug, /blonde hair/, 'near spelling is suggested');
    assert.deepEqual(got.notes['bikini'], ['「乳牛紋比基尼」已經會帶出它'], 'implied card: one note, no false “same slot”');
    assert.deepEqual(got.ratings.map((r) => r[1]), [true, false, false], 'all-ages is below the floor (bursting breasts is sensitive)');
    assert.equal(got.ratings.find((r) => r[2] === 'true')[0], 'sensitive');
    assert.match(got.fill, /\(huge breasts:1\.2\)/, 'weights survive');
    assert.match(got.face, /^1girl, solo focus, falin touden, dungeon meshi, adult, .*sensitive, masterpiece/, 'auto card face adds series, adult, rating tail');
    await page.click('.cce-sug');
    await page.fill('.cce-seed', '1383');
    await page.click('.cce-face-ctl .btn');
    await page.waitForFunction(() => document.querySelector('.cce-face-pic')?.dataset.kind === 'preview', null, { timeout: 15000 });
    await page.click('.sheet-foot .btn-primary');
    await page.waitForSelector('.cce', { state: 'detached' });
    await page.waitForTimeout(600);
    assert.deepEqual(drafts(), [], 'saving moves the preview out of drafts');
    const saved = (await (await fetch(origin + '/api/custom-cards')).json()).cards;
    assert.equal(saved.length, 1);
    const c = saved[0];
    customTag = 'custom:' + c.id;
    assert.equal(c.rating, 'sensitive');
    assert.equal(c.face.seed, 1383);
    assert.match(c.face.art, /^c_[0-9a-f]{8}-[0-9a-f]{10}\.webp$/);
    assert.ok(c.members.some((m) => m.tag === 'blonde hair') && !c.extra.some((x) => x.text === 'blond hair'), 'suggestion swapped the word for the card');
    // 分級是全年齡的卡冊照樣看得到自己做的牌，蓋「分級擋掉」。
    const cell = page.locator(`.book-cell[data-tag="${customTag}"]`);
    await cell.waitFor();
    assert.match(await cell.locator('.card-flag').textContent(), /分級擋掉/);
    // 詳情 → 刪除 → 復原
    await cell.locator('.card').click();
    await page.waitForSelector('.cc-members');
    await page.click('.sheet-foot .btn:has-text("刪除")');
    await page.waitForTimeout(500);
    assert.equal((await (await fetch(origin + '/api/custom-cards')).json()).cards.length, 0);
    await page.click('.toast button');
    await page.waitForTimeout(800);
    const back = (await (await fetch(origin + '/api/custom-cards')).json()).cards;
    assert.equal(back.length, 1);
    assert.equal(back[0].face.art, c.face.art, 'undo brings the card art back');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---------- 墨池：一格、送出的提示詞、拿出 ----------
  {
    const { page, ctx, errors, gen } = await open('');
    await page.waitForSelector('#lib-grid .card');
    await page.click('#suit-tabs .suit-tab:has-text("自製")');
    await page.click(`#lib-grid .card[data-tag="${customTag}"]`);
    await page.waitForTimeout(800);
    const slots = await page.evaluate(() => [...document.querySelectorAll('#pool-well .pool-slot')].map((s) => s.querySelector('.card').dataset.tag));
    assert.deepEqual(slots, [customTag], 'the custom card is one slot');
    assert.match(await page.textContent('#pool-count'), /^1[3-5] 張會一定進圖$/);
    await page.click('#go-bar button:has-text("只抽牌")');
    await page.waitForSelector('#wall button:has-text("送去印這張")');
    await page.click('#wall button:has-text("送去印這張")');
    await page.waitForTimeout(800);
    const pos = gen.find((g) => g.positive)?.positive || '';
    for (const t of ['falin touden', '(huge breasts:1.2)', 'cow print bikini', 'bursting breasts', 'beach', 'sparkle eyelashes']) assert.ok(pos.includes(t), `positive has ${t}: ${pos}`);
    assert.ok(!pos.includes('custom:'), 'the custom tag itself never reaches the engine');
    await page.click('#pool-well .pool-slot.is-custom .pool-x');
    await page.waitForTimeout(600);
    assert.equal(await page.locator('#pool-well .pool-slot').count(), 0, 'removing it takes its cards out');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---------- 疊印台：成員上卡池（角色在人物那一層）、試印帶詞庫外的字 ----------
  {
    const { page, ctx, errors, gen } = await open('fuse.html');
    await page.route('**/api/ping', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
    await page.waitForSelector('#trials .trial [data-key]');
    await page.click('#case-tabs button:has-text("自製")');
    await page.click(`#case-grid .card[data-tag="${customTag}"]`);
    await page.waitForTimeout(1200);
    const cast = await page.evaluate(() => [...document.querySelectorAll('#registers .register[data-suit="cast"] .plate-card')].map((c) => c.dataset.tag));
    assert.ok(cast.includes('falin touden'), 'character cards show on the 人物 row: ' + cast);
    await page.click('#print-bar .pb-go', { force: true });
    await page.waitForTimeout(1200);
    const pos = gen.find((g) => g.positive)?.positive || '';
    assert.ok(pos.includes('sparkle eyelashes') && pos.includes('falin touden'), 'fuse print has the members and the extra word: ' + pos);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // ---------- 英文版：編輯面板沒有漏翻（使用者內容除外） ----------
  {
    const { page, ctx, errors } = await open('book.html', { lang: 'en' });
    await page.waitForSelector('.book-cell[data-tag="1girl"]');
    await pickSuitTab(page, '#book-suits .suit-tab:last-child');
    await page.click('.group-chip.cc-new');
    await page.waitForSelector('.cce');
    await page.click('.cce-mode button[data-v="paste"]');
    await page.fill('.cce-paste', '1girl, beach, sparkle eyelashes');
    await page.waitForTimeout(800);
    const leftover = await page.evaluate(() => {
      const out = [];
      const walk = document.createTreeWalker(document.querySelector('.sheet'), NodeFilter.SHOW_TEXT);
      for (let n; (n = walk.nextNode()); ) {
        if (n.parentElement.closest('[data-no-i18n], textarea, code')) continue;
        if (/[一-鿿]/.test(n.textContent)) out.push(n.textContent.trim());
      }
      return out;
    });
    assert.deepEqual(leftover, [], 'untranslated text in the English editor');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('custom cards (book, ink pool, fuse press, English): passed');
} finally {
  await browser?.close();
  srv.kill();
  try { rmSync(tmp, { recursive: true, force: true }); } catch {}
}

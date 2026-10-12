// Real shared helpers in a local static fixture; no generation or external services.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
const root = resolve(import.meta.dirname, '..');
const frontend = existsSync(resolve(root, 'web6/index.html')) ? 'web6' : 'web';
const fixture = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0}.overlay{position:fixed;inset:0;background:#ddd}.sheet{margin:20px;padding:20px;background:white}
.list{position:absolute;top:300px;left:0}.item{height:50px;width:100px;background:#ccc}
</style><button id="outside">Outside</button><script type="module">
import * as ui from '/ui.js'; import * as motion from '/motion.js';
window.ui=ui;window.motion=motion;motion.initMotion();window.ready=true;
</script>`;
const requests = [];
const server = createServer(async (req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1);
  requests.push(name);
  if (!name) { res.setHeader('Content-Type', 'text/html'); res.end(fixture); return; }
  if (name.startsWith('api/')) { res.writeHead(403).end(); return; }
  let file = resolve(root, frontend, name);
  if (!existsSync(file)) file = resolve(root, 'web', name);
  if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const failures = [];
async function scenario(name, options, run) {
  const context = await browser.newContext(options);
  const errors = [];
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(origin);
    await page.waitForFunction(() => window.ready);
    await run(page);
    assert.deepEqual(errors, [], 'Fixture must not have page errors');
    console.log(`PASS ${name}`);
  } catch (e) { failures.push({ name, message: e.message }); console.error(`FAIL ${name}: ${e.message}`); }
  finally { await context.close(); }
}
const desktop = { viewport: { width: 1100, height: 800 } };
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
async function makeSheet(page) {
  await page.evaluate(() => {
    const body = document.createElement('div');
    body.innerHTML = `<button id="first">First</button><textarea id="last"></textarea>
      <button hidden>Hidden</button><button style="display:none">Display none</button>
      <button style="visibility:hidden">Invisible</button><button tabindex="-1">Negative</button>
      <div inert><button>Inert</button></div><fieldset disabled><button>Disabled fieldset</button></fieldset>`;
    window.sheet = ui.openSheet('Test sheet', body);
  });
}
try {
  browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  await scenario('sheet Tab skips hidden, negative, inert and disabled controls', desktop, async page => {
    await makeSheet(page);
    await page.locator('#last').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.className), 'sheet-close', 'Tab from textarea must wrap to visible close control');
    await page.locator('.sheet-close').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'last', 'Shift+Tab must reach textarea, skipping unusable controls');
  });
  await scenario('sheet summary participates and lost focus recovers', desktop, async page => {
    await page.evaluate(() => {
      const body = document.createElement('div');
      body.innerHTML = '<button id="first">First</button><details><summary id="last">Summary</summary><button>Closed content</button></details><div id="non-tab" tabindex="-1">Status</div>';
      window.sheet = ui.openSheet('Summary sheet', body);
    });
    await page.locator('.sheet-close').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'last', 'Closed details summary is a Tab destination');
    await page.locator('#non-tab').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'last', 'Focus outside the Tab sequence must recover to the last control');
    await page.evaluate(() => { document.querySelector('.sheet-close').disabled = true; document.querySelector('#first').disabled = true; document.querySelector('details').hidden = true; });
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement === sheet.sheet), true, 'An empty Tab sequence must retain focus in the dialog');
  });
  await scenario('sheet positive tabindex order and close restore focus', desktop, async page => {
    await page.locator('#outside').focus();
    await page.evaluate(() => {
      const body = document.createElement('div');
      body.innerHTML = '<button id="early" tabindex="1">Early</button><button id="later" tabindex="2">Later</button><textarea id="tail"></textarea>';
      window.sheet = ui.openSheet('Tab order sheet', body);
    });
    await page.locator('#tail').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'early', 'Wrap must follow positive tabindex order');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tail', 'Reverse wrap must follow the same sequence');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'outside', 'Closing restores the original focus');
  });
  for (const reducedMotion of ['no-preference', 'reduce']) {
    await scenario(`mobile pointercancel keeps dragged sheet open (${reducedMotion})`, { ...mobile, reducedMotion }, async page => {
      await makeSheet(page);
      await page.evaluate(() => {
        const grip = document.querySelector('.sheet-grip');
        const event = (type, y) => grip.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 17, clientY: y }));
        event('pointerdown', 20); event('pointermove', 140); event('pointercancel', 140);
      });
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.sheet').count(), 1, 'A cancelled 120px gesture must not dismiss');
      assert.equal(await page.locator('.sheet').evaluate(n => getComputedStyle(n).transform), 'none', 'Cancelled drag must reset its transform');
      await page.evaluate(() => {
        const grip = document.querySelector('.sheet-grip');
        for (const [type, y] of [['pointerdown', 20], ['pointermove', 140], ['pointerup', 140]]) grip.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 18, clientY: y }));
      });
      await page.waitForTimeout(220);
      assert.equal(await page.locator('.sheet').count(), 0, 'A completed downward drag must still dismiss');
    });
    await scenario(`mobile cancelled swipe preserves later close transition (${reducedMotion})`, { ...mobile, reducedMotion }, async page => {
      await page.evaluate(async () => {
        await Promise.all(['/tokens.css', '/styles.css'].map(href => new Promise((resolve, reject) => {
          const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; link.onload = resolve; link.onerror = reject; document.head.append(link);
        })));
      });
      await page.locator('#outside').focus();
      await makeSheet(page);
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const grip = document.querySelector('.sheet-grip');
        for (const [type, y] of [['pointerdown', 20], ['pointermove', 140], ['pointercancel', 140]]) grip.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 20, clientY: y }));
      });
      await page.waitForTimeout(400);
      assert.equal(await page.locator('.sheet').evaluate(n => getComputedStyle(n).transform), 'none', 'Cancelled swipe settles without replaying sheet entry');
      await page.locator('.sheet-close').click();
      const closing = await page.evaluate(() => ({
        name: getComputedStyle(sheet.sheet).animationName,
        connected: sheet.sheet.isConnected,
        inClose: sheet.sheet.parentElement.dataset.closing,
        focus: document.activeElement.id,
      }));
      assert.equal(closing.name, reducedMotion === 'reduce' ? 'none' : 'sheet-down', 'Clearing drag overrides at close must permit the production exit animation');
      assert.equal(closing.connected, true, 'Close transition retains the sheet until removal');
      assert.equal(closing.inClose, 'true');
      assert.equal(closing.focus, 'outside', 'Closing releases the background and restores focus');
      await page.waitForTimeout(220);
      assert.equal(await page.locator('.sheet').count(), 0, 'Close removes the sheet after its exit window');
      assert.equal(await page.evaluate(() => ui.anyOverlay()), false, 'The cancelled-swipe close releases overlay state');
      await makeSheet(page);
      const swipe = await page.evaluate(() => {
        const grip = document.querySelector('.sheet-grip');
        for (const [type, y] of [['pointerdown', 20], ['pointermove', 140], ['pointerup', 140]]) grip.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', pointerId: 21, clientY: y }));
        const exit = sheet.sheet.getAnimations().find(animation => !(animation instanceof CSSAnimation) && animation.effect.getKeyframes()[0].transform === 'translateY(120px)');
        if (!exit) return null;
        exit.pause(); exit.currentTime = 0;
        return { frames: exit.effect.getKeyframes().map(frame => frame.transform), duration: exit.effect.getTiming().duration, transform: getComputedStyle(sheet.sheet).transform };
      });
      if (reducedMotion === 'reduce') assert.equal(swipe, null, 'Reduced motion still skips the swipe exit effect');
      else {
        assert.deepEqual(swipe.frames, ['translateY(120px)', 'translateY(100%)'], 'Successful swipe keeps its existing WAAPI exit path');
        assert.equal(swipe.duration, 220, 'Successful swipe keeps the short exit duration');
        assert.equal(swipe.transform, 'matrix(1, 0, 0, 1, 0, 120)', 'CSS close animation must not override the successful swipe position');
      }
      await page.waitForTimeout(220);
      assert.equal(await page.locator('.sheet').count(), 0, 'Successful swipe removes the sheet even if an exit effect was interrupted');
    });
  }
  await scenario('unchanged aria-pressed does not replay seating', desktop, async page => {
    await page.evaluate(() => {
      const button = document.createElement('button'); button.id = 'toggle'; button.className = 'pressable'; button.setAttribute('aria-pressed', 'false'); document.body.append(button);
    });
    await page.waitForTimeout(30);
    await page.locator('#toggle').evaluate(n => n.setAttribute('aria-pressed', 'false'));
    await page.waitForTimeout(30);
    assert.equal(await page.locator('#toggle').evaluate(n => n.classList.contains('is-seated')), false, 'Writing the same state must not animate');
    await page.locator('#toggle').evaluate(n => n.setAttribute('aria-pressed', 'true'));
    await page.waitForTimeout(30);
    assert.equal(await page.locator('#toggle').evaluate(n => n.classList.contains('is-seated')), true, 'An actual toggle still seats');
    await page.locator('#toggle').evaluate(n => n.setAttribute('aria-pressed', 'true'));
    await page.waitForTimeout(335);
    assert.equal(await page.locator('#toggle').evaluate(n => n.classList.contains('is-seated')), false, 'Repeated unchanged writes must not extend the animation');
  });
  for (const helper of ['flip', 'flipBy']) {
    await scenario(`${helper} rapid reordering continues from current position`, desktop, async page => {
      const result = await page.evaluate(async helper => {
        const list = document.createElement('div'); list.className = 'list';
        list.innerHTML = '<div class="item" data-key="a">A</div><div class="item" data-key="b">B</div><div class="item" data-key="c">C</div>';
        document.body.append(list);
        window.list = list;
        const run = change => helper === 'flip' ? motion.flip(list, change) : motion.flipBy(list, '.item', n => n.dataset.key, change);
        const unrelated = list.firstElementChild.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 10000 });
        window.unrelated = unrelated;
        run(() => list.prepend(list.lastElementChild));
        await new Promise(r => setTimeout(r, 65));
        const before = [...list.children].map(n => n.getBoundingClientRect().top);
        run(() => list.append(list.firstElementChild));
        const after = [...list.children].map(n => [n.dataset.key, n.getBoundingClientRect().top]);
        const positions = Object.fromEntries([['c', before[0]], ['a', before[1]], ['b', before[2]]]);
        return { jumps: after.map(([key, y]) => Math.abs(y - positions[key])), unrelated: unrelated.playState };
      }, helper);
      assert.ok(result.jumps.every(v => v < 2), `Interrupted reordering must not jump: ${JSON.stringify(result.jumps)}`);
      assert.equal(result.unrelated, 'running', 'Unrelated animation must survive');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(30);
      assert.deepEqual(await page.locator('.item').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).transform)), ['none', 'none', 'none'], 'Changing preference must settle active FLIP transforms');
      assert.equal(await page.evaluate(() => unrelated.playState), 'running', 'Preference cleanup must only cancel helper-owned animations');
      await page.evaluate(helper => {
        const change = () => list.prepend(list.lastElementChild);
        helper === 'flip' ? motion.flip(list, change) : motion.flipBy(list, '.item', n => n.dataset.key, change);
      }, helper);
      assert.deepEqual(await page.locator('.item').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).transform)), ['none', 'none', 'none'], 'Reduced motion reorders immediately');
    });
    for (const reducedMotion of ['no-preference', 'reduce']) {
      await scenario(`${helper} repeated mobile changes settle (${reducedMotion})`, { ...mobile, reducedMotion }, async page => {
        const result = await page.evaluate(async ({ helper, reducedMotion }) => {
          const list = document.createElement('div'); list.className = 'list';
          list.innerHTML = '<div class="item" data-key="a">A</div><div class="item" data-key="b">B</div><div class="item" data-key="c">C</div>';
          document.body.append(list);
          const jumps = [];
          for (let i = 0; i < 8; i++) {
            const before = new Map([...list.children].map(n => [n.dataset.key, n.getBoundingClientRect().top]));
            const change = () => {
              list.prepend(list.lastElementChild);
              // Exercise the keyed helper's real replaceChildren path as well as its retained-node path.
              if (helper === 'flipBy') list.replaceChildren(...[...list.children].map(n => n.cloneNode(true)));
            };
            if (helper === 'flip') motion.flip(list, change);
            else motion.flipBy(list, '.item', n => n.dataset.key, change);
            if (reducedMotion !== 'reduce') for (const n of list.children) jumps.push(Math.abs(n.getBoundingClientRect().top - before.get(n.dataset.key)));
            await new Promise(r => setTimeout(r, 20));
          }
          await new Promise(r => setTimeout(r, motion.DUR.medium + 50));
          return { jumps, transforms: [...list.children].map(n => getComputedStyle(n).transform), top: [...list.children].map(n => n.getBoundingClientRect().top) };
        }, { helper, reducedMotion });
        assert.ok(result.jumps.every(v => v < 2), `Repeated changes must maintain visual position: ${JSON.stringify(result.jumps)}`);
        assert.deepEqual(result.transforms, ['none', 'none', 'none'], 'Repeated changes must finish with no transform');
        assert.deepEqual(result.top, [300, 350, 400], 'Cards settle in their current layout slots');
      });
    }
  }
  assert.equal(requests.some(name => name.startsWith('api/')), false, 'Shared fixture must not make API calls');
  assert.deepEqual(failures, [], 'Shared interaction regressions must pass');
} finally { await browser?.close(); await new Promise(r => server.close(r)); }

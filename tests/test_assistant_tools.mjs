import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { clampTagWeight } from "../web/engine.js";
import { HARD_BANNED } from "../web/card-art.js";
// 這邊在 web6/，開源版（danbooru_tag_mochi）在 web/：同一支測試兩邊都能跑。
const front = existsSync(new URL("../web6/assistant-tools.js", import.meta.url)) ? "../web6/" : "../web/";
const { TEXT, TOOL_DEFS, toolSchemas, createToolRunner } = await import(new URL(front + "assistant-tools.js", import.meta.url));
const { buildSystemPrompt } = await import(new URL(front + "assistant-prompt.js", import.meta.url));

// 假的工作台：互斥、附帶、廢字簍只做測試要的那一點，規則本身仍以 runner 的判斷為準。
function world(opts = {}) {
  const cards = new Map(Object.entries(opts.cards || {}));
  let pool = (opts.pool || []).map((p) => ({ weight: 1, ...p }));
  let bans = new Set(opts.bans || []);
  const settings = {
    n: 2,
    counts: { feature: 2, clothing: 2, pose: 2, env: 2 },
    rating: "general",
    ratingFree: false,
    heats: ["activity"],
    eras: ["modern"],
    girl: true,
    boy: false,
    samePerson: false,
    drawCharacter: false,
    groups: {},
    ...(opts.settings || {}),
  };
  settings.counts = { feature: 2, clothing: 2, pose: 2, env: 2, ...(opts.settings?.counts || {}) };
  settings.groups = { ...(opts.settings?.groups || {}) };
  let groups = (opts.groups || []).map((g) => ({ ...g, tags: [...g.tags] }));
  let version = opts.version ?? 1;
  let ready = opts.ready !== false;
  const log = [];
  const highlights = [];
  const counted = () => pool.filter((p) => !p.custom).length;
  function preview(tags) {
    const next = pool.map((p) => ({ ...p }));
    const have = new Set(next.map((p) => p.tag));
    const ban = new Set(bans);
    const added = [];
    const companions = [];
    const displaced = [];
    const unbanned = [];
    for (const tag of tags) {
      const info = cards.get(tag);
      if (ban.has(tag)) {
        ban.delete(tag);
        unbanned.push(tag);
      }
      if (info?.mutex) {
        for (const p of [...next]) {
          const other = cards.get(p.tag);
          if (p.tag !== tag && other?.mutex && other.mutex === info.mutex) {
            const at = next.findIndex((x) => x.tag === p.tag);
            if (at >= 0) next.splice(at, 1);
            have.delete(p.tag);
            if (!displaced.includes(p.tag)) displaced.push(p.tag);
          }
        }
      }
      if (!have.has(tag)) {
        next.push({ tag, zh: info?.zh || tag, weight: 1, custom: !!info?.custom, members: info?.members });
        have.add(tag);
        added.push(tag);
      }
      for (const c of info?.companions || []) {
        if (ban.has(c)) {
          ban.delete(c);
          if (!unbanned.includes(c)) unbanned.push(c);
        }
        if (!have.has(c)) {
          const ci = cards.get(c);
          next.push({ tag: c, zh: ci?.zh || c, weight: 1 });
          have.add(c);
          companions.push(c);
        }
      }
    }
    return { added, companions, displaced, unbanned, total: next.filter((p) => !p.custom).length, next, ban };
  }
  const api = {
    log,
    highlights,
    version: () => version,
    bump: () => { version += 1; },
    state: () => ({
      room: opts.room || "mochi",
      ready,
      lang: "zh-Hant",
      pool: pool.map((p) => ({ ...p })),
      poolCount: counted(),
      bans: [...bans],
      settings: { ...settings, counts: { ...settings.counts }, groups: structuredClone(settings.groups) },
      infinite: !!opts.infinite,
      lastBatch: opts.lastBatch || null,
    }),
    search(query, o) {
      log.push(["search", query, o]);
      return opts.search ? opts.search(query, o) : [];
    },
    cardInfo: (tag) => (cards.has(tag) ? { tag, ...cards.get(tag) } : null),
    previewPins(tags) {
      log.push(["preview", [...tags]]);
      const p = preview(tags);
      return { added: p.added, companions: p.companions, displaced: p.displaced, unbanned: p.unbanned, total: p.total };
    },
    pin(tags) {
      log.push(["pin", [...tags]]);
      const p = preview(tags);
      pool = p.next;
      bans = p.ban;
      version += 1;
      return { added: p.added, companions: p.companions, displaced: p.displaced, unbanned: p.unbanned, total: p.total };
    },
    unpin(tags) {
      log.push(["unpin", [...tags]]);
      const drop = new Set(tags);
      const removed = [];
      pool = pool.filter((p) => {
        if (!drop.has(p.tag)) return true;
        removed.push(p.tag);
        return false;
      });
      version += 1;
      return { removed, total: counted() };
    },
    setWeight(tag, w) {
      log.push(["weight", tag, w]);
      const p = pool.find((x) => x.tag === tag);
      const from = p ? p.weight : 1;
      if (p) p.weight = w;
      version += 1;
      return { tag, from, to: w };
    },
    setN(n) {
      log.push(["n", n]);
      const from = settings.n;
      settings.n = n;
      version += 1;
      return { from, to: n };
    },
    setSectionCounts(patch) {
      log.push(["counts", { ...patch }]);
      const changes = [];
      for (const [k, v] of Object.entries(patch)) {
        changes.push({ section: k, from: settings.counts[k], to: v });
        settings.counts[k] = v;
      }
      version += 1;
      return { changes };
    },
    groups: () => groups.map((g) => ({
      ...g,
      tags: [...g.tags],
      picked: !!(settings.groups[g.section]?.ids || []).includes(g.id),
      mode: settings.groups[g.section]?.mode || "whole",
    })),
    setGroupPicks(section, ids, mode) {
      log.push(["picks", section, [...ids], mode]);
      const from = { ids: [...(settings.groups[section]?.ids || [])], mode: settings.groups[section]?.mode || "whole" };
      if (ids.length) settings.groups[section] = { ids: [...ids], mode };
      else delete settings.groups[section];
      version += 1;
      return { section, from, to: { ids: [...ids], mode } };
    },
    saveGroup({ name, section, tags }) {
      log.push(["save", name, section, [...tags]]);
      const group = { id: "g-new", name, section, tags: [...tags] };
      groups.push({ ...group, picked: false, mode: "whole" });
      version += 1;
      return { group, skipped: [] };
    },
    draw({ n }) {
      log.push(["draw", n]);
      version += 1;
      const requested = n;
      const made = opts.drawMade ?? requested;
      return { requested, made, shotIds: Array.from({ length: made }, (_, i) => `s${i}`), warnings: opts.warnings || [] };
    },
    highlight(target, phase) {
      highlights.push([phase, target?.area, target?.key]);
    },
    _pool: () => pool,
    _settings: () => settings,
    _bans: () => bans,
  };
  return api;
}

const beachCards = {
  beach: { zh: "海邊", section: "env", companions: ["outdoors"] },
  outdoors: { zh: "戶外", section: "env" },
  dress: { zh: "洋裝", section: "clothing", mutex: "outfit" },
  swimsuit: { zh: "泳裝", section: "clothing", mutex: "outfit" },
  hat: { zh: "帽子", section: "clothing" },
  smile: { zh: "微笑", section: "feature" },
};

function names(log, kind) {
  return log.filter((row) => row[0] === kind);
}

function plain(n, extra = {}) {
  const cards = { ...beachCards };
  const pool = [];
  for (let i = 0; i < n; i++) {
    const tag = `t${i}`;
    cards[tag] = { zh: `牌${i}`, section: "env" };
    pool.push({ tag, zh: `牌${i}`, weight: 1 });
  }
  return world({ cards, pool, ...extra });
}

const turn = (version = 1) => ({ version });

// ---------- 工具表 ----------
const namesExpected = ["get_workspace", "find_cards", "card_info", "suggest_check", "change_pool", "set_draw_count", "set_section_counts", "list_groups", "set_group_picks", "save_card_group", "draw_cards"];
assert.deepEqual(TOOL_DEFS.map((t) => t.name), namesExpected);
assert.deepEqual(toolSchemas().map((t) => t.name), namesExpected);
for (const tool of TOOL_DEFS) {
  assert.equal(typeof tool.description, "string");
  assert.ok(tool.description.includes("不要"), tool.name);
  assert.ok(tool.input_schema && tool.input_schema.type === "object", tool.name);
  assert.equal(tool.input_schema.additionalProperties, false, tool.name);
  assert.ok(tool.kind === "read" || tool.kind === "write");
}
for (const tool of toolSchemas()) assert.equal("kind" in tool, false);
assert.deepEqual(TOOL_DEFS.filter((t) => t.kind === "read").map((t) => t.name), ["get_workspace", "find_cards", "card_info", "suggest_check", "list_groups"]);
// 每一句給人看的字（TEXT）都要在英文版的詞表裡（web6/locales/en.js；開源版在 web/），不然英文介面會冒出中文。
const enFile = ["../web6/locales/en.js", "../web/locales/en.js"].map((p) => new URL(p, import.meta.url)).find((u) => existsSync(u));
const enLines = readFileSync(enFile, "utf8").split(/\r?\n/).filter((l) => l.includes("|") && !l.startsWith("  ") && !l.startsWith("/"));
const enLeft = new Map(enLines.map((l) => [l.slice(0, l.indexOf("|")), l.slice(l.indexOf("|") + 1)]));
const phrases = [...new Set(Object.values(TEXT))];
for (const tpl of phrases) assert.ok(enLeft.has(tpl), `en.js 缺 ${tpl}`);
for (const tpl of phrases) assert.ok(String(enLeft.get(tpl)).trim(), `en.js 的 ${tpl} 沒有英文`);
console.log("ok: schemas and phrase list");

// ---------- 讀 ----------
{
  const ctx = world({ cards: beachCards, pool: [{ tag: "beach", zh: "海邊", weight: 1.2 }], bans: ["hat"] });
  const runner = createToolRunner(ctx);
  const seen = await runner.run({ id: "w1", name: "get_workspace", args: {} }, { turn: turn(1) });
  assert.equal(seen.ok, true);
  assert.equal(seen.status, "done");
  assert.equal(seen.forModel.poolCount, 1);
  assert.equal(seen.forModel.version, 1);
  assert.deepEqual(seen.forModel.bans, ["hat"]);
  assert.equal(seen.target.area, "pool");
  assert.deepEqual(ctx.highlights, [["read", "pool", undefined], ["clear", "pool", undefined]]);
  JSON.stringify(seen.forModel);
  const found = await runner.run({ id: "f1", name: "find_cards", args: { query: "海邊", section: "env", limit: 5 } }, { turn: turn(1) });
  assert.equal(found.ok, true);
  assert.deepEqual(ctx.log[0], ["search", "海邊", { limit: 5, section: "env" }]);
  const emptyQ = await runner.run({ name: "find_cards", args: { query: "  " } });
  assert.equal(emptyQ.ok, false);
  assert.equal(emptyQ.forModel.code, "bad_args");
  const badLimit = await runner.run({ name: "find_cards", args: { query: "帽", limit: 0 } });
  assert.equal(badLimit.ok, false);
  const badSection = await runner.run({ name: "find_cards", args: { query: "帽", section: "nope" } });
  assert.equal(badSection.ok, false);
  const defLimit = await runner.run({ name: "find_cards", args: { query: "帽" } });
  assert.equal(defLimit.ok, true);
  assert.equal(ctx.log.at(-1)[2].limit, 8);
  const info = await runner.run({ name: "card_info", args: { tag: "dress" } });
  assert.equal(info.ok, true);
  assert.equal(info.forModel.section, "clothing");
  const gone = await runner.run({ name: "card_info", args: { tag: "not_a_card" } });
  assert.equal(gone.ok, true);
  assert.equal(gone.forModel.found, false);
  assert.match(gone.summary, /詞庫沒有/);
  console.log("ok: workspace, search, card info");
}

// ---------- 檢查不寫入、40 張、確認 ----------
{
  const ctx = world({
    cards: beachCards,
    pool: [{ tag: "dress", zh: "洋裝", weight: 1 }],
    bans: ["hat"],
  });
  const runner = createToolRunner(ctx);
  const check = await runner.run({ name: "suggest_check", args: { tags: ["swimsuit"] } }, { turn: turn(1) });
  assert.equal(check.ok, true);
  assert.equal(check.status, "done");
  assert.deepEqual(check.forModel.displaced, ["dress"]);
  assert.equal(names(ctx.log, "pin").length, 0);
  assert.ok(check.lines.some((l) => l.includes("洋裝")));
  const over = plain(39);
  const overRunner = createToolRunner(over);
  const looked = await overRunner.run({ name: "suggest_check", args: { tags: ["beach"] } }, { turn: turn(1) });
  assert.equal(looked.forModel.total, 41);
  assert.match(looked.summary, /超過 40/);
  assert.equal(names(over.log, "pin").length, 0);
  const blocked = await overRunner.run({ name: "change_pool", args: { add: ["beach"] } }, { turn: turn(1) });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, "failed");
  assert.equal(blocked.forModel.code, "pool_limit");
  assert.ok(blocked.forModel.replaceable.length >= 8);
  assert.equal(names(over.log, "pin").length, 0);
  assert.equal(over._pool().length, 39);
  const exact = plain(38);
  const exactRunner = createToolRunner(exact);
  const fit = await exactRunner.run({ id: "add40", name: "change_pool", args: { add: ["beach"] } }, { turn: turn(1) });
  assert.equal(fit.ok, true);
  assert.equal(fit.status, "done");
  assert.equal(exact._pool().filter((p) => !p.custom).length, 40);
  assert.equal(names(exact.log, "pin").length, 1);
  const room = plain(39);
  const roomRunner = createToolRunner(room);
  const freed = await roomRunner.run({ name: "change_pool", args: { remove: ["t0"], add: ["beach"] } }, { turn: turn(1) });
  assert.equal(freed.ok, true, freed.summary);
  assert.equal(room._pool().some((p) => p.tag === "t0"), false);
  assert.equal(room._pool().some((p) => p.tag === "beach"), true);
  assert.equal(room._pool().filter((p) => !p.custom).length, 40);
  console.log("ok: preview and pool limit");
}

{
  const ctx = world({ cards: beachCards, pool: [{ tag: "dress", zh: "洋裝", weight: 1 }] });
  const runner = createToolRunner(ctx);
  const ask = await runner.run({ id: "c-swap", name: "change_pool", args: { add: ["swimsuit"] } }, { turn: turn(1) });
  assert.equal(ask.status, "needs_confirm");
  assert.equal(ask.ok, false);
  assert.equal(names(ctx.log, "pin").length, 0);
  assert.equal(ctx._pool()[0].tag, "dress");
  assert.deepEqual(ask.confirm.choices, ["套用", "保留原狀"]);
  assert.match(ask.confirm.prompt, /洋裝/);
  assert.equal(ctx.highlights.at(-1)[0], "write");
  const again = await runner.run({ id: "c-swap", name: "change_pool", args: { add: ["swimsuit"] } }, { turn: turn(1) });
  assert.equal(again.confirm.token, ask.confirm.token);
  assert.equal(names(ctx.log, "pin").length, 0);
  const applied = await runner.confirm(ask.confirm.token);
  assert.equal(applied.ok, true);
  assert.equal(applied.status, "done");
  assert.equal(names(ctx.log, "pin").length, 1);
  assert.equal(ctx._pool().some((p) => p.tag === "swimsuit"), true);
  assert.equal(ctx._pool().some((p) => p.tag === "dress"), false);
  const twice = await runner.confirm(ask.confirm.token);
  assert.equal(twice, applied);
  assert.equal(names(ctx.log, "pin").length, 1);
  const replay = await runner.run({ id: "c-swap", name: "change_pool", args: { add: ["swimsuit"] } }, { turn: turn(9) });
  assert.equal(replay.status, "done");
  assert.equal(names(ctx.log, "pin").length, 1);
  const unknown = await runner.confirm("nope");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.forModel.code, "confirm_unknown");
  console.log("ok: confirm displace, replay, second confirm");
}

{
  const ctx = world({ cards: beachCards, pool: [], bans: ["hat"] });
  const runner = createToolRunner(ctx);
  const ask = await runner.run({ id: "c-ban", name: "change_pool", args: { add: ["hat"] } }, { turn: turn(1) });
  assert.equal(ask.status, "needs_confirm");
  assert.match(ask.confirm.prompt, /廢字簍|帽子/);
  assert.equal(ctx._bans().has("hat"), true);
  ctx.bump();
  const stale = await runner.confirm(ask.confirm.token);
  assert.equal(stale.ok, false);
  assert.equal(stale.forModel.code, "stale");
  assert.equal(names(ctx.log, "pin").length, 0);
  assert.equal(ctx._bans().has("hat"), true);
  const fresh = world({ cards: beachCards, pool: [], bans: ["hat"] });
  const runner2 = createToolRunner(fresh);
  const ask2 = await runner2.run({ id: "c-ban2", name: "change_pool", args: { add: ["hat"] } }, { turn: turn(1) });
  const done = await runner2.confirm(ask2.confirm.token);
  assert.equal(done.ok, true);
  assert.equal(fresh._bans().has("hat"), false);
  assert.equal(fresh._pool().some((p) => p.tag === "hat"), true);
  assert.equal(done.undo, undefined);
  console.log("ok: confirm unban, stale confirm");
}

// 會擠掉人、又超過 40：不能靠按套用放進去。
{
  const cards = { ...beachCards, swimsuit: { ...beachCards.swimsuit, companions: ["outdoors"] } };
  const pool = [{ tag: "dress", zh: "洋裝", weight: 1 }];
  for (let i = 0; i < 39; i++) {
    cards[`t${i}`] = { zh: `牌${i}`, section: "env" };
    pool.push({ tag: `t${i}`, zh: `牌${i}`, weight: 1 });
  }
  const ctx = world({ cards, pool });
  const runner = createToolRunner(ctx);
  const ask = await runner.run({ name: "change_pool", args: { add: ["swimsuit"] } }, { turn: turn(1) });
  assert.equal(ask.status, "failed");
  assert.equal(ask.forModel.code, "pool_limit");
  assert.equal(ask.confirm, undefined);
  assert.equal(names(ctx.log, "pin").length, 0);
  console.log("ok: over 40 is not confirmable");
}

// ---------- 版本、同一輪自己的寫入、重送 ----------
{
  const ctx = world({ cards: beachCards, pool: [{ tag: "smile", zh: "微笑", weight: 1 }] });
  const runner = createToolRunner(ctx);
  const shared = turn(1);
  const first = await runner.run({ id: "n1", name: "set_draw_count", args: { n: 4 } }, { turn: shared });
  assert.equal(first.summary, "一次 2 → 4");
  assert.equal(ctx._settings().n, 4);
  const second = await runner.run({ id: "sec1", name: "set_section_counts", args: { feature: 3 } }, { turn: shared });
  assert.equal(second.ok, true, second.summary);
  assert.equal(ctx._settings().counts.feature, 3);
  assert.equal(ctx._settings().counts.clothing, 2);
  ctx.bump();
  const third = await runner.run({ id: "sec2", name: "set_section_counts", args: { clothing: 0 } }, { turn: shared });
  assert.equal(third.ok, false);
  assert.equal(third.forModel.code, "stale");
  assert.equal(ctx._settings().counts.clothing, 2);
  assert.equal(names(ctx.log, "counts").length, 1);
  const later = await runner.run({ id: "sec3", name: "set_section_counts", args: { clothing: 0 } }, { turn: turn(ctx.version()) });
  assert.equal(later.ok, true);
  assert.equal(ctx._settings().counts.clothing, 0);
  const replay = await runner.run({ id: "n1", name: "set_draw_count", args: { n: 9 } }, { turn: turn(1) });
  assert.equal(replay.summary, "一次 2 → 4");
  assert.equal(names(ctx.log, "n").length, 1);
  const read = await runner.run({ name: "get_workspace", args: {} }, { turn: turn(1) });
  assert.equal(read.ok, true);
  assert.equal(read.forModel.settings.n, 4);
  console.log("ok: stale, own writes, same id");
}

// ---------- 復原只在值還是當初那一個 ----------
{
  const ctx = world({ cards: beachCards });
  const runner = createToolRunner(ctx);
  const set = await runner.run({ name: "set_draw_count", args: { n: 4 } }, { turn: turn(1) });
  ctx._settings().n = 9;
  const refused = await set.undo();
  assert.equal(refused.ok, false);
  assert.equal(ctx._settings().n, 9);
  assert.equal(names(ctx.log, "n").length, 1);
  const ctx2 = world({ cards: beachCards });
  const runner2 = createToolRunner(ctx2);
  const set2 = await runner2.run({ name: "set_draw_count", args: { n: 4 } }, { turn: turn(1) });
  const restored = await set2.undo();
  assert.equal(restored.ok, true);
  assert.equal(ctx2._settings().n, 2);
  const again = await set2.undo();
  assert.equal(again.ok, false);
  assert.equal(ctx2._settings().n, 2);
  const ctx3 = world({ cards: beachCards, pool: [{ tag: "smile", zh: "微笑", weight: 1 }] });
  const runner3 = createToolRunner(ctx3);
  const both = await runner3.run({ name: "set_section_counts", args: { feature: 3, clothing: 0 } }, { turn: turn(1) });
  assert.equal(both.ok, true);
  ctx3._settings().counts.clothing = 5;
  const no = await both.undo();
  assert.equal(no.ok, false);
  assert.equal(ctx3._settings().counts.feature, 3);
  assert.equal(ctx3._settings().counts.clothing, 5);
  const ctx4 = world({ cards: beachCards, pool: [] });
  const runner4 = createToolRunner(ctx4);
  const added = await runner4.run({ name: "change_pool", args: { add: ["smile"], weights: { smile: 1.2 } } }, { turn: turn(1) });
  assert.equal(added.ok, true);
  assert.equal(ctx4._pool()[0].weight, 1.2);
  ctx4._pool()[0].weight = 1.5;
  const keepWeight = await added.undo();
  assert.equal(keepWeight.ok, false);
  assert.equal(ctx4._pool()[0].tag, "smile");
  assert.equal(ctx4._pool()[0].weight, 1.5);
  const ctx5 = world({ cards: beachCards, pool: [] });
  const runner5 = createToolRunner(ctx5);
  const added2 = await runner5.run({ name: "change_pool", args: { add: ["smile"] } }, { turn: turn(1) });
  const back = await added2.undo();
  assert.equal(back.ok, true);
  assert.equal(ctx5._pool().length, 0);
  console.log("ok: undo only when untouched");
}

// ---------- 未成年、禁用、硬封鎖 ----------
{
  const cards = {
    ...beachCards,
    loli: { zh: "蘿莉", section: "feature", minor: false },
    miku: { zh: "初音未來", section: "subject", bannedChar: true },
  };
  const ctx = world({ cards, pool: [{ tag: "smile", zh: "微笑", weight: 1 }] });
  const runner = createToolRunner(ctx);
  for (const tag of ["loli", "幼女", "pacifier", "miku"]) {
    const r = await runner.run({ name: "change_pool", args: { add: [tag] } }, { turn: turn(ctx.version()) });
    assert.equal(r.ok, false, tag);
    assert.equal(r.forModel.code, "blocked", tag);
    assert.equal(names(ctx.log, "pin").length, 0, tag);
    assert.equal(ctx._pool().length, 1, tag);
  }
  assert.ok(HARD_BANNED.includes("pacifier"));
  const mixed = await runner.run({ name: "change_pool", args: { add: ["hat", "loli"] } }, { turn: turn(ctx.version()) });
  assert.equal(mixed.forModel.code, "blocked");
  assert.equal(ctx._pool().some((p) => p.tag === "hat"), false);
  const check = await runner.run({ name: "suggest_check", args: { tags: ["loli", "hat"] } }, { turn: turn(ctx.version()) });
  assert.equal(names(ctx.log, "preview").at(-1)[1].includes("loli"), false);
  assert.ok(check.forModel.blocked.some((b) => b.tag === "loli"));
  console.log("ok: minor and banned cards");
}

// ---------- 各工具的正常與失敗 ----------
{
  const ctx = world({ cards: beachCards, pool: [{ tag: "smile", zh: "微笑", weight: 1 }] });
  const runner = createToolRunner(ctx);
  assert.equal((await runner.run({ name: "nope", args: {} })).forModel.code, "unknown_tool");
  assert.equal((await runner.run({ name: "set_draw_count", args: { n: 0 } })).summary, "一次要介於 1 到 50");
  assert.equal((await runner.run({ name: "set_draw_count", args: { n: 51 } })).ok, false);
  assert.equal((await runner.run({ name: "set_draw_count", args: { n: 1.5 } })).ok, false);
  assert.equal((await runner.run({ name: "set_draw_count", args: { n: true } })).ok, false);
  assert.equal((await runner.run({ name: "set_draw_count", args: { n: "3" } })).ok, false);
  assert.equal((await runner.run({ name: "set_draw_count", args: { n: 4, heats: ["sex"] } })).forModel.code, "bad_args");
  const same = await runner.run({ name: "set_draw_count", args: { n: 2 } }, { turn: turn(1) });
  assert.equal(same.status, "skipped");
  assert.equal(names(ctx.log, "n").length, 0);
  assert.equal((await runner.run({ name: "set_section_counts", args: {} })).forModel.code, "bad_args");
  assert.equal((await runner.run({ name: "set_section_counts", args: { feature: 11 } })).ok, false);
  assert.equal((await runner.run({ name: "set_section_counts", args: { pose: -1 } })).ok, false);
  const zero = await runner.run({ name: "set_section_counts", args: { env: 0 } }, { turn: turn(ctx.version()) });
  assert.equal(zero.ok, true);
  assert.equal(ctx._settings().counts.env, 0);
  assert.equal(names(ctx.log, "counts").at(-1)[1].feature, undefined);
  assert.equal(runner.label({ name: "set_section_counts", args: { feature: 3 } }).zh, "正在把長相補牌數改成 3");
  assert.equal(runner.label({ name: "set_section_counts", args: { feature: 3 } }).area, "rules");
  assert.equal(runner.label({ name: "set_draw_count", args: { n: 4 } }).zh, "正在把一次改成 4");
  assert.equal(runner.label({ name: "set_section_counts", args: { feature: 1, pose: 2 } }).zh, "正在調整各段補牌數");
  assert.equal((await runner.run({ name: "change_pool", args: {} })).forModel.code, "bad_args");
  assert.equal((await runner.run({ name: "change_pool", args: { add: ["smile"], remove: ["smile"] } })).forModel.code, "bad_args");
  assert.equal((await runner.run({ name: "change_pool", args: { weights: { gone: 1.2 } } }, { turn: turn(ctx.version()) })).forModel.code, "missing");
  assert.equal((await runner.run({ name: "change_pool", args: { weights: { smile: 2 } } }, { turn: turn(ctx.version()) })).summary, "份量要介於 0.6 到 1.5");
  assert.equal((await runner.run({ name: "change_pool", args: { weights: { smile: "1.2" } } }, { turn: turn(ctx.version()) })).ok, false);
  const weighted = await runner.run({ name: "change_pool", args: { weights: { smile: 1.25 } } }, { turn: turn(ctx.version()) });
  assert.equal(weighted.ok, true);
  assert.equal(names(ctx.log, "weight").at(-1)[2], clampTagWeight(1.25));
  assert.equal(ctx._pool()[0].weight, 1.3);
  const already = await runner.run({ name: "change_pool", args: { add: ["smile"] } }, { turn: turn(ctx.version()) });
  assert.equal(already.status, "skipped");
  assert.equal(names(ctx.log, "pin").length, 0);
  const absent = await runner.run({ name: "change_pool", args: { remove: ["hat"] } }, { turn: turn(ctx.version()) });
  assert.equal(absent.status, "skipped");
  assert.equal(names(ctx.log, "unpin").length, 0);
  const removed = await runner.run({ name: "change_pool", args: { remove: ["smile"] } }, { turn: turn(ctx.version()) });
  assert.equal(removed.ok, true);
  assert.equal(ctx._pool().length, 0);
  assert.equal(names(ctx.log, "pin").length, 0);
  console.log("ok: validation and simple pool edits");
}

{
  const groups = [
    { id: "a", name: "長相 A", section: "feature", tags: ["smile"] },
    { id: "b", name: "長相 B", section: "feature", tags: ["smile"] },
    { id: "c", name: "海邊服", section: "clothing", tags: ["dress"] },
  ];
  const ctx = world({
    cards: beachCards,
    groups,
    settings: { groups: { feature: { ids: ["a"], mode: "mix" } } },
  });
  const runner = createToolRunner(ctx);
  const listed = await runner.run({ name: "list_groups", args: { section: "feature" } });
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.forModel.groups.map((g) => g.id), ["a", "b"]);
  assert.equal(listed.forModel.groups[0].picked, true);
  assert.equal((await runner.run({ name: "list_groups", args: { section: "quality" } })).ok, false);
  const missing = await runner.run({ name: "set_group_picks", args: { section: "feature", ids: ["nope"] } }, { turn: turn(1) });
  assert.equal(missing.forModel.code, "group_missing");
  assert.ok(missing.forModel.candidates.some((g) => g.id === "a"));
  assert.equal(names(ctx.log, "picks").length, 0);
  const keepMode = await runner.run({ name: "set_group_picks", args: { section: "feature", ids: ["a", "b"] } }, { turn: turn(1) });
  assert.equal(keepMode.ok, true);
  assert.equal(names(ctx.log, "picks").at(-1)[3], "mix");
  assert.deepEqual(ctx._settings().groups.feature.ids, ["a", "b"]);
  const cleared = await runner.run({ name: "set_group_picks", args: { section: "clothing", ids: [], mode: "whole" } }, { turn: turn(ctx.version()) });
  assert.equal(cleared.status, "skipped");
  const picked = await runner.run({ name: "set_group_picks", args: { section: "clothing", ids: ["c"], mode: "whole" } }, { turn: turn(ctx.version()) });
  assert.equal(picked.ok, true);
  assert.equal(ctx._settings().groups.clothing.mode, "whole");
  ctx._settings().groups.clothing.ids = ["changed"];
  const undoPick = await picked.undo();
  assert.equal(undoPick.ok, false);
  assert.deepEqual(ctx._settings().groups.clothing.ids, ["changed"]);
  assert.equal((await runner.run({ name: "set_group_picks", args: { section: "feature", ids: ["a"], mode: "sideways" } }, { turn: turn(ctx.version()) })).ok, false);
  assert.equal((await runner.run({ name: "set_group_picks", args: { section: "feature", ids: Array.from({ length: 51 }, (_, i) => `g${i}`) } }, { turn: turn(ctx.version()) })).ok, false);
  const dup = await runner.run({ name: "save_card_group", args: { name: "長相 A", section: "feature", tags: ["smile"] } }, { turn: turn(ctx.version()) });
  assert.equal(dup.forModel.code, "name_taken");
  assert.equal(names(ctx.log, "save").length, 0);
  const badCard = await runner.run({ name: "save_card_group", args: { name: "海邊散步", section: "clothing", tags: ["smile", "dress"] } }, { turn: turn(ctx.version()) });
  assert.equal(badCard.ok, true);
  assert.equal(badCard.status, "partial");
  assert.deepEqual(names(ctx.log, "save").at(-1)[3], ["dress"]);
  assert.ok(badCard.lines.some((l) => l.includes("微笑")));
  const none = await runner.run({ name: "save_card_group", args: { name: "空", section: "pose", tags: ["dress"] } }, { turn: turn(ctx.version()) });
  assert.equal(none.ok, false);
  assert.equal(names(ctx.log, "save").length, 1);
  const minorGroup = await runner.run({ name: "save_card_group", args: { name: "不行", section: "feature", tags: ["loli"] } }, { turn: turn(ctx.version()) });
  assert.equal(minorGroup.forModel.code, "blocked");
  assert.equal((await runner.run({ name: "save_card_group", args: { name: "  ", section: "feature", tags: ["smile"] } })).forModel.code, "bad_args");
  assert.equal((await runner.run({ name: "save_card_group", args: { name: "很".repeat(41), section: "feature", tags: ["smile"] } }, { turn: turn(ctx.version()) })).ok, false);
  ctx.saveGroup = async () => { throw new Error("伺服器回 500"); };
  const boom = await runner.run({ name: "save_card_group", args: { name: "另一組", section: "feature", tags: ["smile"] } }, { turn: turn(ctx.version()) });
  assert.equal(boom.ok, false);
  assert.match(boom.forModel.error, /500/);
  console.log("ok: groups");
}

{
  const ctx = world({ cards: beachCards, settings: { n: 2 } });
  const runner = createToolRunner(ctx);
  const drawn = await runner.run({ id: "d1", name: "draw_cards", args: {} }, { turn: turn(1) });
  assert.equal(drawn.ok, true);
  assert.deepEqual(names(ctx.log, "draw").at(-1), ["draw", 2]);
  assert.equal(names(ctx.log, "n").length, 0);
  assert.equal(ctx._settings().n, 2);
  assert.equal(drawn.target.area, "wall");
  const once = await runner.run({ name: "draw_cards", args: { n: 3 } }, { turn: turn(ctx.version()) });
  assert.equal(once.ok, true);
  assert.equal(names(ctx.log, "draw").at(-1)[1], 3);
  assert.equal(ctx._settings().n, 2);
  assert.equal(once.undo, undefined);
  const short = world({ cards: beachCards, drawMade: 1 });
  const shortRun = createToolRunner(short);
  const part = await shortRun.run({ name: "draw_cards", args: { n: 3 } }, { turn: turn(1) });
  assert.equal(part.status, "partial");
  assert.match(part.summary, /1／3/);
  const none = world({ cards: beachCards, drawMade: 0 });
  const noneRun = createToolRunner(none);
  const empty = await noneRun.run({ name: "draw_cards", args: { n: 2 } }, { turn: turn(1) });
  assert.equal(empty.ok, false);
  const staleCtx = world({ cards: beachCards });
  staleCtx.bump();
  const staleRun = createToolRunner(staleCtx);
  const staleDraw = await staleRun.run({ name: "draw_cards", args: { n: 2 } }, { turn: turn(1) });
  assert.equal(staleDraw.forModel.code, "stale");
  assert.equal(names(staleCtx.log, "draw").length, 0);
  const stopped = new AbortController();
  stopped.abort();
  const skip = await runner.run({ name: "draw_cards", args: { n: 2 } }, { signal: stopped.signal, turn: turn(ctx.version()) });
  assert.equal(skip.status, "skipped");
  assert.equal(skip.forModel.code, "aborted");
  const cold = world({ cards: beachCards, ready: false });
  const coldRun = createToolRunner(cold);
  const notReady = await coldRun.run({ name: "draw_cards", args: { n: 1 } }, { turn: turn(1) });
  assert.equal(notReady.forModel.code, "not_ready");
  assert.equal(names(cold.log, "draw").length, 0);
  const stillRead = await coldRun.run({ name: "get_workspace", args: {} });
  assert.equal(stillRead.ok, true);
  assert.match(stillRead.summary, /還沒準備好/);
  console.log("ok: draw, abort, not ready");
}

{
  const ctx = world({ cards: beachCards, pool: [{ tag: "dress", zh: "洋裝", weight: 1 }] });
  const runner = createToolRunner(ctx);
  assert.equal(runner.label({ name: "change_pool", args: { add: ["swimsuit"] } }).zh, "正在加入「泳裝」");
  assert.equal(runner.label({ name: "change_pool", args: { add: ["swimsuit"] } }).area, "pool");
  assert.equal(runner.label({ name: "find_cards", args: { query: "海邊" } }).area, "lib");
  assert.equal(runner.label({ name: "draw_cards", args: { n: 3 } }).zh, "正在抽 3 張");
  assert.equal(runner.label({ name: "save_card_group", args: { name: "海邊散步", section: "clothing" } }).area, "groups");
  const bad = await runner.run({ name: "change_pool", args: { add: "swimsuit" } });
  assert.equal(bad.forModel.code, "bad_args");
  assert.equal(ctx.highlights.length, 0);
  console.log("ok: labels and no highlight on bad args");
}

// ---------- 提示詞 ----------
{
  const zh = buildSystemPrompt({ lang: "zh-Hant", room: "mochi", now: "2026-11-18" });
  assert.match(zh, /2026-11-18/);
  assert.match(zh, /mochi|墨池/);
  assert.match(zh, /get_workspace/);
  assert.match(zh, /find_cards/);
  assert.match(zh, /40/);
  assert.match(zh, /幫我加入|交代/);
  assert.match(zh, /性侵/);
  assert.match(zh, /成年人物游泳/);
  assert.match(zh, /游泳時遇到危險並獲救/);
  assert.match(zh, /未成年/);
  assert.doesNotMatch(zh, /用英文回覆/);
  const en = buildSystemPrompt({ lang: "en-US", room: "fuse", now: "now-1" });
  assert.match(en, /用英文回覆/);
  assert.match(en, /fuse/);
  assert.match(en, /now-1/);
  assert.match(en, /疊印台|還沒接上|不能改這個房間/);
  const bare = buildSystemPrompt({});
  assert.match(bare, /墨池/);
  console.log("ok: system prompt");
}

// 推理強度：頁面選單跟伺服器接受的值要一樣（不然選了存不進去）
{
  const pageSrc = readFileSync(new URL(front + "assistant.js", import.meta.url), "utf8");
  const pySrc = readFileSync(new URL("../assistant.py", import.meta.url), "utf8");
  const pageBlock = pageSrc.match(/const EFFORTS = \{([\s\S]*?)\};/)[1];
  const pyBlock = pySrc.match(/EFFORTS = \{([\s\S]*?)\r?\n\}/)[1];
  const parse = (s) => Object.fromEntries([...s.matchAll(/"?(\w+)"?:\s*[\[(]([^\])]*)[\])]/g)].map((m) => [m[1], [...m[2].matchAll(/"(\w+)"/g)].map((x) => x[1])]));
  const page = parse(pageBlock);
  const py = parse(pyBlock);
  assert.ok(Object.keys(py).length === 7, JSON.stringify(py));
  assert.deepEqual(page, py);
  console.log("ok: effort lists match server");
}

console.log("all ok");

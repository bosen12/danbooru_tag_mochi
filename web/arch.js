/**
 * 原理（arch.html）：給第一次用、不寫程式的人看「墨池是怎麼運作的」。
 *
 * 用的是真的詞庫和真的抽牌引擎：數字即時算，「抽一張」真的跑 drawOne（trace 開著，看每個字是怎麼來的），
 * 互斥、附帶的小池子用真的 applyPin。不連伺服器的 API、不生圖，只讀 lexicon.json 和卡面清單。
 *
 *   - 捲到哪一章，那一章的東西錯開浮上來（[data-reveal]）；左邊目錄亮那一格、頂端進度條跟著走。
 *   - 架構圖：點一塊看它做什麼；「演一次」讓一顆光點沿著線走過資料的路線。
 *   - 減少動態（prefers-reduced-motion）：全部直接出現，光點改成依序亮起。
 */
import { indexLexicon, drawOne, defaultSettings, mulberry32, applyPin } from "./engine.js";
import { ratingBlocked, RATING_LABEL } from "./rules/rating.js";
import { heatBlockedByRating } from "./scene-policy.js";
import { buildLibrary, createAssets, cardNode, groupChips, CARD_SUIT_INFO, CARD_SUITS, ERA_ZH } from "./cards.js";
import { el } from "./ui.js";
import { DUR, CURVE, css, reducedMotion } from "./motion.js";

const $ = (id) => document.getElementById(id);
let data = null;
let lex = null;
let lib = null;
let assets = null;

const zh = (tag) => lib?.byTag.get(tag)?.zh || lex?.byTag.get(tag)?.zh || tag;
const fmt = (n) => new Intl.NumberFormat().format(n);
const motion = () => !reducedMotion();
// 範例牌挑有插畫的；一張插畫都還沒有（剛裝好、卡面還沒下載）就用純字的牌，不要整段空掉或出錯。
const preferArt = (list) => {
  const drawn = list.filter((c) => assets.art(c.tag));
  return drawn.length ? drawn : list;
};

/** 一張小牌（跟墨池同一種牌面）。 */
function miniCard(tag, w = 64) {
  const card = lib.byTag.get(tag);
  if (!card) return el("span", { class: "chip-tag" }, zh(tag));
  const node = cardNode(card, assets, { tagName: "div" });
  node.style.setProperty("--card-w", `${w}px`);
  node.dataset.tag = tag;
  return node;
}

/* ================= 開機 ================= */

async function boot() {
  try {
    const [lexicon, manifest] = await Promise.all([
      fetch("lexicon.json").then((r) => r.json()),
      fetch("cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    data = lexicon;
    lex = indexLexicon(data);
    lib = buildLibrary(data, { ratingBlocked });
    assets = createAssets(manifest);
  } catch (err) {
    $("arch").prepend(el("p", { class: "note" }, "讀不到詞庫：請用啟動檔開（start.bat），不要直接點 HTML。", el("br"), String(err)));
    return;
  }
  fillStats();
  // 啟動清單捲進畫面時一項項打勾（arch.css 用 --n 錯開）。
  [...$("boot-steps").children].forEach((li, i) => li.style.setProperty("--n", String(i)));
  buildHero();
  buildMap();
  buildSuits();
  buildDraw();
  buildMutex();
  buildImply();
  buildMutexTop();
  buildRating();
  buildEras();
  buildRooms();
  watchReveal();
  watchToc();
}

/* ================= 數字 ================= */

function fillStats() {
  const groups = new Set(lib.cards.map((c) => `${c.item.section}|${c.group}`));
  const mutex = new Set(data.tags.map((t) => t.mutex).filter(Boolean));
  const implies = data.tags.filter((t) => (t.implies && t.implies.length) || (t.bind && t.bind.length)).length;
  const stats = { cards: lib.cards.length, groups: groups.size, mutex: mutex.size, implies, banned: (data.characterBan || []).length };
  for (const node of document.querySelectorAll("[data-stat]")) {
    const v = stats[node.dataset.stat];
    if (v == null) continue;
    countUp(node, v);
  }
}

/** 數字從 0 數上來（捲進畫面才開始）。 */
function countUp(node, to) {
  node.textContent = fmt(to);
  if (!motion()) return;
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    const t0 = performance.now();
    const dur = DUR.develop;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmt(Math.round(to * e));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  io.observe(node);
}

/* ================= 開場：一副牌流進一段提示詞 ================= */

function buildHero() {
  const deck = $("hero-deck");
  const prompt = $("hero-prompt");
  const withArt = (suit) => preferArt(lib.cards.filter((c) => c.suit === suit && c.rating === "general" && !c.banned));
  const pools = CARD_SUITS.map(withArt).filter((p) => p.length);
  let round = 0;
  const deal = () => {
    const rand = mulberry32(1000 + round++);
    const picks = pools.map((p) => p[Math.floor(rand() * p.length)]);
    const nodes = picks.map((c, i) => {
      const n = miniCard(c.tag, 96);
      n.style.setProperty("--i", String(i));
      n.style.setProperty("--n", String(picks.length));
      n.classList.add("hero-card");
      return n;
    });
    deck.replaceChildren(...nodes);
    prompt.replaceChildren(
      ...picks.map((c, i) => el("span", { class: "hero-tag", style: `--i:${i}`, dataset: { suit: c.suit } }, c.tag)),
      el("span", { class: "hero-tag is-tail", style: `--i:${picks.length}` }, "masterpiece, best quality")
    );
  };
  deal();
  if (motion()) setInterval(() => !document.hidden && deal(), 5200);
}

/* ================= 02 架構一張圖 ================= */

// 位置是 1000×560 的座標（中心點）。
const NODES = {
  you: { x: 80, y: 300, t: "你", s: "瀏覽器畫面", d: "你在瀏覽器裡點牌、按按鈕。電腦、手機都行（手機走 Tailscale 連回家裡這台）。" },
  rooms: { x: 250, y: 300, t: "五個房間", s: "web6/*.html", d: "墨池、疊印台、卡冊、作品冊、解析池。都是網頁，畫面、動畫、按鈕都在這裡。" },
  engine: { x: 455, y: 165, t: "抽牌引擎", s: "engine.js", d: "在你的瀏覽器裡跑：照規則把池子補完，排出提示詞。不用連網路就能算，所以抽牌是瞬間的。" },
  rules: { x: 455, y: 55, t: "規則表", s: "rules/*.js", d: "哪些字只在夜裡、哪些只在室內、哪個分級能用、誰跟誰不能同框、哪個動作要兩個人。引擎每抽一個字都問它。" },
  lexicon: { x: 690, y: 55, t: "詞庫", s: "lexicon.json", d: "每張牌的資料：中文名、花色、細分類、互斥格、附帶誰、哪些時代、哪些尺度。由原料用腳本產生，不手改。" },
  parts: { x: 905, y: 55, t: "詞庫原料", s: "lexicon_parts/", d: "一行一個字的原料、角色表、建議清單。合併、對 Danbooru 改名、補中文名，產生詞庫。" },
  setup: { x: 905, y: 180, t: "第一次準備", s: "setup_tasks.py", d: "伺服器開機時在背景檢查：卡面、Pillow、LoRA Manager、放大模型、姿勢、修臉、WD14，缺什麼補什麼、要問的先問。" },
  server: { x: 690, y: 300, t: "伺服器", s: "server.py", d: "在你的電腦上跑的小伺服器：把提示詞套進工作流程送 ComfyUI、傳回進度和成品、存你的資料、送 Discord、解析圖片。" },
  comfy: { x: 905, y: 300, t: "ComfyUI", s: "127.0.0.1:8188", d: "真正畫圖的地方。墨池不碰模型本身，只把工作流程交給它、等它畫完。" },
  model: { x: 905, y: 450, t: "底模、LoRA", s: "WAI-Illustrious…", d: "ComfyUI 裡的模型。底模決定畫風；LoRA 加角色、服裝、風格。在墨池的面板裡挑。" },
  data: { x: 690, y: 460, t: "你的資料", s: "data/", d: "使用次數、牌組、偏好角色、作品冊、出圖日誌、設定。所有裝置共用一份，搬家帶這個資料夾就好。" },
  cards: { x: 455, y: 450, t: "卡面", s: "web/cards/", d: "每張牌的插畫。全年齡的從 GitHub 下載；其他的用你的 ComfyUI 烤（bake_card_art.py）。" },
  discord: { x: 250, y: 460, t: "Discord", s: "選用", d: "印好的圖照分級、角色、標籤分頻道送出去。不設就不送。" },
};
const EDGES = [
  ["you", "rooms"], ["rooms", "engine"], ["engine", "rules"], ["engine", "lexicon"], ["parts", "lexicon"],
  ["rooms", "server"], ["server", "comfy"], ["comfy", "model"], ["server", "data"], ["server", "setup"],
  ["setup", "comfy"], ["comfy", "cards"], ["cards", "rooms"], ["server", "discord"], ["server", "lexicon"],
];
const ROUTES = {
  play: [
    ["you", "rooms", "按下抽並生圖"], ["rooms", "engine", "池子交給引擎"], ["engine", "rules", "每個字問規則"], ["engine", "lexicon", "查詞庫"],
    ["engine", "rooms", "排好提示詞"], ["rooms", "server", "送伺服器"], ["server", "comfy", "套進工作流程"], ["comfy", "model", "載入底模、LoRA"],
    ["comfy", "server", "邊畫邊傳預覽"], ["server", "data", "寫進日誌、記次數"], ["server", "rooms", "成品掛上牆"], ["rooms", "you", "你看到圖"], ["server", "discord", "（有設的話）送 Discord"],
  ],
  build: [
    ["parts", "lexicon", "原料合併成詞庫"], ["lexicon", "server", "伺服器發給網頁"], ["setup", "comfy", "第一次準備：缺卡面就烤"],
    ["comfy", "cards", "一張牌一張插畫"], ["cards", "rooms", "牌面上看得到"], ["lexicon", "engine", "引擎照詞庫抽"],
  ],
};

function buildMap() {
  const stage = $("map-stage");
  const svg = $("map-lines");
  const info = $("map-info");
  const paths = new Map();
  const key = (a, b) => [a, b].sort().join("|");
  for (const [a, b] of EDGES) {
    const A = NODES[a];
    const B = NODES[b];
    const mx = (A.x + B.x) / 2;
    const d = `M ${A.x} ${A.y} C ${mx} ${A.y}, ${mx} ${B.y}, ${B.x} ${B.y}`;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    p.setAttribute("class", "map-edge");
    svg.append(p);
    paths.set(key(a, b), { path: p, from: a });
  }
  const nodeEls = new Map();
  for (const [id, n] of Object.entries(NODES)) {
    const b = el(
      "button",
      { class: "map-node", type: "button", dataset: { id }, style: `left:${n.x / 10}%;top:${(n.y / 560) * 100}%` },
      el("b", {}, n.t),
      el("small", {}, n.s)
    );
    b.addEventListener("click", () => pick(id));
    stage.append(b);
    nodeEls.set(id, b);
  }
  const pick = (id) => {
    const n = NODES[id];
    for (const [k, b] of nodeEls) b.classList.toggle("is-on", k === id);
    for (const [k, e] of paths) e.path.classList.toggle("is-near", k.split("|").includes(id));
    info.replaceChildren(el("p", { class: "map-info-k" }, n.s), el("h3", {}, n.t), el("p", {}, n.d));
    if (motion()) info.animate([{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
  };
  pick("engine");

  let playing = 0;
  const play = async (route) => {
    const token = ++playing;
    for (const b of nodeEls.values()) b.classList.remove("is-lit");
    for (const e of paths.values()) e.path.classList.remove("is-run");
    for (const [a, b, label] of ROUTES[route]) {
      if (token !== playing) return;
      const e = paths.get(key(a, b));
      if (!e) continue;
      nodeEls.get(a).classList.add("is-lit");
      e.path.classList.add("is-run");
      info.replaceChildren(el("p", { class: "map-info-k" }, `${NODES[a].t} → ${NODES[b].t}`), el("h3", {}, label));
      await travel(svg, e.path, e.from !== a);
      nodeEls.get(b).classList.add("is-lit");
    }
  };
  $("map-play").addEventListener("click", () => play("play"));
  $("map-build").addEventListener("click", () => play("build"));
}

/** 一顆光點沿著線走（reverse：從線的另一頭走回來）。 */
function travel(svg, path, reverse) {
  const len = path.getTotalLength();
  if (!motion()) return new Promise((r) => setTimeout(r, 260));
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("r", "7");
  dot.setAttribute("class", "map-dot");
  svg.append(dot);
  const dur = 520 + len * 0.6;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const at = path.getPointAtLength((reverse ? 1 - ease(p) : ease(p)) * len);
      dot.setAttribute("cx", at.x);
      dot.setAttribute("cy", at.y);
      if (p < 1) requestAnimationFrame(step);
      else {
        dot.remove();
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

/* ================= 03 花色 ================= */

function buildSuits() {
  const box = $("suits");
  const view = $("suit-view");
  const show = (suit, btn) => {
    for (const b of box.children) b.setAttribute("aria-selected", b === btn ? "true" : "false");
    const cards = lib.cards.filter((c) => c.suit === suit && !c.banned);
    const runs = groupChips(cards);
    const subs = runs.flatMap((r) => r.items.map((i) => ({ ...i, fam: r.fam })));
    const counts = new Map();
    for (const c of cards) counts.set(c.group, (counts.get(c.group) || 0) + 1);
    const shown = preferArt(cards.filter((c) => c.rating === "general"));
    const rand = mulberry32(suit.length * 97 + cards.length);
    const sample = Array.from({ length: Math.min(8, shown.length) }, () => shown[Math.floor(rand() * shown.length)]).filter((c, i, a) => a.indexOf(c) === i);
    view.replaceChildren(
      el("div", { class: "suit-sum" }, el("b", {}, CARD_SUIT_INFO[suit].zh), el("span", {}, `${fmt(cards.length)} 張、${subs.length} 個細分類`)),
      el(
        "div",
        { class: "suit-subs" },
        subs
          .sort((a, b) => (counts.get(b.g) || 0) - (counts.get(a.g) || 0))
          .slice(0, 18)
          .map((s) => el("span", { class: "sub-chip" }, s.fam ? `${s.fam}・${s.short}` : s.zh, el("small", {}, String(counts.get(s.g) || 0))))
      ),
      el("div", { class: "suit-cards" }, sample.map((c) => miniCard(c.tag, 76)))
    );
    if (motion())
      [...view.querySelectorAll(".sub-chip, .card")].forEach((n, i) =>
        n.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: Math.min(i, 24) * 18, easing: css(CURVE.out), fill: "backwards" })
      );
  };
  for (const suit of CARD_SUITS) {
    const n = lib.cards.filter((c) => c.suit === suit && !c.banned).length;
    const b = el(
      "button",
      { class: "suit", type: "button", role: "tab", dataset: { suit }, "aria-selected": "false" },
      el("i", { "aria-hidden": "true", class: "suit-glyph" }, CARD_SUIT_INFO[suit].glyph),
      el("b", {}, CARD_SUIT_INFO[suit].zh),
      el("small", {}, fmt(n))
    );
    b.addEventListener("click", () => show(suit, b));
    box.append(b);
  }
  show(CARD_SUITS[0], box.children[0]);
}

/* ================= 04 抽一張 ================= */

const HEAT_ZH = { activity: "活動", tease: "誘惑", flash: "走光", sex: "性愛" };
const SOURCE_ZH = {
  pin: "你放的",
  implies: "附帶",
  bind: "附帶",
  era_anchor: "時代",
  random: "引擎補的",
  repair: "修補",
  preset: "起手式",
  must_draw: "必抽",
  fixed: "固定",
  lora_trigger: "LoRA",
};
const REASON_ZH = {
  mutex: "互斥", extra_mutex: "互斥", user_ban: "你封鎖的", heat_mismatch: "尺度不合", rating_mismatch: "分級擋掉",
  era_mismatch: "時代不合", cast_mismatch: "人數不合", pose_activity_conflict: "姿勢跟動作衝突", scene_activity_conflict: "場地跟動作衝突",
  sport_place_mismatch: "運動跟場地不合", clothing_layer: "衣服層次不對", underwear_hidden: "內衣被蓋住", missing_dependency: "缺前提",
  reconcile: "收尾整理", repair_remove: "修補拿掉", replaced: "被換掉",
};
const STAGES = [
  ["pin", "你放的牌先進場", "池子裡的牌一定在，連它附帶的一起。"],
  ["rating", "分級、尺度", "分級是上限；這一張抽一個尺度（活動、誘惑…）。"],
  ["era", "時代", "沒指定就隨機挑一個，整張照那個時代。"],
  ["people", "人物", "幾個人、男女：決定哪些動作能用。"],
  ["fill", "補骨架、補細節", "髮長、瞳色、鏡頭、表情、場地、晝夜…每格補一張，再照「每段抽幾個」補細節。"],
  ["check", "互斥、規則、修補", "同一格只留一張；夜晚不配藍天、室內不配海浪；缺衣服就補一件。"],
  ["prompt", "排成提示詞", "人數在前、畫質在後，送 ComfyUI。"],
];
const PIN_CHOICES = ["sundress", "red hair", "kimono", "onsen", "maid", "night", "cherry blossoms", "smile"];
const drawState = { pins: new Set(["sundress"]), rating: "general" };

function buildDraw() {
  const pins = $("draw-pins");
  const paintPins = () =>
    pins.replaceChildren(
      ...PIN_CHOICES.filter((t) => lex.byTag.has(t)).map((t) =>
        el(
          "button",
          { class: "chip-toggle pressable", type: "button", "aria-pressed": drawState.pins.has(t) ? "true" : "false", onclick: () => {
            if (drawState.pins.has(t)) drawState.pins.delete(t);
            else drawState.pins = applyPin(lex, drawState.pins, new Set(), t).pinned;
            paintPins();
          } },
          zh(t)
        )
      )
    );
  paintPins();
  const rbox = $("draw-rating");
  const paintRating = () =>
    rbox.replaceChildren(
      ...["general", "sensitive", "explicit"].map((r) =>
        el("button", { type: "button", role: "radio", "aria-checked": drawState.rating === r ? "true" : "false", onclick: () => ((drawState.rating = r), paintRating()) }, RATING_LABEL[r])
      )
    );
  paintRating();
  $("draw-stages").replaceChildren(
    ...STAGES.map(([k, t, d], i) => el("li", { dataset: { k } }, el("b", {}, `${i + 1}`), el("span", {}, el("strong", {}, t), el("small", {}, d))))
  );
  $("draw-legend").replaceChildren(
    ...["pin", "implies", "era_anchor", "random", "repair"].map((s) => el("span", { class: "src", dataset: { src: s } }, SOURCE_ZH[s]))
  );
  $("draw-go").addEventListener("click", runDraw);
  runDraw();
}

let drawToken = 0;
async function runDraw() {
  const token = ++drawToken;
  const seed = Math.floor(Math.random() * 1e6);
  $("draw-seed").textContent = String(seed);
  const s = defaultSettings(data);
  s.rating = drawState.rating;
  const d = drawOne(lex, s, new Set(drawState.pins), new Set(), mulberry32(seed), seed, { trace: true });
  const src = new Map((d.trace?.kept || []).map((k) => [k.tag, k]));
  const tags = d.positive.split(", ").filter(Boolean);
  const box = $("draw-tags");
  const chips = tags.map((t) => {
    const k = src.get(t);
    const source = k?.source || "fixed";
    const why = k?.parent ? `${zh(k.parent)} 附帶的` : SOURCE_ZH[source] || "畫質、評分詞";
    return el("span", { class: "dtag src", dataset: { src: source }, title: `${t} · ${why}`, onmouseenter: () => ($("draw-why").textContent = `${zh(t)} ← ${why}`) }, zh(t));
  });
  box.replaceChildren(...chips);
  const rej = d.trace?.rejected || [];
  const why = new Map();
  for (const r of rej) {
    const z = REASON_ZH[r.reason] || r.reason;
    why.set(z, (why.get(z) || 0) + 1);
  }
  $("draw-rej").textContent = rej.length
    ? `引擎考慮過、又拿掉的 ${rej.length} 個字：${[...why].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join("、")}`
    : "這一張沒有字被拿掉。";
  // 全年齡抽到的尺度只在內部用（決定哪些動作能出現），畫面上不寫，免得看起來像全年齡會出性愛。
  // 每一段各自一個 span：英文版逐段翻，不會被一條模板整句吃掉。
  const parts = [RATING_LABEL[drawState.rating]];
  if (!heatBlockedByRating(d.heat, drawState.rating)) parts.push(`尺度：${HEAT_ZH[d.heat] || d.heat}`);
  parts.push(`時代：${ERA_ZH[d.era] || d.era}`, `人數：${d.people}`, "滑鼠停在字上看它從哪來。");
  $("draw-why").replaceChildren(...parts.flatMap((p, i) => (i ? [" · ", el("span", {}, p)] : [el("span", {}, p)])));
  // 動畫：照來源分批進場，左邊的步驟一格格亮。
  const stages = [...$("draw-stages").children];
  for (const li of stages) li.classList.remove("is-on");
  if (!motion()) {
    for (const li of stages) li.classList.add("is-on");
    return;
  }
  for (const c of chips) c.style.opacity = "0";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const groups = [[0, ["pin", "implies", "bind"]], [4, ["era_anchor", "random"]], [5, ["repair", "fixed", "preset", "must_draw", "lora_trigger"]]];
  for (let i = 0; i < stages.length; i++) {
    if (token !== drawToken) return;
    stages[i].classList.add("is-on");
    const g = groups.find(([at]) => at === i);
    if (g) {
      const batch = chips.filter((c) => g[1].includes(c.dataset.src));
      batch.forEach((c, j) => {
        c.style.opacity = "";
        c.animate([{ opacity: 0, transform: "translateY(10px) scale(0.9)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, delay: j * 28, easing: css(CURVE.settle), fill: "backwards" });
      });
    }
    await wait(i === stages.length - 1 ? 0 : 260);
  }
  for (const c of chips) c.style.opacity = "";
}

/* ================= 05 互斥、附帶 ================= */

function buildMutex() {
  const choices = ["red hair", "black hair", "blonde hair", "white hair", "long hair", "short hair"].filter((t) => lex.byTag.has(t));
  let pool = new Set(["long hair"]);
  const poolBox = $("mutex-pool");
  const note = $("mutex-note");
  const sw = $("mutex-switch");
  const paint = (leaving = []) => {
    poolBox.replaceChildren(...[...pool].map((t) => miniCard(t, 64)));
    for (const t of leaving) {
      const ghost = miniCard(t, 64);
      ghost.classList.add("is-leaving");
      poolBox.append(ghost);
      if (motion()) ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-30px) rotate(-12deg) scale(0.9)" }], { duration: DUR.xl, easing: css(CURVE.exit), fill: "forwards" }).finished.then(() => ghost.remove());
      else ghost.remove();
    }
  };
  $("mutex-chips").replaceChildren(
    ...choices.map((t) =>
      el("button", { class: "chip-toggle pressable", type: "button", onclick: () => {
        const before = new Set(pool);
        pool = applyPin(lex, pool, new Set(), t, { keepMutex: !sw.checked }).pinned;
        const gone = [...before].filter((x) => !pool.has(x));
        paint(gone);
        const mx = lex.byTag.get(t)?.mutex;
        note.textContent = gone.length
          ? `放了${zh(t)}：${gone.map(zh).join("、")}跟它同一格（${MUTEX_ZH[mx] || mx}），換下來了。`
          : !sw.checked && [...pool].some((x) => x !== t && lex.byTag.get(x)?.mutex === mx)
            ? `互斥關著：${zh(t)}跟同一格的牌都留著，提示詞裡全部都寫。`
            : `放了${zh(t)}：跟池子裡的牌不同格，可以並存。`;
      } }, zh(t))
    )
  );
  sw.addEventListener("change", () => (note.textContent = sw.checked ? "互斥打開：同一格只留最新放的那張。" : "互斥關掉：同一格的牌都留著。"));
  paint();
  note.textContent = "池子裡有長髮。點紅髮，再點黑髮看看。";
}

function buildImply() {
  const choices = ["sundress", "kimono", "onsen", "maid", "fetal position", "nurse"].filter((t) => {
    const it = lex.byTag.get(t);
    return it && ((it.implies || []).length || (it.bind || []).length);
  });
  const poolBox = $("imply-pool");
  const note = $("imply-note");
  const sw = $("imply-switch");
  let root = null;
  let removed = new Set();
  const paint = () => {
    if (!root) return poolBox.replaceChildren(el("span", { class: "dim" }, "點上面一張牌"));
    const it = lex.byTag.get(root);
    const deps = [...(it.bind || []), ...(it.implies || [])].filter((t) => lex.byTag.has(t));
    poolBox.replaceChildren(
      miniCard(root, 64),
      el("span", { class: "imply-arrow", "aria-hidden": "true" }, "→"),
      ...deps.map((t) => {
        const off = removed.has(t);
        const back = off && sw.checked;
        const wrap = el(
          "span",
          { class: `imply-dep${off ? " is-off" : ""}${back ? " is-back" : ""}` },
          miniCard(t, 64),
          el("button", { class: "link-btn", type: "button", onclick: () => {
            if (off) removed.delete(t);
            else removed.add(t);
            note.textContent = removed.has(t)
              ? sw.checked
                ? `拿掉了${zh(t)}，但附帶打開：抽的時候${zh(root)}會把它抽回來（虛線那張）。`
                : `拿掉了${zh(t)}，附帶關著：抽的時候不會抽回來。`
              : `${zh(t)}放回來了。`;
            paint();
          } }, off ? "放回" : "拿掉")
        );
        return wrap;
      })
    );
    if (motion()) [...poolBox.querySelectorAll(".imply-dep")].forEach((n, i) => n.animate([{ opacity: 0, transform: "translateX(-14px)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, delay: 120 + i * 80, easing: css(CURVE.out), fill: "backwards" }));
  };
  $("imply-chips").replaceChildren(
    ...choices.map((t) =>
      el("button", { class: "chip-toggle pressable", type: "button", onclick: () => {
        root = t;
        removed = new Set();
        const it = lex.byTag.get(t);
        const deps = [...(it.bind || []), ...(it.implies || [])];
        note.textContent = `放了${zh(t)}：它附帶${deps.map(zh).join("、")}，一起放進來。`;
        paint();
      } }, zh(t))
    )
  );
  sw.addEventListener("change", paint);
  root = choices[0] || null;
  paint();
  note.textContent = root ? `放了${zh(root)}：附帶的牌一起進來。按「拿掉」看附帶開關的差別。` : "";
}

const MUTEX_ZH = {
  // 名字不要跟牌名撞（「鞋子」「連身衣」是牌的中文名，英文版會翻成那張牌）。
  hair_color: "髮色", eye_color: "瞳色", hair_length: "髮長", breast_size: "胸部大小", top: "上衣", bottom: "下身", onepiece: "連身服裝",
  feet: "鞋類", legs: "腿上", headwear: "頭部配件", camera: "鏡頭", expression: "表情", in_out: "室內外", body_pose: "身體姿勢", gaze: "視線",
  outer: "外套", neckwear: "脖子", hands: "手上", jewelry: "首飾", underwear_top: "內衣上", underwear_bottom: "內衣下", place: "地點",
  time: "晝夜", hair_style: "髮型", bangs: "瀏海", waist: "腰", activity: "活動", hand_g: "手勢", sex_act: "性愛動作", weather: "天氣",
};

function buildMutexTop() {
  const counts = new Map();
  for (const t of data.tags) if (t.mutex) counts.set(t.mutex, (counts.get(t.mutex) || 0) + 1);
  const top = [...counts].filter(([k]) => MUTEX_ZH[k]).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const max = top[0]?.[1] || 1;
  $("mutex-top").replaceChildren(
    el("h3", {}, "最大的幾個互斥格"),
    el("div", { class: "bars" }, top.map(([k, n]) => el("div", { class: "bar", style: `--w:${(n / max) * 100}%` }, el("span", {}, MUTEX_ZH[k]), el("i", {}), el("b", {}, fmt(n)))))
  );
}

/* ================= 06 分級、時代 ================= */

function buildRating() {
  const ladder = $("rating-ladder");
  const cardsBox = $("rating-cards");
  const usable = lib.cards.filter((c) => !c.banned);
  const at = (r) => usable.filter((c) => !ratingBlocked(c.item, r));
  const n = { general: at("general").length, sensitive: at("sensitive").length, explicit: usable.length };
  let cur = "general";
  const paint = () => {
    ladder.replaceChildren(
      ...["general", "sensitive", "explicit"].map((r, i, all) =>
        el(
          "button",
          { type: "button", role: "radio", class: "rung", "aria-checked": cur === r ? "true" : "false", dataset: { r }, onclick: () => ((cur = r), paint()) },
          el("b", {}, RATING_LABEL[r]),
          el("span", {}, `${fmt(n[r])} 張`),
          i ? el("small", {}, `比${RATING_LABEL[all[i - 1]]}多 ${fmt(n[r] - n[all[i - 1]])} 張`) : el("small", {}, "最安全的一級")
        )
      )
    );
    // 敏感、色情多開的那些只寫名字，不放卡面。
    if (cur === "general") {
      const pool = preferArt(at("general"));
      const rand = mulberry32(42);
      const pick = [...new Set(Array.from({ length: 14 }, () => pool[Math.floor(rand() * pool.length)]))].filter(Boolean).slice(0, 8);
      cardsBox.replaceChildren(el("p", { class: "dim" }, "全年齡：大部分的牌都在這一級。"), el("div", { class: "suit-cards" }, pick.map((c) => miniCard(c.tag, 64))));
    } else {
      const prev = cur === "sensitive" ? "general" : "sensitive";
      const extra = at(cur).filter((c) => ratingBlocked(c.item, prev));
      const rand = mulberry32(7);
      const pick = [...new Set(Array.from({ length: 14 }, () => extra[Math.floor(rand() * extra.length)]))];
      cardsBox.replaceChildren(el("p", { class: "dim" }, `${RATING_LABEL[cur]}多開的牌（只列名字）：`), el("div", { class: "chip-row" }, pick.map((c) => el("span", { class: "chip-tag" }, c.zh))));
    }
  };
  paint();
}

function buildEras() {
  const pick = $("era-pick");
  const box = $("era-cards");
  const ERAS = ["modern", "victorian", "medieval", "edo", "ancient_china", "ancient_greece"];
  let cur = "edo";
  const paint = () => {
    pick.replaceChildren(
      ...ERAS.map((e) => el("button", { type: "button", role: "radio", "aria-checked": cur === e ? "true" : "false", onclick: () => ((cur = e), paint()) }, ERA_ZH[e] || e))
    );
    const own = lib.cards.filter((c) => !c.banned && c.rating === "general" && c.eras.includes(cur) && !c.eras.includes("any") && (cur === "modern" || !c.eras.includes("modern")));
    const rand = mulberry32(cur.length * 31);
    const pool = preferArt(own);
    const sample = [...new Set(Array.from({ length: 12 }, () => pool[Math.floor(rand() * pool.length)]))].filter(Boolean).slice(0, 8);
    const label = cur === "modern" ? `現代專用的牌 ${fmt(own.length)} 張，例如：` : `${ERA_ZH[cur] || cur}會出現、現代不會的牌 ${fmt(own.length)} 張，例如：`;
    box.replaceChildren(el("p", { class: "dim" }, label), el("div", { class: "suit-cards" }, sample.map((c) => miniCard(c.tag, 64))));
    if (motion()) [...box.querySelectorAll(".card")].forEach((n, i) => n.animate([{ opacity: 0, transform: "rotate(-6deg) translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: DUR.long, delay: i * 40, easing: css(CURVE.settle), fill: "backwards" }));
  };
  paint();
}

/* ================= 08 五個房間 ================= */

const ROOMS = [
  {
    id: "ink", t: "墨池", href: "./", lead: "抽牌、生圖的主房間。",
    items: [
      ["字盒", "七種花色翻牌，中英文都能搜；角色可以照作品分格。"],
      ["合成池", "點牌或拖進來＝每張圖都一定有。可以調份量（0.8～1.4）；互斥、附帶兩個開關。"],
      ["偏好卡牌、牌組、貼上", "常用的牌攤在底部；整組存成牌組；貼一段別處的提示詞，詞庫有的變成牌。"],
      ["規則", "尺度、時代、人物、尺寸、姿勢參考；每段抽幾個、只補哪幾種；場景、職業、抽角色。"],
      ["抽", "一次幾張、無限抽（可設張數停）、同一個人、只抽牌不生圖、固定種子。"],
      ["成品牆", "每張的牌攤開看；撤下、收藏、照這張再印；Hires 放大、修臉；選 LoRA、底模、工作流程。"],
    ],
  },
  {
    id: "fuse", t: "疊印台", href: "fuse.html", lead: "一張牌一層墨，看清楚引擎補了什麼再印。",
    items: [
      ["卡池", "放的牌照花色疊進六列；灰色的影子是引擎補的。"],
      ["四張試印", "同一個種子抽四組提示詞，加一張牌四組一起重抽，差在哪一眼看出來。"],
      ["付印、晾紙", "挑一組付印；印好的掛在晾紙繩上。"],
      ["起手式", "三十組常用的組合，一按就放好。"],
      ["自己的規則", "規則、偏好卡牌跟墨池分開；附帶開關在規則面板。"],
    ],
  },
  {
    id: "book", t: "卡冊", href: "book.html", lead: "每張牌的來歷。",
    items: [
      ["用過幾次", "多到少、少到多、新到舊（加入日）；只看用過的。"],
      ["戰績", "哪些牌常出好圖、哪些常被撤下（從出圖日誌算）。"],
      ["一張牌的詳情", "你親手放幾次、引擎補幾次、用它做過的圖，帶去墨池。"],
      ["卡盒", "最多 24 張待用的牌，一次帶走。"],
      ["成就、偏好角色、含禁用", "收集進度；常用角色；禁用角色只列名字。"],
    ],
  },
  {
    id: "album", t: "作品冊", href: "album.html", lead: "收藏的成品和每一次出圖。",
    items: [
      ["作品", "大圖、用了哪些牌；照時代、髮色、服裝、場景分輯，看相似的作品。"],
      ["照這張再印", "牌、份量、時代、種子、尺寸、底模、LoRA 一起帶回墨池。"],
      ["日誌", "印過的每一張（沒收藏的也在）：時間、花多久、從哪一頁印的。"],
      ["模型成績單", "每個底模、LoRA 印了幾張、收藏幾張、撤下幾張。"],
    ],
  },
  {
    id: "parse", t: "解析池", href: "parse.html", lead: "丟一張圖，讀出它的標籤變成牌。",
    items: [
      ["放圖", "拖進來、貼上、選檔；網頁先縮小再送。"],
      ["WD14 Tagger", "ComfyUI 認出畫面裡的字；跑兩個門檻，分出「確定」和「可能」。"],
      ["對詞庫", "詞庫有的變成牌、照花色排；沒有的列出來可以複製；不能用的字不收。"],
      ["帶走", "挑好的牌帶去合成池或疊印台；解析設定可以換模型、門檻、不要的字。"],
    ],
  },
];

function buildRooms() {
  const tabs = $("room-tabs");
  const panel = $("room-panel");
  const show = (room, btn) => {
    for (const b of tabs.children) b.setAttribute("aria-selected", b === btn ? "true" : "false");
    panel.replaceChildren(
      el("div", { class: "room-head" }, el("h3", {}, room.t), el("p", {}, room.lead), el("a", { class: "btn btn-small", href: room.href }, `打開${room.t}`)),
      el("ul", { class: "room-items" }, room.items.map(([k, v]) => el("li", {}, el("b", {}, k), el("span", {}, v))))
    );
    if (motion()) [...panel.querySelectorAll("li")].forEach((n, i) => n.animate([{ opacity: 0, transform: "translateX(-10px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: i * 50, easing: css(CURVE.out), fill: "backwards" }));
  };
  for (const room of ROOMS) {
    const b = el("button", { type: "button", role: "tab", class: "room-tab", "aria-selected": "false", dataset: { room: room.id } }, room.t);
    b.addEventListener("click", () => show(room, b));
    tabs.append(b);
  }
  show(ROOMS[0], tabs.children[0]);
}

/* ================= 捲動：浮現、目錄、進度條 ================= */

function watchReveal() {
  const nodes = [...document.querySelectorAll("[data-reveal]")];
  if (!motion() || typeof IntersectionObserver !== "function") {
    for (const n of nodes) n.classList.add("is-in");
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px" }
  );
  for (const n of nodes) io.observe(n);
}

function watchToc() {
  const links = new Map([...document.querySelectorAll("#arch-toc a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        for (const [id, a] of links) a.classList.toggle("is-on", id === e.target.id);
      }
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  for (const id of links.keys()) {
    const sec = document.getElementById(id);
    if (sec) io.observe(sec);
  }
  const bar = $("arch-progress");
  let frame = 0;
  addEventListener(
    "scroll",
    () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const h = document.documentElement.scrollHeight - innerHeight;
        bar.style.transform = `scaleX(${h > 0 ? Math.min(1, scrollY / h) : 0})`;
      });
    },
    { passive: true }
  );
}

boot();

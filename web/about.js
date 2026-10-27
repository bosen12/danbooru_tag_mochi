/**
 * 介紹頁（about.html）：給還沒用過的人看墨池是什麼，順便請他加入 Discord、去 GitHub。
 *
 * 牌是真的牌：讀 lexicon.json 和卡面清單（跟原理頁一樣），開場一手扇形的牌，每隔幾秒重發一手，
 * 底下一行提示詞跟著換；每個房間配三張小牌。不連伺服器的 API、不生圖。
 *   - 捲到哪一段，那一段錯開浮上來（[data-reveal].is-in）。
 *   - 滑鼠在開場那一塊移動：牌和墨池的漣漪跟著微微偏（視差）。
 *   - 減少動態（prefers-reduced-motion）：全部直接出現，不重發、不偏。
 *   - 卡面還沒下載（剛裝好）：用純字的牌，不要整段空掉。
 */
import { buildLibrary, createAssets, cardNode, CARD_SUITS } from "./cards.js";
import { ratingBlocked } from "./rules/rating.js";
import { mulberry32 } from "./engine.js";
import { el } from "./ui.js";
import { reducedMotion } from "./motion.js";
import { DISCORD_URL, GITHUB_URL, GITHUB_SHORT, discordIcon, githubIcon, inviteRow } from "./community.js";

const $ = (id) => document.getElementById(id);
const fmt = (n) => new Intl.NumberFormat().format(n);
const motion = () => !reducedMotion();
let lib = null;
let assets = null;

const link = (cls, href, ...children) => el("a", { class: cls, href, target: "_blank", rel: "noopener" }, ...children);
const joinButton = (extra = "") => link(`btn btn-primary community-join ${extra}`.trim(), DISCORD_URL, discordIcon(), el("span", {}, "加入 Discord"));
const githubButton = (extra = "") => link(`btn ${extra}`.trim(), GITHUB_URL, githubIcon(), el("span", {}, "GitHub"));

/* ================= 連結（牌還沒讀到也先放好） ================= */

function fillLinks() {
  $("top-cta").replaceChildren(githubButton("btn-small btn-ghost"), joinButton("btn-small"));
  $("hero-cta").replaceChildren(joinButton("ab-big"), githubButton("ab-big"), el("a", { class: "btn ab-big", href: "./" }, "打開墨池"));
  $("discord-mark").innerHTML = discordIcon().innerHTML;
  $("discord-invite").replaceChildren(inviteRow());
  $("discord-go").replaceChildren(joinButton("ab-big"));
  $("gh-mark").replaceChildren(githubIcon());
  $("gh-repo").textContent = GITHUB_SHORT;
  $("gh-links").replaceChildren(
    link("btn", GITHUB_URL, "看原始碼"),
    link("btn", `${GITHUB_URL}/releases`, "下載最新版"),
    link("btn", `${GITHUB_URL}/issues`, "回報問題")
  );
  $("clone-cmd").textContent = `git clone ${GITHUB_URL}`;
  $("foot-links").replaceChildren(link("", DISCORD_URL, "Discord"), link("", GITHUB_URL, "GitHub"), el("a", { href: "./" }, "墨池"), el("a", { href: "arch.html" }, "原理"));
}

/* ================= 牌 ================= */

/** 一張牌（跟墨池同一種牌面）。 */
function card(c, w) {
  const node = cardNode(c, assets, { tagName: "div" });
  node.style.setProperty("--card-w", `${w}px`);
  return node;
}

// 有插畫的全年齡牌；一張插畫都沒有就用純字的。
function pool(suit) {
  const list = lib.cards.filter((c) => c.suit === suit && c.rating === "general" && !c.banned);
  const drawn = list.filter((c) => assets.art(c.tag));
  return drawn.length ? drawn : list;
}

function pick(rand, suits) {
  const used = new Set();
  return suits
    .map((s) => pool(s))
    .filter((p) => p.length)
    .map((p) => {
      let c = p[Math.floor(rand() * p.length)];
      for (let k = 0; k < 4 && used.has(c.tag); k++) c = p[Math.floor(rand() * p.length)];
      used.add(c.tag);
      return c;
    });
}

/** 開場：七張牌扇形攤開，每隔一陣子收起來重發一手；底下一行是這手牌排成的提示詞。 */
function buildHero() {
  const fan = $("hero-fan");
  const prompt = $("hero-prompt");
  const suits = ["cast", "chara", "look", "wear", "pose", "scene", "style"].filter((s) => CARD_SUITS.includes(s));
  let round = 0;
  const deal = () => {
    const picks = pick(mulberry32(7 + round++ * 131), suits);
    const nodes = picks.map((c, i) => {
      const n = card(c, 112);
      n.classList.add("ab-fan-card");
      n.style.setProperty("--i", String(i));
      n.style.setProperty("--n", String(picks.length));
      return n;
    });
    fan.replaceChildren(...nodes);
    prompt.replaceChildren(
      ...picks.map((c, i) => el("span", { class: "ab-tag", style: `--i:${i}`, dataset: { suit: c.suit, noI18n: "" } }, c.tag)),
      el("span", { class: "ab-tag is-tail", style: `--i:${picks.length}`, dataset: { noI18n: "" } }, "masterpiece, best quality")
    );
  };
  deal();
  if (!motion()) return;
  // 重發：先收（整手往下沉、淡掉），再發新的一手。分頁在背景就不換。
  setInterval(() => {
    if (document.hidden) return;
    fan.classList.add("is-leaving");
    prompt.classList.add("is-leaving");
    setTimeout(() => {
      fan.classList.remove("is-leaving");
      prompt.classList.remove("is-leaving");
      deal();
    }, 420);
  }, 6400);
  // 視差：滑鼠在開場那一塊，牌和漣漪跟著偏一點。
  const art = $("hero-art");
  const hero = art.closest(".ab-hero");
  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = hero.getBoundingClientRect();
    art.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    art.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  });
  hero.addEventListener("pointerleave", () => {
    art.style.setProperty("--mx", "0");
    art.style.setProperty("--my", "0");
  });
}

/** 每個房間三張小牌。 */
function buildRooms() {
  document.querySelectorAll(".ab-room-art").forEach((box, r) => {
    const picks = pick(mulberry32(400 + r * 17), box.dataset.suits.split(" "));
    box.replaceChildren(
      ...picks.map((c, i) => {
        const n = card(c, 64);
        n.style.setProperty("--i", String(i));
        return n;
      })
    );
  });
}

function fillStats() {
  const stats = {
    cards: lib.cards.length,
    chars: lib.cards.filter((c) => c.suit === "chara" && !c.banned).length,
  };
  for (const node of document.querySelectorAll("[data-stat]")) {
    const v = stats[node.dataset.stat];
    if (v != null) node.textContent = fmt(v);
  }
}

/* ================= 捲動 ================= */

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
    { rootMargin: "0px 0px -10% 0px" }
  );
  for (const n of nodes) io.observe(n);
}

/* ================= 開機 ================= */

async function boot() {
  fillLinks();
  watchReveal();
  try {
    const [lexicon, manifest] = await Promise.all([
      fetch("lexicon.json").then((r) => r.json()),
      fetch("cards/manifest.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    ]);
    lib = buildLibrary(lexicon, { ratingBlocked });
    assets = createAssets(manifest);
  } catch {
    // 讀不到詞庫（直接點開 HTML、沒開伺服器）：連結照樣能按，只是沒有牌。
    document.body.classList.add("no-cards");
    return;
  }
  fillStats();
  buildHero();
  buildRooms();
}

boot();

/**
 * 自製牌的編輯面板（卡冊）。兩種模式改同一張牌：
 *   挑牌：跟墨池的字盒同一套 —— 花色、細分類（角色頁有性別、系列）、搜尋（cards.js 的 searchCards）、
 *         滑鼠停著浮出放大卡（card-peek.js）、Enter 加第一張；點一張加進來，再點一次拿掉；
 *   貼提示詞：整串貼進來，邊打邊拆成詞庫的牌和詞庫外的字（custom-cards.js 的 parsePrompt）。
 * 右邊是這張牌的內容（照段落、權重 − ＋、問題標在籤上）、兩段提示詞（填入、卡面）、卡面預覽。
 *
 * 卡面預覽：按「烤卡面預覽」照卡面提示詞和種子烤一張到伺服器的暫存區；按存檔才轉正，沒存就丟掉。
 */
import { el, openSheet, toast } from "./ui.js";
import { suggestName } from "./decks.js";
import { cardNode, searchCards, searchNote, cardMatches, groupChips, chipRun, genderChips, seriesRun, setEnterTarget, sizeCards, cardFacts, CARD_SUIT_INFO } from "./cards.js";
import { searchMiss } from "./lib-hint.js";
import { attachPeek, hidePeek } from "./card-peek.js";
import { attachTilt } from "./card-tilt.js";
import { ratingBlocked } from "./rules/rating.js";
import { refuse, enter } from "./motion.js";
import { t as tr } from "./i18n.js";
import {
  parsePrompt, fillText, autoFace, ratingFloor, ratingAtLeast, bySuit, isBannedWord, isCustomTag,
  saveCustom, startPreview, previewState, dropPreview, previewUrl, artUrlOf,
  RATING_NAME, SUIT_ORDER, MAX_MEMBERS, MAX_EXTRA,
} from "./custom-cards.js";

const RATINGS = ["general", "sensitive", "explicit"];
const W_MIN = 0.5;
const W_MAX = 1.5;
const round1 = (w) => Math.round(w * 10) / 10;

/**
 * 打開編輯面板。
 *   card：要改的那張（沒有＝新的）。start：新的時候先填好的內容 {name, rating, members, extra}（成品、牌組、分享碼帶來的）。
 *   lib／lex／assets：這一頁的牌庫、詞庫索引、卡面。data：詞庫原檔（放大卡的說明用）。renamed：詞庫的舊名→新名。
 *   onSaved(card)：存好以後。
 */
export function openCustomEditor({ card = null, start = null, lib, lex, assets, data = null, renamed = {}, onSaved }) {
  const src = card || start || {};
  const st = {
    id: card?.id || "",
    createdAt: card?.createdAt || 0,
    name: src.name || "",
    rating: RATINGS.includes(src.rating) ? src.rating : "general",
    members: (src.members || []).filter((m) => lib.byTag.has(m.tag) && !isCustomTag(m.tag)).map((m) => ({ tag: m.tag, w: m.w || 1 })),
    extra: (src.extra || []).map((x) => ({ text: x.text, w: x.w || 1 })),
    face: { positive: card?.face?.positive || "", manual: !!card?.face?.manual, seed: card?.face?.seed ?? null },
    art: artUrlOf(card),
    banned: [],
    suggest: {},
  };
  // 帶來的內容裡有封鎖的字：先拿掉、記下來講。
  st.members = st.members.filter((m) => !isBannedWord(m.tag) || (st.banned.push(m.tag), false));
  st.extra = st.extra.filter((x) => !isBannedWord(x.text) || (st.banned.push(x.text), false));
  st.members = bySuit(st.members, lib);
  if (!st.face.positive || !st.face.manual) st.face.positive = autoFace(st, lex);
  let mode = "pick";
  let draft = "";
  let draftV = "";
  let bake = null;
  let pollTimer = 0;
  let saved = false;

  /* ---------- 頂列：名字、分級、模式 ---------- */
  const nameIn = el("input", { type: "text", class: "cce-name", maxlength: "24", placeholder: "名字，例如：法琳海邊", autocomplete: "off", "aria-label": "名字" });
  nameIn.value = st.name;
  // 名字空著：照裡面前三張牌自動取（牌組同一套），自己打過字就不再動它。
  let nameAuto = !st.name;
  nameIn.addEventListener("input", () => {
    st.name = nameIn.value;
    nameAuto = !st.name;
    paintFoot();
  });
  const ratingBox = el("div", { class: "segmented cce-rating", role: "radiogroup", "aria-label": "分級", dataset: { kind: "rating" } });
  const modeBox = el("div", { class: "segmented cce-mode", role: "radiogroup", "aria-label": "編輯方式" });
  for (const [key, label] of [["pick", "挑牌"], ["paste", "貼提示詞"]]) {
    const b = el("button", { type: "button", role: "radio", dataset: { v: key } }, label);
    b.addEventListener("click", () => setMode(key));
    modeBox.append(b);
  }

  /* ---------- 左欄：挑牌（字盒）、貼提示詞 ---------- */
  // 字盒的牌：詞庫的牌，禁用角色、封鎖的字不列。跟字盒一樣照分級收：照這張自製牌選的分級
  // （選全年齡就只列全年齡的牌；貼提示詞不受影響，貼了高一級的牌分級自己往上調）。
  const pool = lib.cards.filter((c) => c.suit !== "custom" && !c.banned && !isBannedWord(c.tag));
  const blockedMemo = new Map();
  const ratingOk = (c) => {
    const key = c.tag + "|" + st.rating;
    if (!blockedMemo.has(key)) blockedMemo.set(key, !ratingBlocked(c.item, st.rating));
    return blockedMemo.get(key);
  };
  const pick = { suit: "all", group: "", gender: "" };
  const q = el("input", { type: "search", class: "cce-q", placeholder: "找牌：紅髮、kimono…（Enter 加第一張）", autocomplete: "off", "aria-label": "找牌" });
  const suitRow = el("div", { class: "cce-suits suit-tabs", role: "group", "aria-label": "花色" });
  for (const s of ["all", ...SUIT_ORDER]) {
    const b = s === "all"
      ? el("button", { class: "suit-tab pressable", type: "button", dataset: { suit: s } }, "全部")
      : el("button", { class: "suit-tab pressable", type: "button", style: `--suit: var(--suit-${s})`, dataset: { suit: s } }, el("b", { class: "suit-glyph", "aria-hidden": "true" }, CARD_SUIT_INFO[s].glyph), CARD_SUIT_INFO[s].zh);
    b.addEventListener("click", () => {
      if (pick.suit === s) return;
      pick.suit = s;
      pick.group = "";
      paintPick({ top: true });
    });
    suitRow.append(b);
  }
  const chipRow = el("div", { class: "cce-groups group-chips", role: "group", "aria-label": "分類" });
  const grid = el("div", { class: "cce-grid lib-grid", id: "cce-grid", role: "list" });
  const sentinel = el("div", { class: "cce-more", "aria-hidden": "true" });
  const gridBox = el("div", { class: "cce-grid-box" }, grid, sentinel);
  const pickPane = el("div", { class: "cce-pick" }, q, suitRow, chipRow, gridBox);
  let shown = [];
  let rendered = 0;
  const BATCH = 96;
  q.addEventListener("input", () => paintPick({ top: true }));
  q.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing) return;
    e.preventDefault();
    const first = grid.querySelector(".card[data-tag]");
    if (first) toggleMember(first.dataset.tag, first);
  });
  // 捲到底補下一批（字盒整盒列得出來，不是只給前幾十張）。
  const more = new IntersectionObserver((es) => es.some((x) => x.isIntersecting) && moreCards(), { root: gridBox, rootMargin: "300px" });
  more.observe(sentinel);
  sizeCards(grid);
  // 滑鼠停在牌上：跟字盒同一張浮空放大卡。
  attachPeek(grid, ".card[data-tag]", (node) => {
    const c = lib.byTag.get(node.dataset.tag);
    if (!c) return null;
    const facts = data ? cardFacts(c, lex, data).filter(([k]) => k !== "分級").slice(0, 4) : [];
    return { zh: c.zh, tag: c.tag, glyph: CARD_SUIT_INFO[c.suit].glyph, seal: c.seal, sealTitle: c.groupZh, suitColor: `var(--suit-${c.suit})`, art: assets.art(c.tag), rating: c.rating, facts };
  });
  attachTilt(grid);

  const paste = el("textarea", { class: "cce-paste", rows: "9", spellcheck: "false", placeholder: "貼上一整串提示詞，用逗號分開：1girl, beach, (huge breasts:1.2), sparkle eyelashes", "aria-label": "貼提示詞" });
  const pasteNote = el("p", { class: "cce-hint" }, "詞庫有的變成牌，對不到的放進「詞庫外」；權重括號 (tag:1.2) 會讀進來。");
  const pastePane = el("div", { class: "cce-paste-pane" }, paste, pasteNote);
  let pasteTimer = 0;
  paste.addEventListener("input", () => {
    clearTimeout(pasteTimer);
    pasteTimer = setTimeout(applyPaste, 250);
  });

  /* ---------- 右欄：卡面、內容、兩段提示詞 ---------- */
  const facePic = el("div", { class: "cce-face-pic" });
  const seedIn = el("input", { type: "text", inputmode: "numeric", class: "cce-seed", placeholder: "隨機", "aria-label": "卡面種子", autocomplete: "off" });
  if (st.face.seed != null) seedIn.value = String(st.face.seed);
  const bakeBtn = el("button", { class: "btn btn-small", type: "button" }, "烤卡面預覽");
  const bakeMsg = el("p", { class: "cce-bake-msg", role: "status" });
  bakeBtn.addEventListener("click", startBake);
  const faceBox = el("div", { class: "cce-face" }, facePic, el("div", { class: "cce-face-ctl" }, el("label", { class: "cce-seed-row" }, el("span", {}, "種子"), seedIn), bakeBtn, bakeMsg));

  const content = el("div", { class: "cce-content", "aria-live": "polite" });
  const fillLine = el("code", { class: "cce-fill", dataset: { noI18n: "" } });
  const copyBtn = el("button", { class: "btn btn-small btn-ghost", type: "button", onclick: () => copy(fillText(st)) }, "複製");
  const faceIn = el("textarea", { class: "cce-face-in", rows: "4", spellcheck: "false", "aria-label": "卡面提示詞" });
  faceIn.value = st.face.positive;
  const faceState = el("span", { class: "cce-face-state" });
  const regen = el("button", { class: "btn btn-small btn-ghost", type: "button" }, "從填入重新產生");
  const faceWarn = el("p", { class: "cce-warn" });
  faceIn.addEventListener("input", () => {
    st.face.positive = faceIn.value;
    st.face.manual = true;
    paintFace();
  });
  regen.addEventListener("click", () => {
    st.face.manual = false;
    st.face.positive = autoFace(st, lex);
    faceIn.value = st.face.positive;
    paintFace();
  });
  const prompts = el(
    "div",
    { class: "cce-prompts" },
    el("div", { class: "cce-prompt" }, el("div", { class: "cce-prompt-head" }, el("b", {}, "填入"), el("span", {}, "送去生圖的"), copyBtn), fillLine),
    el("div", { class: "cce-prompt" }, el("div", { class: "cce-prompt-head" }, el("b", {}, "卡面"), el("span", {}, "只拿來烤這張牌的插畫"), faceState, regen), faceIn, faceWarn)
  );

  const left = el("section", { class: "cce-left", "aria-label": "放牌進來" }, pickPane, pastePane);
  const right = el("section", { class: "cce-right", "aria-label": "這張牌" }, faceBox, content, prompts);
  const body = el("div", { class: "cce" }, el("div", { class: "cce-top" }, nameIn, ratingBox, modeBox), el("div", { class: "cce-main" }, left, right));

  const msg = el("span", { class: "cce-msg", role: "status" });
  const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, "存檔");
  const cancelBtn = el("button", { class: "btn", type: "button" }, "取消");
  saveBtn.addEventListener("click", save);

  const sheet = openSheet(card ? `編輯「${card.name}」` : "新增自製牌", body, {
    wide: true,
    translateTitle: !card,
    foot: [msg, cancelBtn, saveBtn],
    onClose: () => {
      clearTimeout(pollTimer);
      clearTimeout(pasteTimer);
      more.disconnect();
      hidePeek?.();
      // 沒存就關：暫存的預覽丟掉。存了的已經轉正，不用丟。
      if (!saved && draft) dropPreview(draft);
    },
  });
  sheet.sheet?.classList.add("cce-sheet");
  cancelBtn.addEventListener("click", () => sheet.close());
  // 關分頁、重新整理：一樣丟掉預覽（伺服器一天後也會清）。
  const onHide = () => !saved && draft && dropPreview(draft);
  addEventListener("pagehide", onHide);
  sheet.sheet?.addEventListener("sheet-close", () => removeEventListener("pagehide", onHide), { once: true });

  /* ---------- 畫 ---------- */
  function setMode(m) {
    mode = m;
    for (const b of modeBox.children) b.setAttribute("aria-checked", b.dataset.v === m ? "true" : "false");
    pickPane.hidden = m !== "pick";
    pastePane.hidden = m !== "paste";
    if (m === "paste") {
      paste.value = fillText(st);
      paste.focus({ preventScroll: true });
    } else paintPick();
  }

  function paintRating() {
    const floor = ratingFloor(st.members, lib);
    if (!ratingAtLeast(st.rating, floor)) st.rating = floor;
    ratingBox.replaceChildren(
      ...RATINGS.map((r) => {
        const ok = ratingAtLeast(r, floor);
        const b = el("button", { type: "button", role: "radio", "aria-checked": st.rating === r ? "true" : "false", dataset: { v: r }, disabled: !ok, title: ok ? "" : `裡面有${RATING_NAME[floor]}級的牌，不能標${RATING_NAME[r]}` }, RATING_NAME[r]);
        b.addEventListener("click", () => {
          if (st.rating === r) return;
          st.rating = r;
          changed();
          // 字盒照分級收牌：換了就重篩（選高一級看得到更多牌）。
          paintPick();
        });
        return b;
      })
    );
  }

  const genderOk = (c) => pick.suit !== "chara" || !pick.gender || c.gate === pick.gender;

  /** 字盒：花色 → 細分類 → 搜尋，跟墨池的 renderLibrary 同一個順序、同一套搜尋。 */
  function paintPick({ top = false } = {}) {
    if (mode !== "pick") return;
    for (const b of suitRow.children) b.setAttribute("aria-pressed", b.dataset.suit === pick.suit ? "true" : "false");
    const inSuit = pool.filter((c) => (pick.suit === "all" || c.suit === pick.suit) && genderOk(c) && ratingOk(c));
    paintGroups(inSuit);
    const inGroup = inSuit.filter((c) => !pick.group || c.group === pick.group);
    const text = q.value.trim().toLowerCase();
    let found = text ? searchCards(inGroup, text) : { list: inGroup, mode: "all" };
    // 整盒找得到、只是被花色或分類篩掉：說在哪一格、給「看全部」（不要用猜的蓋過去）。
    if (found.mode !== "all" && pool.some((c) => cardMatches(c, text))) found = { list: [], mode: "none" };
    searchNote(grid, found, q.value);
    shown = found.list;
    rendered = 0;
    hidePeek?.();
    grid.replaceChildren();
    if (top) gridBox.scrollTop = 0;
    if (!shown.length) {
      grid.append(text ? pickMiss(text) : el("p", { class: "cce-hint" }, "這一格沒有牌。"));
      setEnterTarget(grid, false);
      return;
    }
    moreCards();
    setEnterTarget(grid, !!text);
  }

  /** 細分類籤：選了花色才出現；角色頁前面有「性別」、作品收成「系列」一串（可收合）。 */
  function paintGroups(inSuit) {
    if (pick.suit === "all") {
      chipRow.hidden = true;
      chipRow.replaceChildren();
      return;
    }
    const runs = groupChips(inSuit);
    if (pick.group && !runs.some((r) => r.items.some((i) => i.g === pick.group))) pick.group = "";
    chipRow.hidden = pick.suit !== "chara" && runs.reduce((n, r) => n + r.items.length, 0) < 2;
    const pickGroup = (g) => {
      if (pick.group === g) return;
      pick.group = g;
      paintPick({ top: true });
    };
    const chip = (i, inRun) =>
      el(
        "button",
        { class: "group-chip pressable", type: "button", "aria-pressed": pick.group === i.g ? "true" : "false", "aria-label": i.short === i.zh ? null : i.zh, onclick: () => pickGroup(i.g) },
        i.seal && !inRun ? el("b", { class: "chip-seal", "aria-hidden": "true" }, i.seal) : null,
        i.short
      );
    const all = [
      el("button", { class: "group-chip pressable", type: "button", "aria-pressed": pick.group === "" ? "true" : "false", onclick: () => pickGroup("") }, "全部"),
      ...runs.map((r) => (r.fam ? chipRun(r, r.items.map((i) => chip(i, true)), { fold: pick.suit === "chara", picked: pick.group }) : chip(r.items[0], false))),
    ];
    const pickGender = (g) => {
      if (pick.gender === g) return;
      pick.gender = g;
      paintPick({ top: true });
    };
    chipRow.replaceChildren(...(pick.suit === "chara" ? [genderChips(pick.gender, pickGender), seriesRun(all)] : all));
  }

  /** 下一批牌（一次 BATCH 張）。 */
  function moreCards() {
    if (rendered >= shown.length) return;
    const have = new Set(st.members.map((m) => m.tag));
    const next = shown.slice(rendered, rendered + BATCH);
    rendered += next.length;
    grid.append(
      ...next.map((c) => {
        const node = cardNode(c, assets);
        markCard(node, have.has(c.tag), c);
        node.addEventListener("click", () => toggleMember(c.tag, node));
        return node;
      })
    );
  }

  function markCard(node, on, c = lib.byTag.get(node.dataset.tag)) {
    node.classList.toggle("is-in", on);
    node.setAttribute("aria-pressed", on ? "true" : "false");
    node.title = on ? `${c.zh}：已經在這張牌裡（再點一下拿掉）` : `${c.zh}：加進這張牌`;
  }

  /** 牌加進來、拿出去：只改勾，不整格重畫（捲到哪就留在哪）。 */
  function markIn() {
    const have = new Set(st.members.map((m) => m.tag));
    for (const node of grid.querySelectorAll(".card[data-tag]")) markCard(node, have.has(node.dataset.tag));
  }

  /** 搜不到：被花色、分類篩掉就說在哪一格；字盒真的沒有，就給一顆「當詞庫外的字加進來」。 */
  function pickMiss(text) {
    const shownBy = (c) => (pick.suit === "all" || c.suit === pick.suit) && (!pick.group || c.group === pick.group) && genderOk(c);
    const unlock = (c) => RATINGS.find((r) => !ratingBlocked(c.item, r)) || "explicit";
    const box = searchMiss({
      cards: pool,
      q: text,
      query: q.value.trim(),
      className: "cce-hint",
      reasons: [
        // 跟字盒一樣：被分級收起來的說要在哪一級才看得到，按鈕直接把這張自製牌的分級調上去。
        { hides: (c) => !ratingOk(c), text: (c) => `「${c.zh}」要在「${RATING_NAME[unlock(c)]}」才看得到`, label: (c) => `切到${RATING_NAME[unlock(c)]}`, run: (c) => ((st.rating = unlock(c)), changed(), paintPick({ top: true })) },
        { hides: (c) => !shownBy(c), text: (c) => `「${c.zh}」在「${CARD_SUIT_INFO[c.suit]?.zh || c.suit}」裡`, label: () => "看全部", run: () => ((pick.suit = "all"), (pick.group = ""), (pick.gender = ""), paintPick({ top: true })) },
      ],
    });
    if (pool.some((c) => cardMatches(c, text))) return box;
    const word = q.value.trim();
    return el(
      "div",
      { class: "cce-miss" },
      box,
      isBannedWord(word)
        ? el("p", { class: "cce-banned" }, `「${word}」不能用（未成年、禁用角色）`)
        : el("button", { class: "btn btn-small", type: "button", onclick: () => addExtra(word) }, `把「${word}」當詞庫外的字加進來`)
    );
  }

  function addExtra(word) {
    const text = word.replace(/,/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (!text) return;
    if (st.extra.length >= MAX_EXTRA) return toast(tr(`詞庫外的字最多 ${MAX_EXTRA} 個`));
    if (!st.extra.some((x) => x.text === text)) st.extra.push({ text, w: 1 });
    q.value = "";
    changed();
    paintPick();
    enter(content.querySelector(`[data-text="${CSS.escape(text)}"]`));
  }

  function toggleMember(tag, node) {
    const at = st.members.findIndex((m) => m.tag === tag);
    if (at >= 0) st.members.splice(at, 1);
    else {
      if (st.members.length >= MAX_MEMBERS) {
        refuse(node);
        return toast(tr(`一張自製牌最多 ${MAX_MEMBERS} 張牌`));
      }
      st.members.push({ tag, w: 1 });
      st.members = bySuit(st.members, lib);
    }
    changed();
    markIn();
    if (at < 0) enter(content.querySelector(`[data-tag="${CSS.escape(tag)}"]`));
  }

  function applyPaste() {
    const r = parsePrompt(paste.value, { lib, renamed });
    st.members = bySuit(r.members, lib).slice(0, MAX_MEMBERS);
    st.extra = r.extra.slice(0, MAX_EXTRA);
    st.banned = r.banned;
    st.suggest = r.suggest;
    changed({ keepPaste: true });
  }

  /** 每張籤上的問題：重複（別的成員已經帶出它）、同一格（互斥只會留一個）。 */
  function notesFor(tag) {
    const out = [];
    for (const m of st.members) {
      if (m.tag === tag) continue;
      const it = lex.byTag.get(m.tag);
      if ((it?.implies || []).includes(tag) || (it?.bind || []).includes(tag)) out.push(`「${zh(m.tag)}」已經會帶出它`);
    }
    // 同一格（互斥）只會留一個 —— 但一張帶出另一張的（乳牛紋比基尼帶出比基尼）引擎兩張都留，不算。
    const mx = lex.byTag.get(tag)?.mutex;
    const carries = (a, b) => [...(lex.byTag.get(a)?.implies || []), ...(lex.byTag.get(a)?.bind || [])].includes(b);
    if (mx) {
      const other = st.members.find((m) => m.tag !== tag && lex.byTag.get(m.tag)?.mutex === mx && !carries(m.tag, tag) && !carries(tag, m.tag));
      if (other) out.push(`跟「${zh(other.tag)}」同一格，只會留一個`);
    }
    return out;
  }

  const zh = (tag) => lib.byTag.get(tag)?.zh || tag;

  function weightCtl(get, set, label) {
    const val = el("output", { class: "cce-w" }, fmtW(get()));
    const step = (d) => {
      const w = round1(Math.min(W_MAX, Math.max(W_MIN, get() + d)));
      if (w === get()) return;
      set(w);
      val.textContent = fmtW(w);
      paintFill();
      if (!st.face.manual) syncFace();
    };
    return el(
      "span",
      { class: "cce-wctl" },
      el("button", { type: "button", class: "cce-wbtn", "aria-label": `${label}權重減 0.1`, onclick: () => step(-0.1) }, "−"),
      val,
      el("button", { type: "button", class: "cce-wbtn", "aria-label": `${label}權重加 0.1`, onclick: () => step(0.1) }, "＋")
    );
  }
  const fmtW = (w) => (Math.round(w * 10) / 10).toFixed(1);

  function paintContent() {
    const groups = [];
    for (const s of SUIT_ORDER) {
      const ms = st.members.filter((m) => lib.byTag.get(m.tag)?.suit === s);
      if (!ms.length) continue;
      groups.push(
        el(
          "div",
          { class: "cce-group", style: `--suit: var(--suit-${s})` },
          el("span", { class: "cce-group-name" }, CARD_SUIT_INFO[s].zh),
          el(
            "div",
            { class: "cce-chips" },
            ms.map((m) => {
              const notes = notesFor(m.tag);
              return el(
                "div",
                { class: "cce-chip" + (notes.length ? " has-note" : ""), dataset: { tag: m.tag } },
                el("span", { class: "cce-chip-name" }, el("b", {}, zh(m.tag)), el("small", { dataset: { noI18n: "" } }, m.tag)),
                weightCtl(() => m.w, (w) => (m.w = w), zh(m.tag)),
                el("button", { type: "button", class: "cce-x", "aria-label": `拿掉「${zh(m.tag)}」`, onclick: () => (st.members = st.members.filter((x) => x !== m), changed(), markIn()) }, "×"),
                // 每一條提醒自己一個元素：英文版逐條翻（i18n 整句比對）。
                notes.map((n) => el("span", { class: "cce-note" }, n))
              );
            })
          )
        )
      );
    }
    if (st.extra.length) {
      groups.push(
        el(
          "div",
          { class: "cce-group is-extra" },
          el("span", { class: "cce-group-name" }, "詞庫外"),
          el(
            "div",
            { class: "cce-chips" },
            st.extra.map((x) => {
              const sug = st.suggest[x.text];
              return el(
                "div",
                { class: "cce-chip is-extra", dataset: { text: x.text } },
                el("span", { class: "cce-chip-name" }, el("b", { dataset: { noI18n: "" } }, x.text), el("small", {}, "詞庫外：引擎不會檢查")),
                weightCtl(() => x.w, (w) => (x.w = w), x.text),
                el("button", { type: "button", class: "cce-x", "aria-label": `拿掉「${x.text}」`, onclick: () => (st.extra = st.extra.filter((y) => y !== x), changed()) }, "×"),
                sug && !st.members.some((m) => m.tag === sug)
                  ? el("button", { type: "button", class: "cce-sug link-btn", onclick: () => useSuggestion(x, sug) }, `是不是「${zh(sug)}」（${sug}）？`)
                  : null
              );
            })
          )
        )
      );
    }
    if (st.banned.length) {
      groups.push(el("p", { class: "cce-banned" }, `擋掉了：${st.banned.join("、")}（未成年、禁用角色不能用）`));
    }
    if (!groups.length) groups.push(el("p", { class: "cce-hint cce-empty" }, mode === "paste" ? "貼上提示詞，這裡就會列出拆好的牌。" : "從左邊點牌加進來，或切到「貼提示詞」。"));
    const extraWarn = st.rating === "general" && st.extra.length ? el("p", { class: "cce-warn" }, "詞庫外的字沒辦法確認分級：請自己確定它真的是全年齡。") : null;
    content.replaceChildren(el("div", { class: "cce-count" }, st.extra.length ? `${st.members.length} 張牌・詞庫外 ${st.extra.length} 個` : `${st.members.length} 張牌`), ...groups, ...(extraWarn ? [extraWarn] : []));
  }

  function useSuggestion(x, tag) {
    st.extra = st.extra.filter((y) => y !== x);
    if (st.members.length < MAX_MEMBERS) st.members = bySuit([...st.members, { tag, w: x.w }], lib);
    changed();
  }

  function paintFill() {
    fillLine.textContent = fillText(st) || "—";
  }

  function syncFace() {
    st.face.positive = autoFace(st, lex);
    faceIn.value = st.face.positive;
    paintFace();
  }

  function paintFace() {
    faceState.textContent = st.face.manual ? "手動改過" : "自動";
    faceState.dataset.manual = st.face.manual ? "true" : "false";
    regen.hidden = !st.face.manual;
    const auto = autoFace(st, lex);
    faceWarn.textContent = st.face.manual && st.face.positive.trim() !== auto ? "卡面跟填入不一樣了：要的話按「從填入重新產生」，改完重烤一次。" : "";
    const bad = st.face.positive.split(",").map((s) => s.trim()).filter((s) => s && isBannedWord(s));
    if (bad.length) faceWarn.textContent = `卡面提示詞有不能用的字：${bad.join("、")}`;
    paintFacePic();
  }

  /** 卡面：預覽 > 現在的卡面 > 成員牌插畫拼成的扇形。 */
  function paintFacePic() {
    const img = draftV ? previewUrl(draft, draftV) : st.art;
    if (img) {
      facePic.replaceChildren(el("img", { src: img, alt: "", decoding: "async" }));
      facePic.dataset.kind = draftV ? "preview" : "art";
      return;
    }
    const arts = st.members.map((m) => m.tag).filter((t) => assets.art(t)).slice(0, 4);
    facePic.dataset.kind = "collage";
    facePic.replaceChildren(
      arts.length
        ? el("div", { class: "cce-fan", style: `--n: ${arts.length}` }, arts.map((t, i) => el("img", { src: assets.art(t), alt: "", decoding: "async", style: `--i: ${i}` })))
        : el("span", { class: "cce-face-empty" }, "還沒有卡面")
    );
  }

  function paintFoot() {
    const why = !st.name.trim() ? "要取個名字" : !st.members.length && !st.extra.length ? "至少要有一張牌或一個字" : bake?.state === "baking" ? "卡面還在烤" : "";
    saveBtn.disabled = !!why;
    msg.textContent = tr(why);
  }

  function changed({ keepPaste = false } = {}) {
    if (nameAuto) {
      const tags = st.members.map((m) => m.tag);
      st.name = tags.length ? suggestName(tags, zh).slice(0, 24) : st.extra[0]?.text.slice(0, 24) || "";
      nameIn.value = st.name;
    }
    paintRating();
    paintContent();
    paintFill();
    if (!st.face.manual) syncFace();
    else paintFace();
    paintFoot();
    if (mode === "paste" && !keepPaste) paste.value = fillText(st);
  }

  /* ---------- 卡面預覽 ---------- */
  async function startBake() {
    const raw = seedIn.value.trim();
    if (raw && !/^\d{1,18}$/.test(raw)) {
      refuse(seedIn);
      return toast(tr("種子要是數字（留空＝隨機）"));
    }
    const seed = raw ? Number(raw) : undefined;
    bakeBtn.disabled = true;
    bake = { state: "baking" };
    bakeMsg.textContent = tr("烤卡面中…大約 6 秒。");
    paintFoot();
    try {
      const r = await startPreview({ positive: st.face.positive, rating: st.rating, seed, draft });
      draft = r.draft;
      seedIn.value = String(r.seed);
      poll();
    } catch (err) {
      bake = { state: "failed" };
      bakeBtn.disabled = false;
      bakeMsg.textContent = String(err.message || err);
      paintFoot();
    }
  }

  function poll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      let r;
      try {
        r = await previewState(draft);
      } catch {
        return poll();
      }
      if (r.state === "baking") return poll();
      bake = r;
      bakeBtn.disabled = false;
      bakeBtn.textContent = tr("重烤");
      if (r.state === "done") {
        draftV = r.v || String(Date.now());
        st.face.seed = r.seed;
        bakeMsg.textContent = tr("烤好了：這是預覽，按「存檔」才會換上。");
        paintFacePic();
        enter(facePic.firstElementChild);
      } else if (r.state === "comfy_down") bakeMsg.textContent = tr("ComfyUI 沒開：先用拼貼卡面，之後再回來烤。");
      else bakeMsg.textContent = tr("烤失敗了：") + (r.error || "");
      paintFoot();
    }, 700);
  }

  /* ---------- 存檔 ---------- */
  async function save() {
    paintFoot();
    if (saveBtn.disabled) return refuse(saveBtn);
    saveBtn.disabled = true;
    msg.textContent = tr("存檔中…");
    const raw = seedIn.value.trim();
    const seed = /^\d{1,18}$/.test(raw) ? Number(raw) : st.face.seed;
    const payload = {
      ...(st.id ? { id: st.id, createdAt: st.createdAt } : {}),
      name: st.name.trim(),
      rating: st.rating,
      members: st.members,
      extra: st.extra,
      face: { positive: st.face.positive.trim(), manual: st.face.manual, seed: Number.isSafeInteger(seed) ? seed : null, ...(card?.face?.art ? { art: card.face.art } : {}) },
    };
    try {
      const out = await saveCustom(payload, { draft: draftV ? draft : "" });
      saved = true;
      sheet.close();
      onSaved?.(out);
    } catch (err) {
      msg.textContent = String(err.message || err);
      saveBtn.disabled = false;
      refuse(saveBtn);
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(tr("複製好了"));
    } catch {
      toast(tr("複製不了：請自己選起來複製"));
    }
  }

  setMode("pick");
  changed();
  if (!st.name) nameIn.focus({ preventScroll: true });
  if (st.banned.length) toast(tr(`擋掉了 ${st.banned.length} 個不能用的字`));
  return sheet;
}

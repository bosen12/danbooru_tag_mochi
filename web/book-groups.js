/**
 * 卡冊的群組書架（卡片群組，資料在 card-groups.js）：所有群組都看得到、改得到的地方。
 *
 * 書架：卡冊上方一排「疊起來的牌」，一組一疊（前三張牌的縮圖扇開、組名、張數），照段落排（長相｜服裝｜姿勢｜場景），
 *   每段尾巴一顆「＋」新增。點一疊：卡冊收成那組的牌（照舊的 FLIP 滑位），書架底下出現那組的標頭。
 * 標頭：組名（點了直接改）、張數、「加牌」、「在墨池用這組」、刪除（可復原）。
 * 加牌模式：卡冊列出那一段所有的牌，點一張蓋章加入、再點拿掉；牌上蓋著群組的章。完成就回到那組。
 * 牌的詳情：多一列「群組」，那張牌那一段的所有群組各一顆膠囊，亮的是已經在裡面，點了加入／拿掉。
 *
 * 用法：const shelf = mountBookGroups({ lib, assets, onChange, toMochi })
 *   shelf.active()  現在篩的群組（沒有是 null）；shelf.editing() 在加牌模式
 *   shelf.keep(card) 這張牌在不在現在的清單裡（群組模式；沒有群組模式回 null 照舊篩）
 *   shelf.has(tag)   這張牌在不在現在選的群組裡（蓋章用）
 *   shelf.toggle(card, node) 加牌模式點一張牌
 *   shelf.detailRow(card) 牌的詳情裡那一列
 *   shelf.clear()   回到全部（換花色時）；shelf.openFromHash(hash)
 */
import { el, toast, friendlyError } from "./ui.js";
import { reducedMotion, DUR, CURVE, css, swapIn, enter, seat, refuse, heightChange, ghostOut } from "./motion.js";
import { loadGroups, cachedGroups, onGroupsChange, saveGroup, deleteGroup, GROUP_SECTIONS } from "./card-groups.js";
import { SECTION_ZH, SECTION_SUIT } from "./group-picks.js";
import { t as tr, english } from "./i18n.js";
import { groupSlotKey } from "./engine.js";
import { groupChips } from "./cards.js";

// 跟 card_groups.py 一樣：實際上不限（整類的牌全放進一組也放得下），以前是 120。
const MAX_TAGS = 5000;

const FOLD_KEY = "mochi.book.shelf.v1";
// "1" 收起、"0" 攤開；沒存過是 null（交給視窗寬度，或「一個群組都沒有」那一行）。
const storedFold = () => {
  try {
    const v = localStorage.getItem(FOLD_KEY);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
};

/**
 * 沒存過：手機先收著（四段直排會把牌推出第一屏），電腦攤開。
 * 清單已經讀回來、而且一個群組都沒有：收成一行。清單還沒回來時不收，
 * 免得有群組的書架先被收成「建立第一組」。
 */
function desiredFold(count) {
  const stored = storedFold();
  if (stored !== null) return stored;
  if (cachedGroups() !== null && count === 0) return true;
  try {
    return matchMedia("(max-width: 34rem)").matches;
  } catch {
    return false;
  }
}

export function mountBookGroups({ lib, assets, onChange, toMochi, visible, data }) {
  const shelf = document.getElementById("book-shelf");
  const head = document.getElementById("book-shelf-head");
  let activeId = "";
  let editing = false;
  // 看一組時，標頭的小分類籤挑的那一格（只看這組裡那一格的牌）；空字串是整組。
  let sub = "";
  let saving = Promise.resolve();
  let saveError = null;
  const pending = [];
  // 「儲存中…」存超過 SLOW_SAVE_MS 才露出來：本機一筆十幾毫秒就存好，以前每點一張牌標頭就
  // 「已儲存 → 儲存中… → 已儲存」跳一次（2026-11-22 專案主：上方還是會閃）。慢網路照樣看得到在存。
  const SLOW_SAVE_MS = 400;
  let slowSave = false;
  let slowTimer = 0;
  let folded = desiredFold(0);
  // 加牌時浮在畫面底下的「完成」：手機上工具列不黏，捲到多下面都按得到。
  const float = el("button", { class: "btn btn-primary bsh-float pressable", type: "button", hidden: true, onclick: () => setEditing(false) });
  document.body.append(float);

  // 回應只更新底稿，尚未完成的操作疊在上面，舊回應不會抹掉新蓋的章。
  const groups = () => (cachedGroups() || []).map(g => pending.filter(p => p.id === g.id).reduce((cur, p) => p.change(cur), g));
  const active = () => (activeId && groups().find((g) => g.id === activeId)) || null;
  const sectionOf = (card) => card?.item?.section;
  const zhOf = (t) => lib.byTag.get(t)?.zh || t;
  const errorText = err => {
    const names = (err.bad || []).slice(0, 3).map(t => english ? t.replaceAll("_", " ") : zhOf(t)).join(english ? ", " : "、");
    return friendlyError(err) + (names ? `：${names}` + (err.bad.length > 3 ? ` ${tr(`等 ${err.bad.length} 張`)}` : "") : "");
  };
  const nextName = section => {
    const names = new Set(groups().filter(g => g.section === section).map(g => g.name));
    for (let n = 0; ; n++) {
      const suffix = String.fromCharCode(65 + n % 26) + (n < 26 ? "" : Math.floor(n / 26) + 1);
      const name = `${tr(SECTION_ZH[section])} ${suffix}`;
      if (!names.has(name)) return name;
    }
  };
  async function waitSaved() {
    try {
      // 等待期間仍可繼續加牌，必須等到最後一次排隊的操作。
      let last;
      do {
        last = saving;
        try { await last; }
        catch (err) { if (pending.length || saveError) throw err; }
      } while (last !== saving);
      if (saveError) throw saveError;
      return true;
    } catch { return false; }
  }

  // keepScroll：只是存好了（加牌模式每點一張就存一次），牌還是同一批，不要捲回頂端。
  // 2026-11-20 專案主：加牌時每選一張就跳到最上面，很不好用。
  // 現在畫面上這一組的牌。別的裝置改了內容才重畫牌格；自己這台還在存的那一筆不要在這裡再畫一次。
  let shownSig = "";
  const groupSig = (g) => (g ? `${g.id}\0${editing ? 1 : 0}\0${g.tags.join("\0")}` : "");
  function changed({ grid = true, keepScroll = false } = {}) {
    if (!pending.length) {
      slowSave = false;
      clearTimeout(slowTimer);
      slowTimer = 0;
    }
    renderShelf();
    renderHead();
    if (grid) {
      shownSig = groupSig(active());
      onChange({ keepScroll });
    }
  }

  /** 一疊牌：前三張的縮圖扇開；沒有縮圖的那張用花色底寫字。 */
  function stack(g) {
    const tags = g.tags.slice(0, 3);
    const leaves = tags.length
      ? tags.map((t, i) => {
          const src = assets.art(t);
          return el(
            "span",
            { class: "bs-leaf", style: `--i: ${i}; --n: ${tags.length}` },
            src ? el("img", { src, alt: "", loading: "lazy", decoding: "async" }) : el("span", { class: "bs-leaf-zh", dataset: { noI18n: "" } }, zhOf(t).slice(0, 4))
          );
        })
      : [el("span", { class: "bs-leaf bs-leaf-empty", style: "--i: 0; --n: 1" }, "空")];
    return el("span", { class: "bs-stack", "aria-hidden": "true" }, leaves);
  }

  const leavesOf = (g) => g.tags.slice(0, 3).join("\n");
  const tileTitle = (g) => g.tags.map(zhOf).join("、") || "空的群組";

  function tile(g) {
    const on = g.id === activeId;
    return el(
      "button",
      {
        class: "bs-tile pressable",
        type: "button",
        // leaves：這一疊扇開的是哪三張（patchShelf 比對，變了才換縮圖）。
        dataset: { suit: SECTION_SUIT[g.section], id: g.id, leaves: leavesOf(g) },
        "aria-pressed": on ? "true" : "false",
        title: tileTitle(g),
        onclick: (e) => pick(g.id === activeId ? "" : g.id, e.currentTarget),
      },
      stack(g),
      el("span", { class: "bs-name", dataset: { noI18n: "" } }, g.name),
      el("span", { class: "bs-count" }, `${g.tags.length} 張`)
    );
  }

  /**
   * 架子的樣子沒變（組數、組名、收合、選中的那組都一樣）：只換每一疊的張數和滑鼠提示，扇開的前三張變了才換那一疊的縮圖。
   * 以前加牌每點一張，整個架子重做三次（點下去、伺服器回來、存好）：縮圖是新的 <img>，要重新解碼，
   * 上方那排會白一下（2026-11-22 專案主：群組加牌上方還是會閃）。
   */
  let shelfSig = "";
  function patchShelf(all) {
    for (const g of all) {
      const t = shelf.querySelector(`.bs-tile[data-id="${CSS.escape(g.id)}"]`);
      if (!t) continue;
      const title = tileTitle(g);
      if (t.title !== title && t.title !== tr(title)) t.title = title;
      const count = t.querySelector(".bs-count");
      const n = `${g.tags.length} 張`;
      // 英文版畫面上是翻過的字：比對要過 t()，不然每次都重寫一次。
      if (count && count.textContent !== tr(n)) count.textContent = n;
      const leaves = leavesOf(g);
      if (t.dataset.leaves !== leaves) {
        t.dataset.leaves = leaves;
        t.querySelector(".bs-stack")?.replaceWith(stack(g));
      }
    }
  }

  function renderShelf({ animate = false } = {}) {
    if (!shelf) return;
    const all = groups();
    // 人剛按的那一下用記憶裡的收合（存檔失敗也要在這一頁生效）。其餘重畫再跟存檔、群組數對一次。
    if (!animate) folded = desiredFold(all.length);
    const sig = JSON.stringify([folded, activeId, english, all.map((g) => [g.id, g.section, g.name])]);
    if (!animate && sig === shelfSig && !shelf.hidden && shelf.childElementCount) return patchShelf(all);
    shelfSig = sig;
    // 只有人按了展開／收起才長高矮。讀清單、別的分頁改群組，不要每次都演。
    const grow = animate ? heightChange(shelf) : null;
    if (!all.length && folded) {
      shelf.dataset.emptyLine = "true";
      shelf.dataset.folded = "true";
      shelf.hidden = false;
      shelf.replaceChildren(
        el(
          "button",
          {
            class: "bs-empty pressable",
            type: "button",
            onclick: () => {
              try {
                localStorage.setItem(FOLD_KEY, "0");
              } catch {
                /* 存不了就只記在這一頁 */
              }
              folded = false;
              renderShelf({ animate: true });
            },
          },
          el("b", {}, "群組"),
          " · 建立第一組"
        )
      );
      grow?.done();
      return;
    }
    delete shelf.dataset.emptyLine;
    const lanes = GROUP_SECTIONS.map((section) => {
      const mine = all.filter((g) => g.section === section);
      return el(
        "div",
        { class: "bs-lane", dataset: { suit: SECTION_SUIT[section] } },
        el("span", { class: "bs-lane-label" }, SECTION_ZH[section]),
        el(
          "div",
          { class: "bs-lane-row" },
          ...mine.map(tile),
          el(
            "button",
            { class: "bs-new pressable", type: "button", "aria-label": `新增${SECTION_ZH[section]}群組`, title: `新增${SECTION_ZH[section]}群組`, onclick: (e) => create(section, e.currentTarget) },
            el("span", { "aria-hidden": "true" }, "＋")
          )
        )
      );
    });
    const intro = all.length
      ? null
      : el("p", { class: "bs-intro" }, "卡片群組：長相、服裝、姿勢、場景各自可以建好幾組牌，墨池抽牌時選要從哪幾組抽。按「＋」建一組，再點牌加進去。");
    const fold = el(
      "button",
      {
        class: "bs-fold pressable",
        type: "button",
        "aria-expanded": folded ? "false" : "true",
        onclick: () => {
          folded = !folded;
          try {
            localStorage.setItem(FOLD_KEY, folded ? "1" : "0");
          } catch {
            /* 存不了就只記在這一頁 */
          }
          renderShelf({ animate: true });
        },
      },
      folded ? "展開" : "收起"
    );
    // 收著：一排小籤（組名），點了一樣打開那組；攤開才是一疊一疊的牌。
    // 人按了展開／收起：要收走的那一排（攤開的一疊疊、或收著的小籤）淡出（殘影），不是一格換掉（2026-11-21）。
    const leaving = animate && !reducedMotion() ? ghostOut(shelf, folded ? ":scope > .bs-lanes, :scope > .bs-intro" : ":scope > .bs-compact") : null;
    const compact = el(
      "div",
      { class: "bs-compact" },
      ...all.map((g) =>
        el(
          "button",
          { class: "bs-chip pressable", type: "button", dataset: { suit: SECTION_SUIT[g.section] }, "aria-pressed": g.id === activeId ? "true" : "false", onclick: (e) => pick(g.id === activeId ? "" : g.id, e.currentTarget) },
          el("span", { dataset: { noI18n: "" } }, g.name)
        )
      )
    );
    shelf.replaceChildren(
      ...[
        el("div", { class: "bs-title" }, el("b", {}, "群組"), el("span", { class: "bs-sub" }, all.length ? `${all.length} 組` : ""), fold),
        folded ? null : intro,
        folded ? (all.length ? compact : null) : el("div", { class: "bs-lanes" }, lanes),
      ].filter(Boolean)
    );
    shelf.dataset.folded = folded ? "true" : "false";
    shelf.hidden = false;
    if (animate && !folded && !reducedMotion()) shelf.querySelector(".bs-lanes")?.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
    if (animate && folded && !reducedMotion()) shelf.querySelector(".bs-compact")?.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, delay: DUR.micro, easing: css(CURVE.out), fill: "backwards" });
    leaving?.done();
    grow?.done();
  }

  function renderHead() {
    if (!head) return;
    const g = active();
    if (!g) {
      // 不看這組了：標頭淡出（殘影），不是整塊一格不見（2026-11-21）。
      const ghost = !head.hidden ? ghostOut(head.parentElement, ":scope > #book-shelf-head") : null;
      head.hidden = true;
      head.replaceChildren();
      ghost?.done();
      float.hidden = true;
      document.documentElement.removeAttribute("data-book-group");
      head._key = "";
      return;
    }
    float.hidden = !editing;
    const floatText = `完成 · ${g.tags.length} 張`;
    if (float.textContent !== tr(floatText)) float.textContent = floatText;
    document.documentElement.dataset.bookGroup = editing ? "edit" : "view";
    const name = el("input", {
      class: "bsh-name",
      type: "text",
      maxlength: "40",
      value: g.name,
      "aria-label": "群組名字（直接改）",
      dataset: { noI18n: "" },
    });
    const rename = () => {
      const v = name.value.trim();
      if (!v || v === g.name) return (name.value = g.name);
      write(g.id, (cur) => ({ ...cur, name: v }), "改好名字了").catch(() => {});
    };
    name.addEventListener("change", rename);
    name.addEventListener("keydown", (e) => {
      if (e.key === "Enter") name.blur();
      if (e.key === "Escape") {
        name.value = g.name;
        name.blur();
      }
    });
    const count = el("span", { class: "bsh-count" }, `${SECTION_ZH[g.section]} · ${g.tags.length} 張`);
    const edit = el(
      "button",
      { class: editing ? "btn btn-primary bsh-edit" : "btn bsh-edit", type: "button", onclick: () => setEditing(!editing) },
      editing ? "完成" : "加牌"
    );
    const use = el(
      "button",
      {
        class: "btn btn-ghost",
        type: "button",
        title: `墨池的${SECTION_ZH[g.section]}勾上這組（原本勾的照留），然後換到墨池`,
        // 剛點進去的牌還在存：等存完再換頁，墨池讀到的才是最新的那組。
        onclick: async (e) => {
          const btn = e.currentTarget;
          btn.disabled = true;
          if (await waitSaved()) {
            const current = active();
            if (current?.id === g.id) toMochi(current);
          }
          btn.disabled = false;
        },
      },
      "在墨池用這組"
    );
    const del = el("button", { class: "btn btn-ghost bsh-del", type: "button", onclick: () => remove(g) }, "刪除");
    const close = el("button", { class: "bsh-close pressable", type: "button", "aria-label": "回到全部的牌", title: "回到全部的牌", onclick: () => pick("") }, "✕");
    // 組員被分級、性別篩掉的：照樣不畫（分級是看圖的選擇），但說一聲有幾張收起來。
    const hidden = g.tags.filter((t) => {
      const c = lib.byTag.get(t);
      return !c || !visible(c);
    }).length;
    const hint = editing
      ? el("p", { class: "bsh-hint" }, `點${SECTION_ZH[g.section]}的牌加進「${g.name}」，再點一次拿掉。`)
      : g.tags.length
        ? null
        : el("p", { class: "bsh-hint" }, "這組還是空的：按「加牌」挑幾張進來。");
    // 這組管哪幾格：有互斥的照互斥那一格算（披髮跟雙馬尾都佔「髮型」，一張圖只會有一個），
    // 其他格子照常抽。字盒上的細分類跟這個不一定一樣，寫出來免得以為只加了一個小細節。
    const slots = [];
    const seen = new Set();
    for (const t of g.tags) {
      const it = lib.byTag.get(t)?.item;
      if (!it) continue;
      const key = groupSlotKey(it);
      if (seen.has(key)) continue;
      seen.add(key);
      const zh = it.mutex ? data?.groupZh?.[it.group] || data?.groupZh?.[it.sub] : data?.groupZh?.[it.sub] || data?.groupZh?.[it.group];
      if (zh && !slots.includes(zh)) slots.push(zh);
    }
    const slotNote = slots.length
      ? el("p", { class: "bsh-hint bsh-slots" }, el("span", {}, "管的格子："), ...slots.flatMap((z, i) => [i ? (english ? ", " : "、") : null, el("b", {}, z)]), el("span", {}, "（其他照常抽）"))
      : null;
    // 這一段所有的小分類（跟卡冊的小分類籤同一套），一格一顆：這組有放牌的亮著、寫張數，點了只看那一格；
    // 沒放的劃掉 ——那幾格抽牌時照常從整個詞庫抽。加牌時籤在工具列那一排（點了只看那一格的牌）。
    const subRow = editing ? null : subChips(g);
    const hiddenNote = hidden && !editing ? el("p", { class: "bsh-hint bsh-hidden" }, `${hidden} 張被目前的分級、性別收起來了`) : null;
    // 存檔狀態只在加牌時、或還在存／存失敗時露出來：平常看一組不必一直掛著「已儲存」。
    // 「儲存中…」存超過 SLOW_SAVE_MS 才寫（slowSave），存得快就一直是「已儲存」。
    const savingNow = pending.length > 0 && slowSave;
    const status = !editing && !saveError && !savingNow ? null : el("button", {
      class: "bsh-save", type: "button", disabled: !saveError,
      "aria-live": "polite", title: saveError ? errorText(saveError) : "", onclick: retry,
    }, saveError ? "存檔失敗 · 重試" : savingNow ? "儲存中…" : "已儲存");
    const row = el("div", { class: "bsh-row", dataset: { suit: SECTION_SUIT[g.section] } }, name, count, status, el("span", { class: "bsh-acts" }, edit, use, del, close));
    const parts = [row, subRow, slotNote, hint, hiddenNote].filter(Boolean);
    const key = JSON.stringify([g.id, g.name, editing, english]);
    if (head._key === key && !head.hidden && patchHead(parts)) return;
    head._key = key;
    for (const p of parts) signPart(p);
    head.replaceChildren(...parts);
    head.hidden = false;
    head.dataset.suit = SECTION_SUIT[g.section];
    swapIn(head, g.id + (editing ? ":e" : ""), { firstToo: true });
  }

  // 每一塊記下剛做出來（還沒翻譯）時的樣子：英文版畫面上是翻過的字，拿這個比才知道內容有沒有變。
  // 第一排只記會變的張數、存檔字樣（名字欄、按鈕不換）；其他每一塊整塊記。
  function signPart(node) {
    const targets = node.classList.contains("bsh-row") ? node.querySelectorAll(".bsh-count, .bsh-save") : [node];
    for (const n of targets) n.dataset.sig = n.outerHTML;
  }

  /**
   * 標頭還是這一組、同一個模式（加牌／看）：只換內容真的變了的那幾塊（張數、存檔字樣、管的格子、提示）。
   * 名字欄和按鈕留著。以前加牌每點一張，整個標頭重做三次，存檔字樣「已儲存 → 儲存中… → 已儲存」跟著跳。
   * 有一塊出現或消失（例如被分級收起來的那行）就回 false，整個重做。
   */
  function patchHead(parts) {
    const old = [...head.children];
    if (old.length !== parts.length || parts.some((p, i) => p.className !== old[i].className)) return false;
    const [row, ...rest] = parts;
    const oldRow = old[0];
    // a：畫面上那一塊（data-sig 是它剛做出來時的樣子）；b：剛做的新的一塊。一樣就留著舊的。
    const swap = (a, b) => {
      const sig = b.outerHTML;
      if (a.dataset.sig === sig) return;
      b.dataset.sig = sig;
      a.replaceWith(b);
    };
    const count = row.querySelector(".bsh-count");
    const oldCount = oldRow.querySelector(".bsh-count");
    if (count && oldCount) swap(oldCount, count);
    const status = row.querySelector(".bsh-save");
    const oldStatus = oldRow.querySelector(".bsh-save");
    if (status && oldStatus) swap(oldStatus, status);
    else if (oldStatus) oldStatus.remove();
    else if (status) {
      status.dataset.sig = status.outerHTML;
      oldRow.querySelector(".bsh-acts")?.before(status);
    }
    rest.forEach((p, i) => swap(old[i + 1], p));
    return true;
  }

  /** 標頭裡的小分類籤：這一段所有的小分類，這組有的亮、沒有的劃掉。 */
  function subChips(g) {
    const all = lib.cards.filter((c) => c.item?.section === g.section && !c.custom && visible(c));
    const runs = groupChips(all);
    const inGroup = new Map();
    for (const t of g.tags) {
      const c = lib.byTag.get(t);
      if (c) inGroup.set(c.group, (inGroup.get(c.group) || 0) + 1);
    }
    if (sub && !inGroup.has(sub)) sub = "";
    const chip = (i) => {
      const n = inGroup.get(i.g) || 0;
      return el(
        "button",
        {
          class: "bsh-sub pressable",
          type: "button",
          dataset: { has: n ? "true" : "false" },
          "aria-pressed": n && sub === i.g ? "true" : "false",
          disabled: n ? null : true,
          title: n ? `只看這組裡「${i.zh}」的 ${n} 張` : `這組沒有「${i.zh}」：抽牌時照常抽`,
          onclick: () => {
            sub = sub === i.g ? "" : i.g;
            renderHead();
            onChange();
          },
        },
        i.short,
        n ? el("b", { class: "bsh-sub-n" }, String(n)) : null
      );
    };
    const parts = runs.map((r) =>
      r.fam
        ? el("span", { class: "bsh-sub-run" }, el("span", { class: "bsh-sub-fam" }, r.fam), ...r.items.map(chip))
        : chip(r.items[0])
    );
    return el(
      "div",
      { class: "bsh-subs", role: "group", "aria-label": "這組有哪些小分類" },
      el("button", { class: "bsh-sub pressable", type: "button", dataset: { has: "true" }, "aria-pressed": sub ? "false" : "true", onclick: () => ((sub = ""), renderHead(), onChange()) }, "整組", el("b", { class: "bsh-sub-n" }, String(g.tags.length))),
      ...parts
    );
  }

  async function pick(id, from) {
    if (!(await waitSaved())) return;
    activeId = id;
    editing = false;
    sub = "";
    changed();
    const sel = shelf?.querySelector(`.bs-tile[data-id="${CSS.escape(id)}"]`);
    if (sel) seat(sel);
    if (from && document.activeElement === from) sel?.focus({ preventScroll: true });
  }

  async function setEditing(on) {
    if (!on && !(await waitSaved())) return;
    editing = on;
    sub = "";
    changed();
    // 剛進加牌模式：畫面上已在組裡的牌一起蓋一次章（之後重排不再重蓋）。
    if (on && typeof document.querySelectorAll === "function") for (const cell of document.querySelectorAll('#book-grid .book-cell[data-ingroup="true"]')) freshStamp(cell);
  }

  /** 這一格的章要演蓋下去那一下：標一下，播完拿掉（groups.css 只給標著的播）。 */
  function freshStamp(cell) {
    cell.dataset.stamp = "fresh";
    clearTimeout(cell._stampT);
    cell._stampT = setTimeout(() => {
      if (cell.dataset.stamp === "fresh") delete cell.dataset.stamp;
    }, DUR.medium + 120);
  }

  /**
   * 改一組：change(伺服器上最新的那組) → 要存的那組。依序送，而且每一筆在送出那一刻才從最新的清單算 ——
   * 連點好幾張牌時，第二筆不會拿第一筆存好之前的舊版去存（那樣會被當成別台改過、409）。
   */
  function write(id, change, done) {
    const entry = { id, change, done };
    pending.push(entry);
    if (!slowTimer && !slowSave)
      slowTimer = setTimeout(() => {
        slowTimer = 0;
        if (!pending.length) return;
        slowSave = true;
        renderHead();
      }, SLOW_SAVE_MS);
    saving = saving.catch(() => {}).then(() => {
      if (saveError) throw saveError;
      return send(entry);
    });
    saving.catch(() => {});
    changed({ grid: false });
    return saving;
  }

  async function send(entry) {
    // 重試也可能已經送過這筆；等在佇列後面的工作不要重送。
    if (!pending.includes(entry)) return;
    try {
      const cur = (cachedGroups() || []).find(g => g.id === entry.id);
      if (!cur) throw new Error("這個群組已經在別的地方刪掉了");
      const g = await saveGroup(entry.change(cur));
      pending.splice(pending.indexOf(entry), 1);
      if (entry.done) toast(entry.done);
      // 加牌模式裡存好這一組：牌格不用重畫 —— 顯示的是這一段所有的牌（跟組裡有誰無關），章在點下去那一下已經蓋好。
      // 以前每存一筆就整格重畫、工具列那排小分類籤淡出再重做：手機（CPU÷4）每點一張卡 100ms，上方那排閃一下。
      const quiet = editing && entry.id === activeId;
      changed({ keepScroll: true, grid: !quiet });
      // 牌格上的章就是這一組現在的樣子：記成已經畫過，之後讀清單（切回分頁）不會因為「沒畫過」再整格重畫。
      if (quiet) shownSig = groupSig(active());
      return g;
    } catch (err) {
      saveError = err;
      // 別台刪掉的組沒有重試對象，也不能讓失敗佇列擋住其他群組。
      if (!(cachedGroups() || []).some(g => g.id === entry.id)) {
        for (let i = pending.length - 1; i >= 0; i--) if (pending[i].id === entry.id) pending.splice(i, 1);
        if (!pending.length) saveError = null;
      }
      toast(errorText(err));
      changed({ keepScroll: true });
      throw err;
    }
  }

  function retry() {
    saving = saving.catch(() => {}).then(async () => {
      saveError = null;
      changed({ grid: false });
      await loadGroups();
      for (const entry of [...pending]) await send(entry);
    });
    saving.catch(() => {});
  }

  async function create(section, from) {
    if (!(await waitSaved())) return;
    const zh = SECTION_ZH[section];
    // 預設名字：段落＋A、B、C（英文版是 Appearance A）；建好就能在標頭直接改。
    const name = nextName(section);
    try {
      const g = await saveGroup({ name, section, tags: [] });
      activeId = g.id;
      editing = true;
      changed();
      const t = shelf?.querySelector(`.bs-tile[data-id="${CSS.escape(g.id)}"]`);
      if (t) enter(t);
      head?.querySelector(".bsh-name")?.select();
      toast(`建好「${g.name}」：點${zh}的牌加進去，名字可以直接改`);
    } catch (err) {
      refuse(from);
      toast(errorText(err));
    }
  }

  async function remove(g) {
    if (!(await waitSaved())) return;
    g = groups().find(cur => cur.id === g.id) || g;
    const before = { ...g };
    deleteGroup(g.id).then(
      () => {
        if (activeId === g.id) {
          activeId = "";
          editing = false;
        }
        changed();
        toast(`刪掉「${before.name}」`, {
          action: {
            label: "復原",
            run: () =>
              saveGroup({ ...before, restore: true }).then(
                (back) => {
                  activeId = back.id;
                  changed();
                },
                (err) => toast(errorText(err))
              ),
          },
        });
      },
      (err) => toast(errorText(err))
    );
  }

  /** 加牌模式點一張牌：在群組裡就拿掉，不在就加進去。牌上的章跟著蓋上／掀掉。 */
  function toggle(card, node) {
    const g = active();
    if (!g || !editing) return false;
    if (sectionOf(card) !== g.section) {
      refuse(node);
      toast(`「${card.zh}」不是${SECTION_ZH[g.section]}的牌`);
      return true;
    }
    const had = g.tags.includes(card.tag);
    if (!had && g.tags.length >= MAX_TAGS) {
      refuse(node);
      toast(`一個群組最多 ${MAX_TAGS} 張`);
      return true;
    }
    // 先蓋章，待存操作會疊在伺服器底稿上。
    const cell = node?.closest?.(".book-cell");
    if (cell) {
      cell.dataset.ingroup = had ? "false" : "true";
      if (!had) freshStamp(cell);
      // 章是 CSS 畫的（groups.css：加牌模式裡 data-ingroup 的牌）；蓋上去的那一下牌也被壓一下。
      if (!had && !reducedMotion()) node.animate([{ transform: "scale(0.96)" }, { transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
    }
    const tag = card.tag;
    write(g.id, (cur) => ({ ...cur, tags: had ? cur.tags.filter((t) => t !== tag) : cur.tags.includes(tag) ? cur.tags : [...cur.tags, tag] })).catch(() => {});
    return true;
  }

  /** 牌的詳情裡的「群組」那一列。 */
  function detailRow(card) {
    const section = sectionOf(card);
    if (!GROUP_SECTIONS.includes(section) || card.banned || card.custom) return null;
    const box = el("div", { class: "bs-detail", dataset: { suit: SECTION_SUIT[section] } });
    const paint = () => {
      const mine = groups().filter((g) => g.section === section);
      box.replaceChildren(
        el("span", { class: "bs-detail-label" }, "群組"),
        ...mine.map((g) => {
          const on = g.tags.includes(card.tag);
          return el(
            "button",
            {
              class: "bs-chip pressable",
              type: "button",
              "aria-pressed": on ? "true" : "false",
              title: on ? `從「${g.name}」拿掉` : `加進「${g.name}」`,
              onclick: async (e) => {
                const btn = e.currentTarget;
                // 連點時 paint() 還沒重畫，閉包裡的 on 仍是上一格。跟加牌模式一樣，用現在的群組（含還沒送完的）重算。
                const now = groups().find((x) => x.id === g.id);
                const onNow = !!now?.tags.includes(card.tag);
                if (!onNow && (now?.tags.length || 0) >= MAX_TAGS) return refuse(btn), toast(`一個群組最多 ${MAX_TAGS} 張`);
                btn.setAttribute("aria-pressed", onNow ? "false" : "true");
                if (!reducedMotion()) btn.animate([{ transform: "scale(0.96)" }, { transform: "none" }], { duration: DUR.short, easing: css(CURVE.settle) });
                const tag = card.tag;
                try {
                  await write(g.id, (cur) => ({ ...cur, tags: onNow ? cur.tags.filter((t) => t !== tag) : cur.tags.includes(tag) ? cur.tags : [...cur.tags, tag] }), onNow ? `從「${g.name}」拿掉了` : `加進「${g.name}」了`);
                  changed();
                } catch {
                  /* write 已經說了 */
                }
                paint();
              },
            },
            el("span", { dataset: { noI18n: "" } }, g.name)
          );
        }),
        el(
          "button",
          {
            class: "bs-chip bs-chip-new pressable",
            type: "button",
            onclick: async (e) => {
              try {
                const g = await saveGroup({ name: nextName(section), section, tags: [card.tag] });
                toast(`建好「${g.name}」，放進這張了`);
                changed();
                paint();
              } catch (err) {
                refuse(e.currentTarget);
                toast(errorText(err));
              }
            },
          },
          "＋ 新群組"
        )
      );
    };
    paint();
    return box;
  }

  async function clear() {
    if (!(await waitSaved())) return;
    if (!activeId) return;
    activeId = "";
    editing = false;
    changed({ grid: false });
  }

  /** #groups=feature（從墨池的面板來）：捲到書架、那一段沒有群組就直接建一組。#group=<id>：打開那一組。 */
  async function openFromHash(hash) {
    const m = /^#groups?=(.+)$/.exec(hash || "");
    if (!m) return false;
    history.replaceState(null, "", location.pathname + location.search);
    await loadGroups();
    const v = decodeURIComponent(m[1]);
    const byId = groups().find((g) => g.id === v);
    if (byId) await pick(byId.id);
    else changed({ grid: false });
    shelf?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    const lane = GROUP_SECTIONS.includes(v) ? shelf?.querySelector(`.bs-lane[data-suit="${SECTION_SUIT[v]}"]`) : null;
    if (lane && !reducedMotion()) lane.animate([{ backgroundColor: "color-mix(in oklch, var(--gp-suit) 22%, transparent)" }, { backgroundColor: "transparent" }], { duration: DUR.breath, easing: css(CURVE.out) });
    return true;
  }

  onGroupsChange(() => {
    if (activeId && !active()) {
      activeId = "";
      editing = false;
      changed();
      return;
    }
    const g = active();
    const next = groupSig(g);
    // 自己按下的那筆還在佇列裡：send 收尾會 changed。這裡再畫一次，牌格會跳兩次。
    const external = !g || !pending.some((p) => p.id === g.id);
    renderShelf();
    renderHead();
    if (g && external && next !== shownSig) {
      shownSig = next;
      // 別的裝置改了這一組的牌：摘要已經會變，牌格也要跟著（FLIP，不把整頁拉回頂）。
      onChange({ keepScroll: true });
    }
  });
  renderShelf();
  loadGroups();

  return {
    active,
    editing: () => editing && !!active(),
    shown: () => !!active(),
    keep(card) {
      const g = active();
      if (!g) return null;
      if (editing) return sectionOf(card) === g.section;
      return g.tags.includes(card.tag);
    },
    has: (tag) => !!active()?.tags.includes(tag),
    /** 看一組時挑的小分類（空字串＝整組）。 */
    sub: () => (editing ? "" : sub),
    toggle,
    detailRow,
    clear,
    openFromHash,
  };
}

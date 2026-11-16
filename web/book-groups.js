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
import { reducedMotion, DUR, CURVE, css, swapIn, enter, seat, refuse } from "./motion.js";
import { loadGroups, cachedGroups, onGroupsChange, saveGroup, deleteGroup, GROUP_SECTIONS } from "./card-groups.js";
import { SECTION_ZH, SECTION_SUIT } from "./group-picks.js";
import { t as tr, english } from "./i18n.js";
import { groupSlotKey } from "./engine.js";
import { groupChips } from "./cards.js";

const MAX_TAGS = 120;

const FOLD_KEY = "mochi.book.shelf.v1";
const readFold = () => {
  try {
    const v = localStorage.getItem(FOLD_KEY);
    // 沒存過：手機上先收著（書架四段直排會把牌推出第一屏），電腦攤開。
    return v === null ? matchMedia("(max-width: 34rem)").matches : v === "1";
  } catch {
    return false;
  }
};

export function mountBookGroups({ lib, assets, onChange, toMochi, visible, data }) {
  const shelf = document.getElementById("book-shelf");
  const head = document.getElementById("book-shelf-head");
  let activeId = "";
  let editing = false;
  // 看一組時，標頭的小分類籤挑的那一格（只看這組裡那一格的牌）；空字串是整組。
  let sub = "";
  let saving = Promise.resolve();
  let folded = readFold();
  // 加牌時浮在畫面底下的「完成」：手機上工具列不黏，捲到多下面都按得到。
  const float = el("button", { class: "btn btn-primary bsh-float pressable", type: "button", hidden: true, onclick: () => setEditing(false) });
  document.body.append(float);

  const groups = () => cachedGroups() || [];
  const active = () => (activeId && groups().find((g) => g.id === activeId)) || null;
  const sectionOf = (card) => card?.item?.section;
  const zhOf = (t) => lib.byTag.get(t)?.zh || t;

  function changed({ grid = true } = {}) {
    renderShelf();
    renderHead();
    if (grid) onChange();
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

  function tile(g) {
    const on = g.id === activeId;
    return el(
      "button",
      {
        class: "bs-tile pressable",
        type: "button",
        dataset: { suit: SECTION_SUIT[g.section], id: g.id },
        "aria-pressed": on ? "true" : "false",
        title: g.tags.map(zhOf).join("、") || "空的群組",
        onclick: (e) => pick(on ? "" : g.id, e.currentTarget),
      },
      stack(g),
      el("span", { class: "bs-name", dataset: { noI18n: "" } }, g.name),
      el("span", { class: "bs-count" }, `${g.tags.length} 張`)
    );
  }

  function renderShelf() {
    if (!shelf) return;
    const all = groups();
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
          renderShelf();
          if (!folded && !reducedMotion()) shelf.querySelector(".bs-lanes")?.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
        },
      },
      folded ? "展開" : "收起"
    );
    // 收著：一排小籤（組名），點了一樣打開那組；攤開才是一疊一疊的牌。
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
  }

  function renderHead() {
    if (!head) return;
    const g = active();
    if (!g) {
      head.hidden = true;
      head.replaceChildren();
      float.hidden = true;
      document.documentElement.removeAttribute("data-book-group");
      return;
    }
    float.hidden = !editing;
    float.textContent = `完成 · ${g.tags.length} 張`;
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
        onclick: (e) => {
          e.currentTarget.disabled = true;
          saving.then(() => toMochi(g));
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
    head.replaceChildren(...[el("div", { class: "bsh-row", dataset: { suit: SECTION_SUIT[g.section] } }, name, count, el("span", { class: "bsh-acts" }, edit, use, del, close)), subRow, slotNote, hint, hiddenNote].filter(Boolean));
    head.hidden = false;
    head.dataset.suit = SECTION_SUIT[g.section];
    swapIn(head, g.id + (editing ? ":e" : ""), { firstToo: true });
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

  function pick(id, from) {
    activeId = id;
    editing = false;
    sub = "";
    changed();
    const sel = shelf?.querySelector(`.bs-tile[data-id="${CSS.escape(id)}"]`);
    if (sel) seat(sel);
    if (from && document.activeElement === from) sel?.focus({ preventScroll: true });
  }

  function setEditing(on) {
    editing = on;
    sub = "";
    changed();
  }

  /**
   * 改一組：change(伺服器上最新的那組) → 要存的那組。依序送，而且每一筆在送出那一刻才從最新的清單算 ——
   * 連點好幾張牌時，第二筆不會拿第一筆存好之前的舊版去存（那樣會被當成別台改過、409）。
   */
  function write(id, change, done) {
    const job = saving.then(() => {
      const cur = groups().find((g) => g.id === id);
      if (!cur) throw new Error("這個群組已經在別的地方刪掉了");
      return saveGroup(change(cur));
    });
    saving = job.catch(() => {});
    return job.then(
      (g) => {
        if (done) toast(done);
        return g;
      },
      async (err) => {
        // 別台改過或刪掉（409）：換成伺服器上那份重畫，說一聲。
        toast(friendlyError(err));
        await loadGroups();
        changed();
        throw err;
      }
    );
  }

  async function create(section, from) {
    const zh = SECTION_ZH[section];
    const n = groups().filter((g) => g.section === section).length;
    // 預設名字：段落＋A、B、C（英文版是 Appearance A）；建好就能在標頭直接改。
    const name = `${tr(zh)} ${String.fromCharCode(65 + (n % 26))}`;
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
      toast(friendlyError(err));
    }
  }

  function remove(g) {
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
                (err) => toast(friendlyError(err))
              ),
          },
        });
      },
      (err) => toast(friendlyError(err))
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
    const tags = had ? g.tags.filter((t) => t !== card.tag) : [...g.tags, card.tag];
    // 先在畫面上改（樂觀），伺服器回來再對一次。
    g.tags = tags;
    const cell = node?.closest?.(".book-cell");
    if (cell) {
      cell.dataset.ingroup = had ? "false" : "true";
      // 章是 CSS 畫的（groups.css：加牌模式裡 data-ingroup 的牌）；蓋上去的那一下牌也被壓一下。
      if (!had && !reducedMotion()) node.animate([{ transform: "scale(0.96)" }, { transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
    }
    renderHead();
    renderShelf();
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
                if (!on && g.tags.length >= MAX_TAGS) return refuse(btn), toast(`一個群組最多 ${MAX_TAGS} 張`);
                btn.setAttribute("aria-pressed", on ? "false" : "true");
                const tag = card.tag;
                try {
                  await write(g.id, (cur) => ({ ...cur, tags: on ? cur.tags.filter((t) => t !== tag) : cur.tags.includes(tag) ? cur.tags : [...cur.tags, tag] }), on ? `從「${g.name}」拿掉了` : `加進「${g.name}」了`);
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
              const n = mine.length;
              try {
                const g = await saveGroup({ name: `${tr(SECTION_ZH[section])} ${String.fromCharCode(65 + (n % 26))}`, section, tags: [card.tag] });
                toast(`建好「${g.name}」，放進這張了`);
                changed();
                paint();
              } catch (err) {
                refuse(e.currentTarget);
                toast(friendlyError(err));
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

  function clear() {
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
    if (byId) pick(byId.id);
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
    renderShelf();
    renderHead();
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

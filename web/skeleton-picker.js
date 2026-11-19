/**
 * 「每段抽幾個」底下的選格（墨池、疊印台共用）。
 *
 * 低於原來的自由補抽門檻時展開選格，亮著的格數＝數字。
 * 點暗的種類換格，數字不變；常用種類直接顯示，新增细項放「更多種類」。
 * 門檻保留舊值，避免既有預設抽牌改變。0 是整段不補。
 *
 * 切換只改那一顆的狀態、不重畫：劃線、蓋章、展開的動效才播得出來。
 *
 * 「隨機」開關（每段一顆）：開著時可以亮好幾格，點一格就是加進／拿出候選（最後一格不能拿）；
 * 每張圖從亮著的格子裡隨機挑「數字」那麼多格（引擎的 skeletonDraw，跟著種子走）。
 * 打開那一下骰子轉一圈、亮著的格子依序晃一下（像在搖）；關掉時多出來的格子照優先序熄掉。
 */
import { el, toast } from "./ui.js";
import { seat, refuse, reducedMotion } from "./motion.js";
import { SKELETON, skeletonCap, skeletonLit, swapSkeleton, toggleSkeleton, setSkelRandom, skelRandomOn } from "./engine.js";
import { effectiveHeats } from "./draw-with-seed.js";
import { heatBlockedByRating } from "./scene-policy.js";
import { ratingOf } from "./rules/rating.js";

// 姿勢的這三格是「尺度」管的：尺度沒開，選了也抽不到（尺度是總開關，選格只在它允許的範圍裡挑）。
const HEAT_OF = { "pose:tease": "tease", "pose:flash": "flash", "pose:sex": "sex" };
const HEAT_ZH = { tease: "誘惑", flash: "走光", sex: "性愛" };

/** 尺度那一排的這一顆亮一下，指給人看要去哪裡開。 */
function pointHeat(h) {
  const b = document.querySelector(`.chip-toggle[data-heat="${h}"]`);
  if (!b) return;
  b.classList.remove("is-pointed");
  void b.offsetWidth;
  b.classList.add("is-pointed");
  b.addEventListener("animationend", () => b.classList.remove("is-pointed"), { once: true });
}

const SECTION_ZH = { feature: "長相", clothing: "服裝", pose: "姿勢", env: "場景" };
const DICE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/></svg>';
const ORDER = ["feature", "clothing", "pose", "env"];
const COMMON = { feature: 5, clothing: 8, pose: 5, env: 4 };

/**
 * groupKeys(section)：墨池勾了的卡片群組在這一段管到哪幾格（Set，格子的 key 跟這裡的一樣）。
 * 那幾顆用群組的顏色（那一段的花色）描一圈、右上角一個小點：看得出哪幾格會從群組抽。疊印台沒有群組，不給。
 */
export function skeletonPicker({ settings, save, groupKeys = null }) {
  // 每段記住「亮起來的先後」：換格時熄掉最早亮的那一顆（數字 1 就是單選）。
  const recent = {};
  const rows = {};

  const litOf = (section) => skeletonLit(settings(), section);
  // 這一格要的尺度沒開（或分級擋掉）：回傳那個尺度；沒有限制回傳 null。
  const heatOff = (key) => {
    const h = HEAT_OF[key];
    if (!h) return null;
    const s = settings();
    // 跟上面的尺度鈕同一個分級（有效分級：開了「不限制」就不擋），不然上面能勾、這裡卻說要先開尺度。
    return effectiveHeats(s).includes(h) && !heatBlockedByRating(h, ratingOf(s)) ? null : h;
  };
  const count = (section) => Number(settings().counts?.[section]) || 0;
  const open = (section) => count(section) > 0 && count(section) < skeletonCap(section);

  const randomOf = (section) => skelRandomOn(settings(), section);
  const noteOf = (section) => {
    const n = count(section);
    if (randomOf(section)) {
      // 整句寫死（服裝說「種」、其他說「格」）：英文版照模板整句翻，數字是 {0}、{1}。
      const lit = litOf(section).length;
      if (section === "clothing")
        return lit <= n ? `隨機：亮著 ${lit} 種，多點亮幾種，每張就從裡面挑 ${n} 種` : `隨機：每張從亮著的 ${lit} 種裡挑 ${n} 種；點一下加進或拿出候選`;
      return lit <= n ? `隨機：亮著 ${lit} 格，多點亮幾格，每張就從裡面挑 ${n} 格` : `隨機：每張從亮著的 ${lit} 格裡挑 ${n} 格；點一下加進或拿出候選`;
    }
    const unit = section === "clothing" ? "種、每種一件" : "格";
    return n === 1 ? `只補 1 ${unit}，點一顆換過去；釘選只佔同類格` : `只補 ${n} ${unit}，點暗的會換掉最早選的；釘選只佔同類格`;
  };

  const syncRow = (section, { stamp = false } = {}) => {
    const row = rows[section];
    const lit = litOf(section);
    const was = row.dataset.open === "true";
    const now = open(section);
    row.dataset.open = now ? "true" : "false";
    row.setAttribute("aria-hidden", now ? "false" : "true");
    row.inert = !now;
    // 剛展開：格子依序浮上來。
    if (now && !was) {
      row.classList.remove("is-opening");
      void row.offsetWidth;
      row.classList.add("is-opening");
      clearTimeout(row._openTimer);
      row._openTimer = setTimeout(() => row.classList.remove("is-opening"), 900);
    }
    row.querySelector(".skel-note").textContent = now ? noteOf(section) : "";
    const rnd = randomOf(section);
    row.dataset.random = rnd ? "true" : "false";
    const sw = row.querySelector(".skel-rand");
    sw?.setAttribute("aria-checked", rnd ? "true" : "false");
    if (sw) sw.title = rnd ? "隨機開著：每張從亮著的格子裡隨機挑（點一下關掉）" : "打開隨機：可以亮好幾格，每張從裡面隨機挑";
    const more = row.querySelector(".skel-more");
    if (more && lit.some(k => SKELETON[section].slice(COMMON[section]).some(([g]) => k === `${section}:${g}`))) more.open = true;
    // 一開始：優先序越後面的越「舊」，先被換掉。之後按 ＋ 亮起來的算最新。
    if (!recent[section]) recent[section] = [...lit].reverse();
    else {
      const keep = recent[section].filter((k) => lit.includes(k));
      for (const k of lit) if (!keep.includes(k)) keep.push(k);
      recent[section] = keep;
    }
    const blockedLit = [];
    const grouped = groupKeys?.(section) || new Set();
    for (const btn of row.querySelectorAll(".skel-chip")) {
      const on = lit.includes(btn.dataset.key);
      const before = btn.getAttribute("aria-pressed") === "true";
      const need = heatOff(btn.dataset.key);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      // 尺度沒開的：照樣列出來但變灰、寫清楚要去哪裡開（不藏起來，藏了會找不到它在哪）。
      if (need) btn.dataset.needHeat = need;
      else delete btn.dataset.needHeat;
      btn.title = need
        ? `要先在上面的尺度選「${HEAT_ZH[need]}」才會補`
        : rnd
          ? on ? `「${btn.dataset.zh}」在隨機候選裡（點一下拿出）` : `把「${btn.dataset.zh}」加進隨機候選`
          : on ? `會補「${btn.dataset.zh}」` : `換成「${btn.dataset.zh}」`;
      if (grouped.has(btn.dataset.key)) {
        btn.dataset.group = "true";
        btn.title += on ? "（從勾的群組抽）" : "（勾的群組有這格；亮起來才會從群組抽）";
      } else delete btn.dataset.group;
      if (need && on) blockedLit.push(HEAT_ZH[need]);
      if (stamp && on && !before) seat(btn);
      if (stamp && !on && before && !reducedMotion()) btn.animate([{ transform: "scale(0.94)" }, { transform: "none" }], { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    }
    const heatNote = row.querySelector(".skel-heat-note");
    if (heatNote) {
      heatNote.textContent = blockedLit.length ? `這幾格現在抽不到：要先在上面的尺度選「${blockedLit.join("、")}」。` : "";
      heatNote.hidden = !blockedLit.length;
    }
  };

  for (const section of ORDER) {
    const chips = SKELETON[section].map(([group, zh], i) =>
      el(
        "button",
        {
          class: "skel-chip pressable",
          type: "button",
          style: `--i:${i}`,
          dataset: { key: `${section}:${group}`, zh },
          "aria-pressed": "false",
          onclick: (e) => {
            const btn = e.currentTarget;
            const key = btn.dataset.key;
            const need = heatOff(key);
            if (need) {
              // 尺度沒開：格子搖一下，尺度那顆亮一下指給你看，說為什麼。
              refuse(btn);
              pointHeat(need);
              toast(`要先在上面的尺度選「${HEAT_ZH[need]}」，選格才抽得到`);
              return;
            }
            // 隨機：點一下加進／拿出候選（數字不變）；最後一格不能拿。
            if (randomOf(section)) {
              const patch = toggleSkeleton(settings(), section, key);
              if (!patch) {
                refuse(btn);
                toast("隨機至少要留一格候選");
                return;
              }
              save(patch);
              syncRow(section, { stamp: true });
              return;
            }
            if (litOf(section).includes(key)) {
              // 已經亮著：數字才是「幾格」，這裡只負責「哪幾格」。
              refuse(btn);
              return;
            }
            const victim = (recent[section] || [])[0];
            const patch = swapSkeleton(settings(), section, key, victim);
            if (!patch) {
              refuse(btn);
              return;
            }
            save(patch);
            recent[section] = [...(recent[section] || []).filter((k) => k !== victim), key];
            syncRow(section, { stamp: true });
          },
        },
        el("span", { class: "skel-chip-name" }, zh)
      )
    );
    rows[section] = el(
      "div",
      { class: "skel-row", dataset: { section, open: "false" } },
      el(
        "div",
        { class: "skel-inner" },
        el(
          "div",
          { class: "skel-body", role: "group", "aria-label": `${SECTION_ZH[section]}補哪幾格` },
          el("span", { class: "skel-name" }, SECTION_ZH[section]),
          randSwitch(section),
          el("div", { class: "skel-chips" }, chips.slice(0, COMMON[section])),
          el("details", { class: "skel-more" }, el("summary", { class: "pressable" }, "更多種類"), el("div", { class: "skel-chips" }, chips.slice(COMMON[section]))),
          el("span", { class: "skel-note", "aria-live": "polite" }),
          section === "pose" ? el("span", { class: "skel-note skel-heat-note", "aria-live": "polite", hidden: true }) : null,
          section === "pose" ? el("span", { class: "skel-note" }, "性愛與走光也受選格限制；仍須符合尺度與情境，無可用牌時會留空。") : null,
          section === "feature" ? el("span", { class: "skel-note" }, "選格時職業依這裡的選擇；自由補抽時依「抽職業」開關。體型依人物性別補。", " ", "種族需使用「多元／奇葩」場景。") : null
        )
      )
    );
  }

  function randSwitch(section) {
    const b = el(
      "button",
      { class: "skel-rand pressable", type: "button", role: "switch", "aria-checked": "false", "aria-label": `${SECTION_ZH[section]}隨機` },
      el("span", { class: "skel-rand-dice", html: DICE }),
      el("span", { class: "skel-rand-text" }, "隨機")
    );
    b.addEventListener("click", () => {
      const on = !randomOf(section);
      save(setSkelRandom(settings(), section, on));
      syncRow(section, { stamp: true });
      if (reducedMotion()) return;
      // 打開：骰子轉一圈，亮著的格子依序晃一下（像在搖）。關掉：骰子倒轉回去。
      b.querySelector(".skel-rand-dice")?.animate(
        [{ transform: "rotate(0) scale(1)" }, { transform: `rotate(${on ? 360 : -180}deg) scale(1.15)`, offset: 0.6 }, { transform: `rotate(${on ? 360 : -180}deg) scale(1)` }],
        { duration: on ? 560 : 320, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.2)" }
      );
      if (on)
        [...rows[section].querySelectorAll('.skel-chip[aria-pressed="true"]')].forEach((c, i) =>
          c.animate(
            [{ transform: "none" }, { transform: "rotate(-4deg) translateY(-2px)" }, { transform: "rotate(3deg)" }, { transform: "none" }],
            { duration: 420, delay: 80 + i * 60, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
          )
        );
    });
    return b;
  }

  const node = el("div", { class: "skel-picker" }, el("p", { class: "skel-guide" }, "長相、服裝、姿勢設 1–4，場景設 1–3，可選擇補抽種類；更高的數字為自由補抽。釘選、指定必抽與必要附帶照樣保留。", " ", "種類仍受分級、尺度與場景限制；沒有相容牌時留空。"), ORDER.map((s) => rows[s]));
  for (const s of ORDER) syncRow(s);
  // 第一次畫出來就開著的（重新整理前設過）不要播展開。
  for (const s of ORDER) rows[s].classList.remove("is-opening");

  return {
    node,
    /** 數字改過之後叫一次：展開／收起、亮哪幾格都跟著對齊。 */
    update(section) {
      for (const s of section ? [section] : ORDER) if (rows[s]) syncRow(s, { stamp: true });
    },
    /** 群組的勾選或內容換了：重描哪幾格歸群組（不蓋章）。 */
    repaint() {
      for (const s of ORDER) if (rows[s]) syncRow(s);
    },
  };
}

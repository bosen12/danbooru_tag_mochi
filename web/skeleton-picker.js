/**
 * 「每段抽幾個」底下的選格（墨池、疊印台共用）。
 *
 * 低於原來的自由補抽門檻時展開選格，亮著的格數＝數字。
 * 點暗的種類換格，數字不變；常用種類直接顯示，新增细項放「更多種類」。
 * 門檻保留舊值，避免既有預設抽牌改變。0 是整段不補。
 *
 * 切換只改那一顆的狀態、不重畫：劃線、蓋章、展開的動效才播得出來。
 */
import { el } from "./ui.js";
import { seat, refuse } from "./motion.js";
import { SKELETON, skeletonCap, skeletonLit, swapSkeleton } from "./engine.js";

const SECTION_ZH = { feature: "長相", clothing: "服裝", pose: "姿勢", env: "場景" };
const ORDER = ["feature", "clothing", "pose", "env"];
const COMMON = { feature: 5, clothing: 8, pose: 5, env: 4 };

export function skeletonPicker({ settings, save }) {
  // 每段記住「亮起來的先後」：換格時熄掉最早亮的那一顆（數字 1 就是單選）。
  const recent = {};
  const rows = {};

  const litOf = (section) => skeletonLit(settings(), section);
  const count = (section) => Number(settings().counts?.[section]) || 0;
  const open = (section) => count(section) > 0 && count(section) < skeletonCap(section);

  const noteOf = (section) => {
    const n = count(section);
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
    const more = row.querySelector(".skel-more");
    if (more && lit.some(k => SKELETON[section].slice(COMMON[section]).some(([g]) => k === `${section}:${g}`))) more.open = true;
    // 一開始：優先序越後面的越「舊」，先被換掉。之後按 ＋ 亮起來的算最新。
    if (!recent[section]) recent[section] = [...lit].reverse();
    else {
      const keep = recent[section].filter((k) => lit.includes(k));
      for (const k of lit) if (!keep.includes(k)) keep.push(k);
      recent[section] = keep;
    }
    for (const btn of row.querySelectorAll(".skel-chip")) {
      const on = lit.includes(btn.dataset.key);
      const before = btn.getAttribute("aria-pressed") === "true";
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.title = on ? `會補「${btn.dataset.zh}」` : `換成「${btn.dataset.zh}」`;
      if (stamp && on && !before) seat(btn);
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
          el("div", { class: "skel-chips" }, chips.slice(0, COMMON[section])),
          el("details", { class: "skel-more" }, el("summary", {}, "更多種類"), el("div", { class: "skel-chips" }, chips.slice(COMMON[section]))),
          el("span", { class: "skel-note", "aria-live": "polite" }),
          section === "pose" ? el("span", { class: "skel-note" }, "性愛與走光也受選格限制；仍須符合尺度與情境，無可用牌時會留空。") : null,
          section === "feature" ? el("span", { class: "skel-note" }, "選格時職業依這裡的選擇；自由補抽時依「抽職業」開關。體型依人物性別補。", " ", "種族需使用「多元／奇葩」場景。") : null
        )
      )
    );
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
  };
}

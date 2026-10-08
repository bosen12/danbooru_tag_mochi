/**
 * 「每段抽幾個」底下的選格（墨池、疊印台共用）。
 *
 * 每段有幾格骨架是每張都會補的（姿勢：身體／表情／鏡頭／視線／活動）。以前數字設得比
 * 骨架少時等於沒作用；現在數字就是格數，按到骨架以下，這一段就在步進器底下展開，
 * 列出它的骨架格，亮著的格數＝數字。點一顆暗的就換過去（數字不變），要多要少按 ＋／−。
 * 數字 ≥ 骨架格數、或設 0（整段不補）時收起來。服裝的門檻是 5（預設值）：
 * 設 1～4 才展開，列 8 種，只補亮著的、每種一件。
 *
 * 切換只改那一顆的狀態、不重畫：劃線、蓋章、展開的動效才播得出來。
 */
import { el } from "./ui.js";
import { seat, refuse } from "./motion.js";
import { SKELETON, skeletonCap, skeletonLit, swapSkeleton } from "./engine.js";

const SECTION_ZH = { feature: "長相", clothing: "服裝", pose: "姿勢", env: "場景" };
const ORDER = ["feature", "clothing", "pose", "env"];

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
          el("div", { class: "skel-chips" }, chips),
          el("span", { class: "skel-note", "aria-live": "polite" })
        )
      )
    );
  }

  const node = el("div", { class: "skel-picker" }, ORDER.map((s) => rows[s]));
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

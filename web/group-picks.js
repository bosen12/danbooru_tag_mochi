/**
 * 墨池「每段抽幾個」旁邊的群組膠囊與勾選面板（卡片群組，資料在 card-groups.js）。
 *
 * 膠囊：沒勾是一顆淡淡的小疊牌；勾了亮那一段的花色，寫組名（兩組以上「A 等 2 組」）。
 * 點開：這一段的群組一組一列，勾選要從哪幾組抽；勾兩組以上出現「整組一起｜混著抽」。
 * 底下：把合成池裡這一段的牌存成一組（存好自動勾上）、到卡冊管理群組（編輯、加牌都在卡冊）。
 *
 * 用法：mountGroupPicks({ settings, setSettings, cardOf, poolTags, blocked }) → { pill(section) }
 *   settings()：目前的墨池設定；setSettings(patch)：存設定（不重畫規則區）
 *   cardOf(tag)：字盒那張牌（zh、item）；poolTags()：合成池現在的牌
 *   blocked(tag)：這張牌在目前的設定下一定抽不到的原因（分級、性別…），沒有就 null
 */
import { el, openSheet, toast, friendlyError } from "./ui.js";
import { reducedMotion, DUR, CURVE, css, swapIn, enter } from "./motion.js";
import { cachedGroups, loadGroups, onGroupsChange, pickOf, saveGroup } from "./card-groups.js";
import { groupSlotKey } from "./engine.js";
import { english } from "./i18n.js";

export const SECTION_ZH = { feature: "長相", clothing: "服裝", pose: "姿勢", env: "場景" };
export const SECTION_SUIT = { feature: "look", clothing: "wear", pose: "pose", env: "scene" };

const STACK_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="4.75" y="1.75" width="6.5" height="9.5" rx="1.3" transform="rotate(-20 8 14)"/><rect x="4.75" y="1.75" width="6.5" height="9.5" rx="1.3" transform="rotate(20 8 14)"/><rect x="4.75" y="1.25" width="6.5" height="9.5" rx="1.3"/></svg>';

export function mountGroupPicks({ settings, setSettings, cardOf, poolTags, blocked }) {
  const pills = new Map();

  const groupsOf = (section) => (cachedGroups() || []).filter((g) => g.section === section);

  /** 勾了、而且還在的群組（群組清單還沒讀到：照設定裡的 id，不當成被刪掉）。 */
  const pickedOf = (section) => {
    const { ids, mode } = pickOf(settings(), section);
    const all = cachedGroups();
    if (!all) return { ids, groups: null, mode };
    const groups = ids.map((id) => all.find((g) => g.id === id && g.section === section)).filter(Boolean);
    return { ids: groups.map((g) => g.id), groups, mode };
  };

  /** 一組牌照小分類（字盒那套）數張數：[[小分類名, 張數]…]，照第一次出現的順序。 */
  const subsOf = (tags) => {
    const m = new Map();
    for (const t of tags) {
      const c = cardOf(t);
      if (!c) continue;
      const zh = c.groupZh || c.group;
      m.set(zh, (m.get(zh) || 0) + 1);
    }
    return [...m];
  };

  const setPick = (section, ids, mode) => {
    const next = { ...(settings().groups || {}) };
    if (ids.length) next[section] = { ids, mode };
    else delete next[section];
    setSettings({ groups: next });
    paint(section);
  };

  function paint(section) {
    const p = pills.get(section);
    if (!p) return;
    const { ids, groups } = pickedOf(section);
    const on = ids.length > 0;
    p.btn.dataset.on = on ? "true" : "false";
    // 組名可以被截短，「＋幾組」另一顆小章不截：手機上窄也看得出勾了幾組。
    const empty = on && groups && groups.every(g => !g.tags.length);
    const text = on && groups ? groups[0].name : on ? `${ids.length} 組` : "";
    const more = on && groups && groups.length > 1 ? `＋${groups.length - 1}` : "";
    p.name.textContent = text;
    p.name.hidden = !on;
    // 勾的組全是空的：小章寫「空」，完整的話在 title。
    p.more.textContent = empty ? "空" : more;
    p.more.hidden = !more && !empty;
    const label = empty
      ? `${SECTION_ZH[section]}群組：空的，本輪不使用`
      : on ? `${SECTION_ZH[section]}群組：${(groups || []).map((g) => g.name).join("、") || text}` : `${SECTION_ZH[section]}群組：沒有勾`;
    p.btn.title = label;
    p.btn.setAttribute("aria-label", label);
    swapIn(p.name, text);
    swapIn(p.more, more);
  }

  onGroupsChange(() => {
    for (const section of pills.keys()) paint(section);
  });

  function pill(section) {
    const name = el("span", { class: "gp-pill-name", hidden: true, dataset: { noI18n: "" } });
    const more = el("span", { class: "gp-pill-more", hidden: true });
    const btn = el(
      "button",
      { class: "gp-pill pressable", type: "button", dataset: { suit: SECTION_SUIT[section], on: "false" }, onclick: () => openPicker(section, btn) },
      el("span", { class: "gp-pill-icon", html: STACK_ICON }),
      name,
      more
    );
    pills.set(section, { btn, name, more });
    paint(section);
    return btn;
  }

  function openPicker(section, from) {
    const zh = SECTION_ZH[section];
    const list = el("div", { class: "gp-list", role: "group", "aria-label": `${zh}群組` });
    const seg = modeSeg(section, () => paintSum());
    const lead = el("p", { class: "gp-lead" }, `勾了的群組：${zh}只從這幾組裡抽。群組沒放到的格子照常抽。`);
    const saveBox = el("div", { class: "gp-save" });
    // 勾了的組加起來管幾格、跟這段每張抽幾個比：決定「每段抽幾個」要調多少。
    const sum = el("div", { class: "gp-sum", "aria-live": "polite" });
    const paintSum = () => {
      const { groups } = pickedOf(section);
      const tags = [...new Set((groups || []).flatMap((x) => x.tags))];
      if (!tags.length) {
        sum.hidden = true;
        return;
      }
      const slotsOf = (list) => new Set(list.map((t) => cardOf(t)?.item).filter(Boolean).map(groupSlotKey)).size;
      // 整組一起：每張只用其中一組，格數照單一組算（最少～最多）；混著抽才是全部加起來。
      const { mode } = pickedOf(section);
      const each = mode === "whole" && groups.length > 1 ? groups.map((x) => slotsOf(x.tags)) : null;
      const slots = each ? Math.max(...each) : slotsOf(tags);
      const range = each && Math.min(...each) !== slots ? `${Math.min(...each)}～${slots}` : String(slots);
      const want = Number(settings().counts?.[section]) || 0;
      sum.hidden = false;
      sum.replaceChildren(
        el("span", { class: "gp-sum-subs" }, el("span", { class: "gp-sum-label" }, "勾了的組管："), subsOf(tags).map(([zh, n]) => el("span", { class: "gp-sub" }, zh, el("b", {}, String(n))))),
        el(
          "p",
          { class: "gp-sum-note" },
          want <= 0
            ? `${zh}設 0：這一段不抽，群組也不會用到。`
            : each
              ? `每張只用其中一組（一組管 ${range} 格）；${zh}每張抽 ${want} 個，其他照常抽。`
              : slots >= want
                ? `共 ${slots} 格；${zh}每張抽 ${want} 個，名額先給群組的格子，可能輪不到群組外的。`
                : `共 ${slots} 格；${zh}每張抽 ${want} 個：群組的 ${slots} 格從群組抽，其他 ${want - slots} 個照常抽。`
        )
      );
      swapIn(sum, `${range}|${want}|${tags.length}|${mode}`);
    };
    const sheetBody = el("div", { class: "gp-sheet", dataset: { suit: SECTION_SUIT[section] } }, lead, sum, list, seg.box, saveBox);

    const render = (fresh = null) => {
      const groups = groupsOf(section);
      const { ids } = pickedOf(section);
      list.replaceChildren(
        ...(groups.length
          ? groups.map((g, i) => row(g, ids.includes(g.id), i, fresh === g.id))
          : [el("p", { class: "gp-empty" }, cachedGroups() ? `還沒有${zh}群組。到卡冊挑牌建立，或把合成池裡的牌存成一組。` : "讀取群組…")])
      );
      seg.sync();
      renderSave();
      paintSum();
    };

    function row(g, on, i, fresh) {
      const names = g.tags.map((t) => english ? t.replaceAll("_", " ") : cardOf(t)?.zh || t);
      const missing = g.tags.filter(t => !cardOf(t));
      const out = g.tags.filter((t) => cardOf(t) && blocked(t));
      const box = el("input", { type: "checkbox", class: "gp-check", checked: on || null });
      const r = el(
        "label",
        { class: "gp-row", dataset: { on: on ? "true" : "false" } },
        box,
        el("span", { class: "gp-mark", "aria-hidden": "true" }),
        el(
          "span",
          { class: "gp-row-main" },
          el("span", { class: "gp-row-name", dataset: { noI18n: "" } }, g.name),
          el("span", { class: "gp-row-meta" }, g.tags.length ? `${g.tags.length} 張` : "空的"),
          // 這組有哪些小分類（跟字盒、卡冊的小分類同一套），一格一顆、寫張數：看了就知道勾它會管到哪幾格。
          subsOf(g.tags).length
            ? el("span", { class: "gp-row-subs" }, subsOf(g.tags).map(([zh, n]) => el("span", { class: "gp-sub" }, zh, el("b", {}, String(n)))))
            : null,
          el("span", { class: "gp-row-tags" }, names.slice(0, 8).join(english ? ", " : "、") + (names.length > 8 ? "…" : "")),
          // 只說設定上一定抽不到的（分級、性別、時代）；抽牌途中才決定的（互斥、場景）不先保證。
          out.length ? el("span", { class: "gp-row-warn" }, out.length === g.tags.length ? "這組的牌在現在的設定下都抽不到（分級、性別、時代）" : `${out.length} 張在現在的設定下抽不到（分級、性別、時代）`) : null,
          missing.length ? el("span", { class: "gp-row-warn" }, `${missing.length} 張已不在詞庫中，存檔時會移除`) : null,
          !g.tags.length ? el("span", { class: "gp-row-warn" }, "空的，本輪不使用") : null
        )
      );
      box.addEventListener("change", () => {
        const { ids, mode } = pickedOf(section);
        const next = box.checked ? [...ids, g.id] : ids.filter((x) => x !== g.id);
        r.dataset.on = box.checked ? "true" : "false";
        if (box.checked && !reducedMotion()) r.animate([{ backgroundPosition: "100% 0" }, { backgroundPosition: "0 0" }], { duration: DUR.long, easing: css(CURVE.out) });
        setPick(section, next, mode);
        seg.sync();
        paintSum();
      });
      if (!reducedMotion()) enter(r, { delay: fresh ? 0 : Math.min(i, 8) * 35 });
      return r;
    }

    function renderSave() {
      const mine = poolTags().filter((t) => cardOf(t)?.item?.section === section);
      if (!mine.length) {
        saveBox.replaceChildren();
        return;
      }
      const name = el("input", {
        class: "gp-save-name",
        type: "text",
        maxlength: "40",
        placeholder: "取個名字",
        "aria-label": "群組名字",
        value: mine.slice(0, 2).map((t) => cardOf(t)?.zh || t).join("・"),
      });
      const go = el("button", { class: "btn btn-primary gp-save-btn", type: "submit" }, "存成群組");
      const form = el(
        "form",
        { class: "gp-save-form" },
        el("p", { class: "gp-save-lead" }, `把合成池裡的 ${mine.length} 張${zh}牌存成群組（以後這一格從勾的群組裡抽，合成池不會被換掉）：`),
        el("div", { class: "gp-save-row" }, name, go)
      );
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!name.value.trim()) return name.focus();
        go.disabled = true;
        try {
          const g = await saveGroup({ name: name.value.trim(), section, tags: mine });
          const { ids, mode } = pickedOf(section);
          setPick(section, [...ids, g.id], mode);
          toast(`存好了，已勾上「${g.name}」`);
          render(g.id);
        } catch (err) {
          toast(friendlyError(err));
          go.disabled = false;
        }
      });
      saveBox.replaceChildren(form);
    }

    const toBook = el(
      "a",
      { class: "btn btn-ghost gp-to-book", href: `book.html#groups=${section}` },
      el("span", { class: "gp-pill-icon", html: STACK_ICON }),
      "到卡冊管理群組"
    );
    const stop = onGroupsChange(() => render());
    openSheet(`${zh}群組`, sheetBody, { foot: [toBook], onClose: () => stop() });
    render();
    if (!cachedGroups()) loadGroups().then(() => render());
    from?.blur?.();
  }

  /** 「整組一起｜混著抽」：勾兩組以上才出現，底下一塊會滑的底。 */
  function modeSeg(section, onMode) {
    const items = [
      ["whole", "整組一起", "每張圖先挑一組，再從那組裡抽：同一張不會把兩組拆開來混。開「同一個人」時，第 2 張起長相沿用第 1 張那組。"],
      ["mix", "混著抽", "勾到的組合在一起抽：變化最多，會跨組混搭。"],
    ];
    const thumb = el("span", { class: "gp-seg-thumb", "aria-hidden": "true" });
    const btns = items.map(([v, label]) =>
      el(
        "button",
        {
          class: "gp-seg-btn",
          type: "button",
          role: "radio",
          dataset: { v },
          onclick: () => {
            const { ids } = pickedOf(section);
            setPick(section, ids, v);
            sync();
            onMode?.();
          },
        },
        label
      )
    );
    const note = el("p", { class: "gp-seg-note" });
    const seg = el("div", { class: "gp-seg", role: "radiogroup", "aria-label": "勾了好幾組時怎麼抽" }, thumb, ...btns);
    seg.addEventListener("keydown", e => {
      const index = btns.indexOf(e.target);
      if (index < 0) return;
      let next;
      if (["ArrowRight", "ArrowDown"].includes(e.key)) next = (index + 1) % btns.length;
      else if (["ArrowLeft", "ArrowUp"].includes(e.key)) next = (index + btns.length - 1) % btns.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = btns.length - 1;
      else return;
      e.preventDefault();
      btns[next].click();
      btns[next].focus();
    });
    const box = el("div", { class: "gp-mode", hidden: true }, el("span", { class: "gp-mode-label" }, "勾了好幾組時"), seg, note);
    let placed = false;
    const place = () => {
      const on = btns.find((b) => b.getAttribute("aria-checked") === "true");
      if (!on || !on.offsetWidth) return;
      thumb.style.width = `${on.offsetWidth}px`;
      thumb.style.transform = `translateX(${on.offsetLeft - 2}px)`;
      if (!placed) {
        placed = true;
        requestAnimationFrame(() => (thumb.dataset.ready = "true"));
      }
    };
    function sync() {
      const { ids, mode } = pickedOf(section);
      const show = ids.length > 1;
      if (show && box.hidden) {
        box.hidden = false;
        if (!reducedMotion()) box.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: DUR.medium, easing: css(CURVE.out) });
      } else if (!show) box.hidden = true;
      for (const b of btns) {
        b.setAttribute("aria-checked", b.dataset.v === mode ? "true" : "false");
        b.tabIndex = b.dataset.v === mode ? 0 : -1;
      }
      note.textContent = items.find(([v]) => v === mode)[2];
      swapIn(note, mode);
      requestAnimationFrame(place);
    }
    if (typeof ResizeObserver === "function") new ResizeObserver(() => place()).observe(seg);
    return { box, sync };
  }

  return { pill, paint };
}

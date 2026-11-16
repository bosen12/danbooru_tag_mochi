/**
 * 負面提示詞的編輯區：底模視窗「目前選擇」底下、工作流程設定的「負向」底下共用。
 *
 * 規則存在伺服器（/api/negative-prompts，negative_prompts.py），手機、電腦、MCP 送的圖都照同一份。
 * 兩層：每個模型家族一份預設；底模（或自訂工作流程）可以「自己一份」，沒有就跟著家族。
 * 兩種寫法：在墨池的預設上加字／劃掉字（墨池換預設時照樣有效），或整串自己寫。兩份都留著，切換不會弄丟。
 * 分級補的擋色情字、防未成年的字不能拿掉：伺服器一律接在最後面，這裡只列出來給人看。
 *
 * 動態：整塊只建一次，之後原地改（整塊重畫的話什麼都動不起來）。
 *   兩排分段選項底下一塊會滑的底；點字劃掉是一條線從左畫過去、恢復時從右收回；加的字彈進來、拿掉的縮掉，
 *   旁邊的字滑到新位置（FLIP），不是瞬間跳過去；換寫法時舊的淡出、框的高度變形成新的、新的浮上來；
 *   存好了頂邊掃過一道光、狀態列畫一個勾；恢復預設是一波一波復原。減少動態時全部直接換。
 */

import { FAMILY_LABEL, familyOf } from "./family-sampling.js";

const API = "/api/negative-prompts";
let view = null;
let ask = null;
let writes = Promise.resolve();

function load(force = false) {
  if (view && !force) return Promise.resolve(view);
  if (!ask || force) {
    ask = fetch(API, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j) => {
        if (j?.ok) view = j;
        ask = null;
        return view;
      });
  }
  return ask;
}

/** 存一條規則（rule 是 null 就刪掉）。依序送出，回傳伺服器的回覆；失敗回 { ok: false, error }。 */
function saveRule(scope, key, rule) {
  if (view) {
    const rules = view.rules[scope] || (view.rules[scope] = {});
    if (rule) rules[key] = rule;
    else delete rules[key];
  }
  const run = () =>
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, key, rule }),
    })
      .then((r) => r.json().catch(() => ({ ok: false })))
      .catch(() => ({ ok: false, error: "連不上伺服器" }))
      .then((j) => {
        if (j?.ok) view = j;
        return j;
      });
  writes = writes.then(run, run);
  return writes;
}

const blank = () => ({ mode: "edit", add: [], remove: [], text: "" });
const keyOf = (t) => String(t).replace(/\s+/g, " ").trim().toLowerCase();
const splitTags = (text) => {
  const out = [];
  const seen = new Set();
  for (const raw of String(text || "").split(/[,\n]/)) {
    const t = raw.replace(/\s+/g, " ").trim();
    if (!t || seen.has(keyOf(t))) continue;
    seen.add(keyOf(t));
    out.push(t);
  }
  return out;
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* ---------- 動態的小工具 ---------- */

const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE_OUT = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_EXIT = "cubic-bezier(0.4, 0, 1, 1)";
const SPRING = "cubic-bezier(0.34, 1.4, 0.64, 1)";

/** 時間照頁面的 token（web6 把 --d-ui 接到整頁的節奏）；讀不到就用預設。 */
function ms(node, name, fallback) {
  const v = parseFloat(getComputedStyle(node).getPropertyValue(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function play(node, frames, opts) {
  if (reduce() || !node.animate) return null;
  return node.animate(frames, { fill: "backwards", ...opts });
}

/** FLIP：記下每個子元素的位置 → 改 DOM → 從舊位置滑到新位置。 */
function flip(container, mutate, dur) {
  const before = new Map();
  if (!reduce()) for (const c of container.children) before.set(c, c.getBoundingClientRect());
  mutate();
  if (reduce()) return;
  for (const c of container.children) {
    const a = before.get(c);
    if (!a) continue;
    const b = c.getBoundingClientRect();
    const dx = a.left - b.left;
    const dy = a.top - b.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    c.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: dur, easing: EASE_OUT });
  }
}

/** 分段選項：底下一塊會滑的底。回傳 { box, set(value) }。 */
function segmented(label, items, current, onPick) {
  const box = el("div", "neg-seg");
  box.setAttribute("role", "radiogroup");
  box.setAttribute("aria-label", label);
  const thumb = el("span", "neg-seg-thumb");
  thumb.setAttribute("aria-hidden", "true");
  box.append(thumb);
  const btns = new Map();
  let value = current;
  const place = (animate) => {
    const on = btns.get(value);
    if (!on || !box.isConnected || !on.offsetWidth) return;
    thumb.style.transition = animate && !reduce() ? "" : "none";
    thumb.style.width = on.offsetWidth + "px";
    thumb.style.height = on.offsetHeight + "px";
    thumb.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
    thumb.dataset.ready = "true";
  };
  for (const [v, text] of items) {
    const b = el("button", "neg-seg-btn", text);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => {
      if (v !== value) onPick(v);
    });
    btns.set(v, b);
    box.append(b);
  }
  const set = (v, animate = true) => {
    value = v;
    for (const [k, b] of btns) b.setAttribute("aria-checked", String(k === v));
    place(animate);
  };
  set(current, false);
  // 第一次排好版（或寬度變了，例如換語言、轉手機）才知道位置：不滑，直接放。
  if (typeof ResizeObserver === "function") new ResizeObserver(() => place(false)).observe(box);
  requestAnimationFrame(() => place(false));
  return { box, set };
}

/**
 * scope："ckpts"（底模）或 "workflows"（自訂工作流程）。key：底模的 ckpt_name 或工作流程 id。
 * format：底模的格式（工作流程不用給，墨池替它寫的是 Illustrious 那一串）。
 */
export function negativeBlock({ scope, key, format } = {}) {
  const family = scope === "workflows" ? "illustrious" : familyOf(format);
  const famName = FAMILY_LABEL[family] || family;
  const box = el("section", "neg-block");
  box.dataset.scope = scope;
  box.setAttribute("aria-label", "負面提示詞");
  const UI = () => ms(box, "--d-ui", 220);
  const POP = () => ms(box, "--d-pop", 280);
  const MICRO = () => ms(box, "--d-micro", 140);

  // 這一塊目前的狀態（畫面上看到的就是它；存檔是送它的副本）。
  let info = null;
  let own = false;
  let rule = blank();
  const target = () => (own ? [scope, key] : ["families", family]);

  /* ---------- 存檔與回饋 ---------- */

  const sweep = el("span", "neg-sweep");
  sweep.setAttribute("aria-hidden", "true");
  const status = el("p", "neg-status");
  status.setAttribute("aria-live", "polite");
  const icon = el("span", "neg-status-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const statusText = el("span", null);
  status.append(icon, statusText);
  let quiet = 0;
  let textTimer = 0;
  let saving = 0;

  const say = (state, text) => {
    clearTimeout(quiet);
    status.dataset.state = state;
    statusText.textContent = text;
    status.classList.remove("is-quiet");
    if (state === "saved") {
      play(icon.querySelector("path"), [{ strokeDashoffset: 18 }, { strokeDashoffset: 0 }], { duration: POP(), easing: EASE_OUT });
      play(sweep, [
        { transform: "translateX(-100%)", opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { transform: "translateX(100%)", opacity: 0 },
      ], { duration: POP() * 2.4, easing: EASE_OUT });
      quiet = setTimeout(() => status.classList.add("is-quiet"), 2200);
    } else if (state === "error") {
      play(status, [
        { transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" },
        { transform: "translateX(-2px)" }, { transform: "translateX(0)" },
      ], { duration: POP(), easing: "ease-out" });
    }
  };

  const store = () => {
    const [s, k] = target();
    const body = s === "families" && !changed() ? null : { ...rule, add: [...rule.add], remove: [...rule.remove] };
    const mine = ++saving;
    say("saving", "儲存中…");
    return saveRule(s, k, body).then((j) => {
      if (!box.isConnected || mine !== saving) return;
      if (j?.ok) say("saved", "已存，下一張就用這串。");
      else {
        say("error", j?.error || "存不起來");
        load(true).then(() => box.isConnected && build());
      }
    });
  };

  const changed = () => rule.mode === "replace" || rule.add.length > 0 || rule.remove.length > 0;

  /* ---------- 骨架（只建一次） ---------- */

  const head = el("div", "fam-samp-head neg-head");
  const title = el("span", "fam-samp-title");
  title.append(el("span", null, "負面提示詞"), " · ");
  const fam = el("b", null, famName);
  fam.dataset.noI18n = "";
  title.append(fam);
  const reset = el("button", "fam-samp-reset", "恢復預設");
  reset.type = "button";
  head.append(title, reset);

  const note = el("p", "fam-samp-note neg-note");
  const stage = el("div", "neg-stage");
  const lock = el("details", "neg-locked");
  let scopeSeg = null;
  let modeSeg = null;

  const noteText = () =>
    own
      ? scope === "workflows"
        ? "只有這套工作流程用這一份。"
        : "只有這顆底模用這一份；同一家的其他底模照樣跟著家族。"
      : `改這裡會改到所有跟著 ${famName} 家族的底模${scope === "workflows" ? "和工作流程" : ""}。`;

  const setNote = () => {
    const text = noteText();
    if (note.textContent === text) return;
    if (reduce() || !note.textContent) {
      note.textContent = text;
      return;
    }
    const out = note.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MICRO() * 0.7, easing: EASE_EXIT, fill: "forwards" });
    out.onfinish = () => {
      note.textContent = text;
      out.cancel();
      play(note, [{ opacity: 0, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: UI(), easing: EASE_OUT });
    };
  };

  /* ---------- 加減：一顆顆的字 ---------- */

  let chips = null;
  let input = null;

  const chipFor = (t) => {
    const b = el("button", "neg-chip");
    b.type = "button";
    b.dataset.tag = keyOf(t);
    const word = el("span", "neg-chip-word", t);
    word.dataset.noI18n = "";
    b.append(word);
    const sync = () => {
      const on = !rule.remove.some((r) => keyOf(r) === keyOf(t));
      b.setAttribute("aria-pressed", String(on));
      b.title = on ? "點一下劃掉（不送這個字）" : "已劃掉，點一下恢復";
    };
    sync();
    b._sync = sync;
    b.addEventListener("click", () => {
      const on = b.getAttribute("aria-pressed") === "true";
      rule.remove = on ? [...rule.remove, t] : rule.remove.filter((x) => keyOf(x) !== keyOf(t));
      sync();
      syncReset();
      store();
    });
    return b;
  };

  const addedFor = (t) => {
    const span = el("span", "neg-chip is-added");
    span.dataset.tag = keyOf(t);
    const word = el("span", "neg-chip-word", t);
    word.dataset.noI18n = "";
    const x = el("button", "neg-chip-x", "✕");
    x.type = "button";
    x.setAttribute("aria-label", `拿掉 ${t}`);
    x.dataset.noI18n = "";
    x.addEventListener("click", () => {
      rule.add = rule.add.filter((a) => keyOf(a) !== keyOf(t));
      syncReset();
      store();
      dropChips([span]);
      input?.focus({ preventScroll: true });
    });
    span.append(word, x);
    return span;
  };

  /** 拿掉幾顆：先縮掉，再讓旁邊的滑過來。 */
  const dropChips = (list, stagger = 0) => {
    if (!list.length) return;
    if (reduce()) {
      for (const c of list) c.remove();
      return;
    }
    let left = list.length;
    list.forEach((c, i) => {
      c.style.pointerEvents = "none";
      const a = c.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.6)" }], {
        duration: MICRO(),
        delay: i * stagger,
        easing: EASE_EXIT,
        fill: "forwards",
      });
      a.onfinish = () => {
        if (--left) return;
        flip(chips, () => list.forEach((n) => n.remove()), UI());
      };
    });
  };

  const addTags = () => {
    const off = new Set(rule.remove.map(keyOf));
    const typed = splitTags(input.value);
    const have = new Set([...info.base, ...rule.add].map(keyOf));
    const guard = new Set((view.guard || []).map(keyOf));
    const fresh = typed.filter((t) => !have.has(keyOf(t)) && !guard.has(keyOf(t)));
    // 打的是被劃掉的預設字：當成恢復它。
    const back = typed.map(keyOf).filter((k) => off.has(k));
    const blocked = typed.filter((t) => guard.has(keyOf(t)));
    input.value = "";
    if (!fresh.length && !back.length) {
      if (typed.length) {
        play(input, [{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], { duration: UI(), easing: "ease-out" });
        say("error", blocked.length ? "防未成年的字本來就一定會加上。" : "這些字已經在裡面了。");
      }
      return;
    }
    rule.add = [...rule.add, ...fresh];
    rule.remove = rule.remove.filter((r) => !back.includes(keyOf(r)));
    syncReset();
    store();
    for (const c of chips.querySelectorAll(".neg-chip[aria-pressed]")) {
      if (back.includes(c.dataset.tag)) {
        c._sync();
        play(c, [{ transform: "scale(1.12)" }, { transform: "none" }], { duration: POP(), easing: SPRING });
      }
    }
    const made = fresh.map(addedFor);
    flip(chips, () => chips.append(...made), UI());
    made.forEach((c, i) =>
      play(c, [{ opacity: 0, transform: "translateY(6px) scale(0.6)" }, { opacity: 1, transform: "none" }], {
        duration: POP(),
        delay: i * 45,
        easing: SPRING,
      })
    );
    input.classList.remove("is-sent");
    void input.offsetWidth;
    input.classList.add("is-sent");
  };

  const editStage = () => {
    chips = el("div", "neg-chips");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "預設的負面詞：點一下劃掉，再點一下恢復");
    chips.append(...info.base.map(chipFor), ...rule.add.map(addedFor));
    input = el("input", "neg-add");
    input.type = "text";
    input.enterKeyHint = "done";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "加字後按 Enter，逗號隔開可加多個";
    input.setAttribute("aria-label", "加負面詞");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        addTags();
      }
    });
    input.addEventListener("change", () => input.value.trim() && addTags());
    input.addEventListener("animationend", () => input.classList.remove("is-sent"));
    return [chips, input];
  };

  const replaceStage = () => {
    chips = null;
    input = null;
    const area = el("textarea", "neg-text");
    area.rows = 4;
    area.spellcheck = false;
    area.value = rule.text;
    area.setAttribute("aria-label", "整串負面詞");
    area.placeholder = "用逗號分開，例如 worst quality, bad hands";
    area.addEventListener("input", () => {
      clearTimeout(textTimer);
      rule.text = area.value;
      say("typing", "");
      textTimer = setTimeout(() => {
        syncReset();
        store();
      }, 500);
    });
    return [area];
  };

  /** 換寫法、換份：舊的淡出 → 框的高度變形 → 新的浮上來。 */
  const morph = (animate) => {
    const next = rule.mode === "replace" ? replaceStage() : editStage();
    if (!animate || reduce() || !stage.isConnected || !stage.childElementCount) {
      stage.replaceChildren(...next);
      return;
    }
    // 交叉淡化：舊的整塊收進一層疊在上面的殘影（不佔位置）一邊淡出，新的同時放進來一邊浮上來，框的高度從舊的變形成新的。
    const h0 = stage.offsetHeight;
    for (const g of stage.querySelectorAll(":scope > .neg-stage-ghost")) g.remove();
    const ghost = el("div", "neg-stage-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    ghost.append(...stage.children);
    stage.append(ghost, ...next);
    const h1 = stage.offsetHeight;
    ghost.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(-6px)" }], { duration: UI(), easing: EASE_EXIT, fill: "forwards" }).onfinish = () => ghost.remove();
    if (Math.abs(h1 - h0) > 1) stage.animate([{ height: h0 + "px" }, { height: h1 + "px" }], { duration: POP() * 1.2, easing: EASE_OUT });
    next.forEach((n, i) =>
      play(n, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: POP(), delay: MICRO() * 0.5 + i * 50, easing: EASE_OUT })
    );
  };

  /* ---------- 一定會加上的字 ---------- */

  const fillLock = () => {
    lock.replaceChildren();
    const sum = el("summary", null, "一定會加上、不能拿掉的字");
    const guard = el("p", null);
    guard.append(el("span", null, "防未成年："));
    const g = el("code", null, (view.guard || []).join(", "));
    g.dataset.noI18n = "";
    guard.append(g);
    lock.append(sum, guard);
    for (const [r, label] of [["general", "選全年齡時另外補："], ["sensitive", "選敏感時另外補："]]) {
      const words = info.rating?.[r] || [];
      if (!words.length) continue;
      const p = el("p", null);
      p.append(el("span", null, label));
      const c = el("code", null, words.join(", "));
      c.dataset.noI18n = "";
      p.append(c);
      lock.append(p);
    }
  };
  lock.addEventListener("toggle", () => {
    if (!lock.open) return;
    [...lock.querySelectorAll(":scope > p")].forEach((p, i) =>
      play(p, [{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: UI(), delay: i * 50, easing: EASE_OUT })
    );
  });

  /* ---------- 組起來 ---------- */

  const syncReset = () => {
    reset.disabled = !changed();
  };

  const readRule = () => {
    const mine = view.rules[scope]?.[key];
    const famRule = view.rules.families?.[family];
    own = !!mine;
    const src = mine || famRule || {};
    rule = { ...blank(), ...src, add: [...(src.add || [])], remove: [...(src.remove || [])] };
  };

  const pickScope = (v) => {
    const famRule = view.rules.families?.[family];
    const before = JSON.stringify([rule.mode, rule.add, rule.remove, rule.text]);
    own = v === "own";
    scopeSeg.set(v);
    if (own) {
      // 自己一份從家族現在的樣子開始。
      saveRule(scope, key, { ...blank(), ...(famRule || {}) });
    } else {
      saveRule(scope, key, null);
      const src = famRule || {};
      rule = { ...blank(), ...src, add: [...(src.add || [])], remove: [...(src.remove || [])] };
    }
    say("saving", "儲存中…");
    const mine = ++saving;
    writes.then((j) => {
      if (!box.isConnected || mine !== saving) return;
      if (j?.ok) say("saved", "已存，下一張就用這串。");
      else {
        say("error", j?.error || "存不起來");
        load(true).then(() => box.isConnected && build());
      }
    });
    setNote();
    modeSeg.set(rule.mode);
    syncReset();
    if (JSON.stringify([rule.mode, rule.add, rule.remove, rule.text]) !== before) morph(true);
  };

  const pickMode = (mode) => {
    rule.mode = mode;
    if (mode === "replace" && !rule.text) {
      const off = new Set(rule.remove.map(keyOf));
      rule.text = [...info.base.filter((t) => !off.has(keyOf(t))), ...rule.add].join(", ");
    }
    modeSeg.set(mode);
    syncReset();
    store();
    morph(true);
  };

  reset.addEventListener("click", () => {
    const wasEdit = rule.mode === "edit";
    rule = blank();
    syncReset();
    // 自己一份恢復成墨池的原始預設（照樣是自己一份）；家族的就是刪掉。
    store();
    modeSeg.set("edit");
    if (!wasEdit || !chips) {
      morph(true);
      return;
    }
    // 一波一波復原：劃掉的依序亮回來，加的依序縮掉。
    const struck = [...chips.querySelectorAll('.neg-chip[aria-pressed="false"]')];
    struck.forEach((c, i) => (reduce() ? c._sync() : setTimeout(() => c._sync(), i * 28)));
    dropChips([...chips.querySelectorAll(".neg-chip.is-added")], reduce() ? 0 : 30);
    (chips.querySelector(".neg-chip") || reset).focus?.({ preventScroll: true });
  });

  const build = () => {
    box.replaceChildren(sweep, head);
    if (!view) {
      reset.disabled = true;
      box.append(el("p", "fam-samp-note", "讀取中…"));
      return;
    }
    info = view.families[family] || view.families.illustrious;
    readRule();
    const ownText = scope === "workflows" ? "這套工作流程自己一份" : "這顆底模自己一份";
    scopeSeg = segmented("要用哪一份", [["family", `跟著 ${famName} 家族`], ["own", ownText]], own ? "own" : "family", pickScope);
    modeSeg = segmented("怎麼改", [["edit", "在預設上加減"], ["replace", "整串自己寫"]], rule.mode, pickMode);
    note.textContent = noteText();
    stage.replaceChildren();
    morph(false);
    fillLock();
    syncReset();
    box.append(scopeSeg.box, note, modeSeg.box, stage, lock, status);
  };

  build();
  if (!view) load().then(() => box.isConnected && !box.contains(document.activeElement) && build());
  return box;
}

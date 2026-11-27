/**
 * 牌組：取名存起來的一組牌。存在伺服器（/api/decks，card_decks.py），手機、電腦共用一份。
 * 只存牌，不存規則：套用時尺度、時代、人物照當下的設定。
 *
 * 墨池（合成池、偏好卡牌）、疊印台（卡池）、卡冊（偏好卡牌）共用同一張「牌組」面板（openDecks）：
 * 上面一列把「目前的牌」取名存起來，底下是存過的牌組，一組一列：套用、刪除（可復原）。
 */
import { el, openSheet, toast, friendlyError } from "./ui.js";
import { enter, leave, refuse, reducedMotion, DUR, CURVE, css } from "./motion.js";
import { handOffCustom, isCustomTag } from "./custom-cards.js";

const MAX_TAGS = 60; // 跟 card_decks.py 一樣。

let cache = null;
let revision = 0;
let loadRequest = 0;
let writeQueue = Promise.resolve();

export async function loadDecks({ strict = false } = {}) {
  const request = ++loadRequest, startedAt = revision;
  try {
    const r = await fetch("/api/decks", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const decks = (await r.json()).decks || [];
    // 較晚開始的讀取，或已完成的增刪，才代表目前的牌組。
    if (request === loadRequest && startedAt === revision) cache = decks;
  } catch (err) {
    if (strict) throw err;
    return cache;
  }
  return cache;
}

/** 上一次讀到的牌組（還沒讀過是 null）：要立刻畫出來的地方先用它，再背景更新。 */
export const cachedDecks = () => cache;

function call(url, method, body) {
  // 伺服器每次回完整清單。把增刪（含復原）依序送出，回應與實際寫入順序才一致。
  const pending = writeQueue.then(() => requestWrite(url, method, body));
  writeQueue = pending.catch(() => {}); // 一筆失敗不能卡住後面的重試／其他牌組。
  return pending;
}

async function requestWrite(url, method, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) {
    throw Object.assign(new Error(j.error || `伺服器回 ${r.status}`), { status: r.status, bad: j.bad });
  }
  revision++;
  cache = j.decks || cache;
  return j.deck;
}

export const saveDeck = (deck) => call("/api/decks", "POST", deck);
export const deleteDeck = (id) => call(`/api/decks/${encodeURIComponent(id)}`, "DELETE");

/** 預設名撞到已經有的牌組：接「（2）」「（3）」…，不要蓋掉那一組。 */
export function freeName(base, decks) {
  const used = new Set(decks.map((d) => d.name));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = `（${i}）`;
    const name = base.slice(0, 40 - suffix.length) + suffix;
    if (!used.has(name)) return name;
  }
}

/** 沒取名時的預設名字：前三張牌的中文名。 */
export function suggestName(tags, zh) {
  const names = tags.slice(0, 3).map(zh);
  return names.join("・") + (tags.length > 3 ? "…" : "");
}

/**
 * 打開牌組面板。
 *   where：「合成池」「卡池」「偏好卡牌」—— 面板上的字跟著換。
 *   current()：目前的牌（存成牌組用）；空的時候只能套用。
 *   has(tag)：這張牌現在還在詞庫裡（詞庫改過，舊牌組裡可能有已經拿掉的字）。
 *   zh(tag)：牌的中文名。
 *   apply(deck)：套用一組。面板先收起來再呼叫，套用的動畫才看得到。
 *   paste()：「貼上提示詞變成牌」（paste-prompt.js）；有給才出現那一顆。
 *   weightsNow()：目前調過的份量（weights.js），存牌組時一起存；偏好卡牌沒有份量就不給。
 */
export function openDecks({ where, current, has, zh, apply, paste, weightsNow = () => ({}) }) {
  const now = [...new Set(current())];
  const canSave = (tag) => !isCustomTag(tag) && has(tag);
  const tagNames = (tags) => tags.map((t) => zh(t) || t).join("、");
  const validation = el("div", { "aria-live": "polite" });
  // 存之前先講清楚：自製牌（和詞庫沒有的）不會存進牌組 —— 照樣存其他的，但畫面上寫明哪幾張不存
  //（以前默默丟掉，畫面說存了兩張、其實只存一張）。超過上限才擋下來，由你決定拿掉哪幾張。
  // 回傳要存的牌；擋下來回 null。
  const validate = (tags) => {
    const bad = tags.filter((t) => !canSave(t));
    const keep = tags.filter(canSave);
    const notes = [];
    if (bad.length) notes.push(`這幾張不會存進牌組（自製牌請到卡冊另存成自製牌）：${tagNames(bad)}。`);
    if (keep.length > MAX_TAGS) notes.push(`牌組最多 ${MAX_TAGS} 張，目前有 ${keep.length} 張，請先移除 ${keep.length - MAX_TAGS} 張。`);
    if (!keep.length) notes.push(tags.length ? "沒有可以存進牌組的牌（都是自製牌或詞庫沒有的）。" : `${where}是空的：先放幾張牌，就能存成一組。`);
    const before = validation.textContent;
    validation.replaceChildren(...notes.map((note) => el("p", { class: "deck-note" }, note)));
    if (validation.textContent !== before && notes.length && !reducedMotion()) validation.animate([{ opacity: 0, transform: "translateY(-3px)" }, { opacity: 1, transform: "none" }], { duration: DUR.short, easing: css(CURVE.out) });
    return keep.length && keep.length <= MAX_TAGS ? keep : null;
  };
  validate(now);
  const list = el("div", { class: "deck-list", "aria-live": "polite" }, el("p", { class: "deck-note" }, "讀取牌組…"));
  const name = el("input", {
    class: "deck-name",
    type: "text",
    maxlength: "40",
    placeholder: "幫這組牌取個名字",
    "aria-label": "牌組名字",
    value: now.length ? suggestName(now, zh) : "",
  });
  const saveBtn = el("button", { class: "btn btn-primary deck-save-btn", type: "submit" }, "");
  const conflictMsg = el("p", { class: "deck-note", role: "status" });
  const reloadBtn = el("button", { class: "btn btn-small", type: "button", onclick: reload }, "重新載入");
  const copyBtn = el("button", { class: "btn btn-small btn-primary", type: "button", onclick: () => submit(true) }, "另存一組");
  const conflictBox = el("div", { hidden: true }, conflictMsg, reloadBtn, copyBtn);
  const form = now.length
    ? el(
        "form",
        { class: "deck-save" },
        el("p", { class: "deck-save-lead" }, `把${where}裡的 ${now.filter(canSave).length} 張存成牌組（整組的快照，套用時換成這組）：`),
        validation,
        el("div", { class: "deck-save-row" }, name, saveBtn),
        conflictBox,
        // 想要能調權重、加詞庫沒有的字、一張牌帶著走的：直接到卡冊做成自製牌（名字、份量一起帶過去）。
        el(
          "button",
          {
            class: "link-btn deck-to-custom pressable",
            type: "button",
            onclick: () => {
              close();
              const w = weightsNow();
              const tags = now.filter(canSave);
              handOffCustom({ name: (name.value.trim() || suggestName(tags, zh)).slice(0, 24), rating: "general", members: tags.map((t) => ({ tag: t, w: w[t] || 1 })), extra: [] }) || toast("無法交接，請檢查瀏覽器儲存空間。");
            },
          },
          "或做成一張自製牌（可以調權重、加詞庫沒有的字）"
        )
      )
    : el("p", { class: "deck-note deck-save-empty" }, `${where}是空的：先放幾張牌，就能存成一組。`);
  let decks = cache || [];
  // 開面板時已看到的同名牌組，要用當時的版本存；即使背景讀到更新也要先問。
  const draftTargets = new Map(decks.map((d) => [d.name, d]));
  let saving = false;
  let conflict = null;
  const deleting = new Set();
  let initialLoad;
  // 名字跟存過的一樣：按下去是更新那一組（按鈕上寫清楚），不會多出兩組同名的。
  const same = () => draftTargets.get(name.value.trim()) || decks.find((d) => d.name === name.value.trim());
  const label = () => {
    saveBtn.textContent = same() ? "更新同名牌組" : "存成牌組";
  };
  name.addEventListener("input", label);
  label();

  const pasteBtn = paste
    ? el(
        "button",
        {
          class: "btn btn-small decks-paste pressable",
          type: "button",
          onclick: () => {
            close();
            setTimeout(paste, DUR.short);
          },
        },
        "貼上提示詞變成牌…"
      )
    : null;
  const { close } = openSheet("牌組", el("div", { class: "decks" }, el("p", { class: "workspace-purpose" }, "牌組保存整組選牌與權重，之後可以重新套用；偏好卡牌則是每個工作區常用的單張牌。"), pasteBtn, form, list));

  const row = (d) => {
    const tags = d.tags.filter(has);
    const gone = d.tags.length - tags.length;
    const node = el(
      "div",
      { class: "deck-row", dataset: { id: d.id } },
      el(
        "div",
        { class: "deck-main" },
        el("b", { class: "deck-title", dataset: { noI18n: "" } }, d.name),
        el("span", { class: "deck-meta" }, `${tags.length} 張${gone ? `（${gone} 張詞庫裡已經沒有）` : ""}`),
        el("span", { class: "deck-tags" }, tags.slice(0, 8).map((t) => zh(t) + (d.weights?.[t] ? ` ${d.weights[t]}` : "")).join("・") + (tags.length > 8 ? "…" : ""))
      ),
      el(
        "div",
        { class: "deck-acts" },
        el(
          "button",
          {
            class: "btn btn-small btn-primary pressable",
            type: "button",
            disabled: !tags.length || undefined,
            onclick: () => {
              close();
              // 面板收起來（170ms）之後才套用：牌飛進去的那一段要看得到。
              setTimeout(() => apply({ ...d, tags }), DUR.short);
            },
          },
          "套用"
        ),
        // 自製牌（卡冊）：這組牌連份量帶到「新增自製牌」，分級照裡面的牌自己往上調。
        el(
          "button",
          {
            class: "link-btn pressable",
            type: "button",
            disabled: !tags.length || undefined,
            title: "把這組牌包成一張自製牌（到卡冊編輯）",
            onclick: () => {
              close();
              handOffCustom({ name: d.name.slice(0, 24), rating: "general", members: tags.map((t) => ({ tag: t, w: d.weights?.[t] || 1 })), extra: [] }) || toast("無法交接，請檢查瀏覽器儲存空間。");
            },
          },
          "存成自製牌"
        ),
        el(
          "button",
          {
            class: "deck-del link-btn pressable",
            type: "button",
            disabled: deleting.has(d.id) || undefined,
            "aria-label": `刪掉牌組「${d.name}」`,
            onclick: (e) => remove(d, node, e.currentTarget),
          },
          "刪除"
        )
      )
    );
    return node;
  };

  const paint = () => {
    list.replaceChildren(
      ...(decks.length
        ? decks.map(row)
        : [el("p", { class: "deck-note" }, `還沒有牌組。把常用的一組牌存起來，下次在墨池、疊印台一點就放回來。`)])
    );
  };

  const remove = async (d, node, btn) => {
    if (deleting.has(d.id)) return;
    deleting.add(d.id);
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    let gone;
    try {
      gone = await deleteDeck(d.id);
    } catch (err) {
      deleting.delete(d.id);
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
      refuse(btn);
      return toast(`刪不掉：${friendlyError(err)}`);
    }
    btn.removeAttribute("aria-busy");
    decks = cache || decks.filter((x) => x.id !== d.id);
    for (const [n, target] of draftTargets) {
      if (target.id === d.id) draftTargets.delete(n);
    }
    leave(node, () => {
      deleting.delete(d.id);
      paint();
      label();
    });
    toast(`刪掉了牌組「${d.name}」`, {
      action: {
        label: "復原",
        run: async () => {
          try {
            const restored = await saveDeck({ ...gone, restore: true });
            draftTargets.set(restored.name, restored);
            decks = cache || decks;
            if (list.isConnected) {
              paint();
              label();
            }
          } catch (err) {
            toast(`復原不了：${friendlyError(err)}`);
          }
        },
      },
    });
  };

  function setBusy(active) {
    saving = active;
    saveBtn.disabled = active || !!conflict;
    reloadBtn.disabled = copyBtn.disabled = active;
    if (active) saveBtn.setAttribute("aria-busy", "true");
    else saveBtn.removeAttribute("aria-busy");
  }

  function clearConflict() {
    conflict = null;
    conflictBox.hidden = true;
  }

  async function refresh() {
    try {
      return await loadDecks({ strict: true });
    } catch {
      toast("讀不到牌組：伺服器沒開，或連不到主機。");
      return null;
    }
  }

  async function reload() {
    if (!conflict || saving) return;
    setBusy(true);
    try {
      const latest = await refresh();
      if (latest === null) return;
      decks = latest;
      draftTargets.clear();
      clearConflict();
      paint();
      label();
      name.focus();
    } finally {
      setBusy(false);
    }
  }

  async function submit(asCopy = false) {
    if (saving || (asCopy ? !conflict : !!conflict)) return;
    const tags = validate(asCopy ? conflict.tags : [...new Set(current())]);
    if (!tags) return refuse(saveBtn);
    const typed = name.value.trim();
    const w = weightsNow();
    const weights = asCopy ? conflict.weights : Object.fromEntries(tags.filter((t) => w[t] && w[t] !== 1).map((t) => [t, w[t]]));
    // 核對面板按下當時看到的版本；不能把背景讀取的新版本配上這份較早的草稿。
    const target = !asCopy && typed ? same() : null;
    setBusy(true);
    try {
      const needsRefresh = asCopy || (!target && (await initialLoad) === null);
      const available = needsRefresh ? await refresh() : decks;
      if (available === null) return;
      const hit = target || (!asCopy && typed ? available.find((d) => d.name === typed) : null);
      const base = (typed || suggestName(tags, zh)).slice(0, 40);
      const n = asCopy || !typed ? freeName(base, available) : base;
      const deck = await saveDeck({ ...(hit ? { id: hit.id, updatedAt: hit.updatedAt ?? 0 } : {}), name: n, tags, weights });
      clearConflict();
      draftTargets.set(deck.name, deck);
      decks = cache || decks;
      paint();
      const fresh = list.querySelector(`.deck-row[data-id="${deck.id}"]`);
      if (fresh && !reducedMotion()) {
        enter(fresh);
        fresh.animate([{ backgroundColor: "var(--color-pool-soft)" }, { backgroundColor: "transparent" }], {
          duration: DUR.story,
          easing: css(CURVE.out),
        });
      }
      // 按鈕上說一聲，一下子之後換回該有的字（名字沒改的話，現在是「更新同名牌組」）。
      saveBtn.textContent = hit ? "更新了 ✓" : "存好了 ✓";
      setTimeout(label, 1400);
    } catch (err) {
      if (err.status === 409) {
        conflict = { tags, weights };
        conflictMsg.textContent = err.message;
        conflictBox.hidden = false;
      } else {
        refuse(asCopy ? copyBtn : saveBtn);
        toast(`存不了：${friendlyError(err)}`);
        if (err.bad?.length) {
          validation.replaceChildren(el("p", { class: "deck-note" }, `牌組不能存這些牌：${tagNames(err.bad)}。`));
        }
      }
    } finally {
      setBusy(false);
      if (conflict && !asCopy) reloadBtn.focus();
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    submit();
  });

  // 讀過就先畫上次的（馬上看得到），沒讀過就留著「讀取牌組…」，不先閃一句「還沒有牌組」。
  if (cache) paint();
  initialLoad = loadDecks({ strict: true }).then((fresh) => {
    if (!list.isConnected) return fresh;
    if (fresh === null) {
      list.replaceChildren(el("p", { class: "deck-note" }, "讀不到牌組：伺服器沒開，或連不到主機。"));
      return null;
    }
    decks = fresh;
    paint();
    label();
    return fresh;
  }).catch(() => {
    if (list.isConnected && cache === null) list.replaceChildren(el("p", { class: "deck-note" }, "讀不到牌組：伺服器沒開，或連不到主機。"));
    return null;
  });
  if (now.length) requestAnimationFrame(() => name.select());
}

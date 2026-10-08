/**
 * 牌組：取名存起來的一組牌。存在伺服器（/api/decks，card_decks.py），手機、電腦共用一份。
 * 只存牌，不存規則：套用時尺度、時代、人物照當下的設定。
 *
 * 墨池（合成池）、疊印台（卡池）、卡冊（卡盒）共用同一張「牌組」面板（openDecks）：
 * 上面一列把「目前的牌」取名存起來，底下是存過的牌組，一組一列：套用、刪除（可復原）。
 */
import { el, openSheet, toast } from "./ui.js";
import { enter, leave, refuse, reducedMotion, DUR, CURVE, css } from "./motion.js";

let cache = null;

export async function loadDecks() {
  try {
    const r = await fetch("/api/decks", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    cache = (await r.json()).decks || [];
  } catch {
    return cache;
  }
  return cache;
}

/** 上一次讀到的牌組（還沒讀過是 null）：要立刻畫出來的地方先用它，再背景更新。 */
export const cachedDecks = () => cache;

async function call(url, method, body) {
  const r = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `伺服器回 ${r.status}`);
  cache = j.decks || cache;
  return j.deck;
}

export const saveDeck = (deck) => call("/api/decks", "POST", deck);
export const deleteDeck = (id) => call(`/api/decks/${encodeURIComponent(id)}`, "DELETE");

/** 沒取名時的預設名字：前三張牌的中文名。 */
export function suggestName(tags, zh) {
  const names = tags.slice(0, 3).map(zh);
  return names.join("・") + (tags.length > 3 ? "…" : "");
}

/**
 * 打開牌組面板。
 *   where：「合成池」「卡池」「卡盒」—— 面板上的字跟著換。
 *   current()：目前的牌（存成牌組用）；空的時候只能套用。
 *   has(tag)：這張牌現在還在詞庫裡（詞庫改過，舊牌組裡可能有已經拿掉的字）。
 *   zh(tag)：牌的中文名。
 *   apply(deck)：套用一組。面板先收起來再呼叫，套用的動畫才看得到。
 *   paste()：「貼上提示詞變成牌」（paste-prompt.js）；有給才出現那一顆。
 *   weightsNow()：目前調過的份量（weights.js），存牌組時一起存；卡盒沒有份量就不給。
 */
export function openDecks({ where, current, has, zh, apply, paste, weightsNow = () => ({}) }) {
  const now = current().filter(has);
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
  const form = now.length
    ? el(
        "form",
        { class: "deck-save" },
        el("p", { class: "deck-save-lead" }, `把${where}裡的 ${now.length} 張存成一組：`),
        el("div", { class: "deck-save-row" }, name, saveBtn)
      )
    : el("p", { class: "deck-note deck-save-empty" }, `${where}是空的：先放幾張牌，就能存成一組。`);
  let decks = cache || [];
  // 名字跟存過的一樣：按下去是更新那一組（按鈕上寫清楚），不會多出兩組同名的。
  const same = () => decks.find((d) => d.name === name.value.trim());
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
  const { close } = openSheet("牌組", el("div", { class: "decks" }, pasteBtn, form, list));

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
        el(
          "button",
          {
            class: "deck-del link-btn pressable",
            type: "button",
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
    try {
      await deleteDeck(d.id);
    } catch (err) {
      refuse(btn);
      return toast(`刪不掉：${err.message}`);
    }
    decks = cache || decks.filter((x) => x.id !== d.id);
    leave(node, () => {
      paint();
      label();
    });
    toast(`刪掉了牌組「${d.name}」`, {
      action: {
        label: "復原",
        run: async () => {
          try {
            await saveDeck(d);
            decks = cache || decks;
            if (list.isConnected) {
              paint();
              label();
            }
          } catch (err) {
            toast(`復原不了：${err.message}`);
          }
        },
      },
    });
  };

  form.addEventListener?.("submit", async (e) => {
    e.preventDefault();
    const tags = current().filter(has);
    const n = name.value.trim() || suggestName(tags, zh);
    const hit = decks.find((d) => d.name === n);
    saveBtn.disabled = true;
    try {
      const w = weightsNow();
      const weights = Object.fromEntries(tags.filter((t) => w[t] && w[t] !== 1).map((t) => [t, w[t]]));
      const deck = await saveDeck({ id: hit?.id, name: n, tags, weights });
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
      refuse(saveBtn);
      toast(`存不了：${err.message}`);
    } finally {
      saveBtn.disabled = false;
    }
  });

  // 讀過就先畫上次的（馬上看得到），沒讀過就留著「讀取牌組…」，不先閃一句「還沒有牌組」。
  if (cache) paint();
  loadDecks().then((fresh) => {
    if (!list.isConnected) return;
    if (fresh === null) {
      list.replaceChildren(el("p", { class: "deck-note" }, "讀不到牌組：伺服器沒開，或連不到主機。"));
      return;
    }
    decks = fresh;
    paint();
    label();
  });
  if (now.length) requestAnimationFrame(() => name.select());
}

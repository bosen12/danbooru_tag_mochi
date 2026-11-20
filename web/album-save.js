/**
 * 收進作品冊（album.html）：一張成品（墨池的成品、疊印台的作品）存到伺服器（recipes.py），
 * 圖從 ComfyUI 的輸出複製一份到 data/recipes/files —— 之後 ComfyUI 那邊把原圖刪了，作品冊裡那張還在。
 * 成品上記著 albumId，按鈕就顯示「已收藏」。
 */
import { el, toast, friendlyError } from "./ui.js";
import { refuse, reducedMotion, DUR, CURVE, css } from "./motion.js";
import { english } from "./i18n.js";

/** 這張收得了嗎：印好了、圖是 ComfyUI 輸出的那一張。 */
export function canSave(item) {
  return !!item && item.status === "done" && typeof item.image === "string" && item.image.includes("/api/image?");
}

function imageRef(src) {
  const u = new URL(src, location.href);
  // h＝內容指紋：伺服器拿到的圖要跟畫面上這張一樣才收（檔名可能已經被別張圖用掉）。
  return { filename: u.searchParams.get("filename") || "", subfolder: u.searchParams.get("subfolder") || "", type: u.searchParams.get("type") || "output", h: u.searchParams.get("h") || "" };
}

async function call(url, method, body) {
  const r = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  // 帶著 HTTP 狀態：呼叫的人要分得出「已經不在了」（404）和其他錯誤。
  if (!r.ok || !j.ok) throw Object.assign(new Error(j.error || `伺服器回 ${r.status}`), { status: r.status });
  return j;
}

/** 作品的名字：你放的牌（沒有就抽到的前幾張）的中文名。 */
export function workName(item, zh) {
  const tags = (item.mine && item.mine.length ? item.mine : (item.drawn || []).map((d) => d.tag || d)).slice(0, 3);
  return tags.length ? tags.map((tag) => english ? tag : zh(tag)).join(english ? " · " : "・") + ((item.mine || []).length > 3 ? "…" : "") : `seed ${item.seed}`;
}

/**
 * 存進作品冊，回傳伺服器上的那一筆。圖片複製不成就把剛建的那筆刪掉（沒有圖的作品沒有意義）。
 * 斷線時（手機走 Tailscale 常見）圖可能其實存好了、只是回應沒回來，刪也刪不掉：記著那一筆（item._albumPending），
 * 再按一次先看它 —— 圖在就算收好了，沒圖就接著補圖。以前每按一次發一個新編號，作品冊裡多出一件一模一樣的。
 */
export async function saveToAlbum(item, name) {
  const s = item.sampling || {};
  let id = null;
  if (item._albumPending) {
    const had = await fetch(`/api/recipes/${encodeURIComponent(item._albumPending)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (had?.recipe?.image?.file) {
      item._albumPending = null;
      return had.recipe;
    }
    if (had?.recipe) id = had.recipe.id;
    else item._albumPending = null;
  }
  if (!id) id = (await createRecipe(item, name, s)).id;
  item._albumPending = id;
  try {
    const j = await call(`/api/recipes/${encodeURIComponent(id)}/image`, "POST", imageRef(item.image));
    item._albumPending = null;
    return j.recipe;
  } catch (err) {
    await call(`/api/recipes/${encodeURIComponent(id)}`, "DELETE").then(() => (item._albumPending = null), () => {});
    throw new Error(`圖存不下來：${friendlyError(err)}`);
  }
}

async function createRecipe(item, name, s) {
  const { recipe } = await call("/api/recipes", "POST", {
    // 編號自己給、不重複：伺服器照名字轉的編號，中文名常常只剩幾個數字（「1個女性」→ 1），
    // 刪掉之後下一件可能又拿到同一個，舊成品上的「已收藏」就會指到別張。
    id: `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    positive: item.positive || "",
    seed: item.seed,
    width: (item.hires && item.hires.width) || item.width,
    height: (item.hires && item.hires.height) || item.height,
    checkpoint: item.ckpt || "",
    loras: item.loras || [],
    workflowId: item.workflowId || "",
    steps: s.steps,
    cfg: s.cfg,
    rating: item.rating,
    heats: item.heat ? [item.heat] : [],
    era: item.era || "",
    pinned: item.mine || [],
  });
  return recipe;
}

export const removeFromAlbum = (id) => call(`/api/recipes/${encodeURIComponent(id)}`, "DELETE");

/**
 * 成品上的收藏鈕（墨池的成品、疊印台的作品詳情共用）。
 *   persist()：記著 albumId 的那份清單存回去（重新整理之後還是「已收藏」）。
 * 已收藏的再按：先問伺服器那筆還在不在（可能在作品冊刪掉了），不在就重新收一次。
 */
export function favButton(item, { zh, persist, className = "btn btn-small btn-ghost" }) {
  const b = el("button", { class: `${className} fav-btn pressable`, type: "button" });
  const open = () => (location.href = `album.html#${encodeURIComponent(item.albumId)}`);
  const paint = () => {
    const on = !!item.albumId;
    b.textContent = on ? "★ 已收藏" : "☆ 收藏";
    b.dataset.on = on ? "true" : "false";
    b.hidden = !on && !canSave(item);
    b.title = on ? "已經在作品冊裡（點一下打開）" : "收進作品冊：存一份圖，ComfyUI 那邊的原圖刪了也還在";
  };
  b._paint = paint;
  b.addEventListener("click", async () => {
    if (b.disabled) return;
    // 從詢問開始就鎖住。502 的空檔連點一次，就會再送一筆新作品。
    b.disabled = true;
    b.setAttribute("aria-busy", "true");
    const unlock = () => {
      b.disabled = false;
      b.removeAttribute("aria-busy");
    };
    try {
      if (item.albumId) {
        // 只有明確 404（作品冊裡那筆已經沒了）才清掉編號重收。5xx、斷線留著星號，避免再存一件一樣的。
        let status = 0;
        try {
          const r = await fetch(`/api/recipes/${encodeURIComponent(item.albumId)}`, { cache: "no-store" });
          status = r.status;
          r.body?.cancel().catch(() => {});
        } catch {
          status = 0;
        }
        if (status !== 404) {
          if (status >= 200 && status < 300) toast("這張已經在作品冊裡", { action: { label: "打開作品冊", run: open } });
          else {
            refuse(b);
            toast("暫時無法確認收藏，請再試一次");
          }
          return;
        }
        item.albumId = null;
        persist();
        paint();
      }
      // 原圖已經被清掉（output 只留最近的圖）：按了也存不到，先說為什麼。
      if (item._goneSrc || item._gone) {
        toast("原圖已經不在 ComfyUI 的 output 了：收不進作品冊");
        return refuse(b);
      }
      if (!canSave(item)) return refuse(b);
      b.textContent = "收藏中…";
      const rec = await saveToAlbum(item, workName(item, zh));
      item.albumId = rec.id;
      persist();
      paint();
      if (!reducedMotion()) b.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: DUR.medium, easing: css(CURVE.settle) });
      toast("收進作品冊了", { action: { label: "打開作品冊", run: open } });
    } catch (err) {
      paint();
      refuse(b);
      toast(`收不進去：${friendlyError(err)}`);
    } finally {
      unlock();
    }
  });
  paint();
  return b;
}

/**
 * 姿勢參考（墨池、疊印台的規則裡）：挑一張圖，人物照它的姿勢擺；臉、衣服、場景還是照牌。
 *   - 來源：上傳一張（照片、截圖都行）、最近印的、作品冊的，或在姿勢編輯器裡自己擺（pose-editor.js）。
 *     自己擺的本身就是骨架圖：送印時帶 skeleton，伺服器不再抓一次。
 *   - 圖先在這裡縮到 1024 以內，POST /api/pose/upload 傳進 ComfyUI（server.py 的姿勢參考那段），
 *     再 POST /api/pose/preview 只跑一次骨架偵測，給人看抓到的姿勢對不對。
 *   - 強度三檔：輕（只帶個大概）、中、強（照著擺，預設；跟專案主試好的工作流一樣 strength 1）。
 *     骨架用 AIO Aux Preprocessor 的 OpenposePreprocessor（不用 DWPose）。
 *   - 選了就記在這個瀏覽器（POSE_KEY），兩個房間共用，跟 LoRA、底模一樣是「之後印的都套用」；
 *     每張成品記下自己用的那一份（重印照舊）。
 *   - 只套在內建工作流：選了自訂工作流就不套（按鈕上會寫）。
 */
import { el, openSheet } from "./ui.js";
import { refuse, seat, reducedMotion, enter, DUR } from "./motion.js";
import { openPoseEditor } from "./pose-editor.js";

const POSE_KEY = "mochi.pose.v1";
const MAX_SIDE = 1024;
// 「強」＝專案主試好的那一份（strength 1、跟到最後），也是預設。
export const POSE_LEVELS = [
  [0.6, "輕"],
  [0.8, "中"],
  [1, "強"],
];
const DEFAULT_LEVEL = 1;
const NAME_RE = /^danbooru_pose\/pose_[0-9a-f]{16}\.(png|jpg|webp)$/;

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(POSE_KEY) || "null");
    return v && NAME_RE.test(v.name || "") ? v : null;
  } catch {
    return null;
  }
}

function write(v) {
  try {
    if (v) localStorage.setItem(POSE_KEY, JSON.stringify(v));
    else localStorage.removeItem(POSE_KEY);
  } catch {
    /* 存不了：這一次還是用得上 */
  }
}

let state = read();
const listeners = new Set();
function changed() {
  write(state);
  for (const f of listeners) f(state);
}

/** 換了（或拿掉）姿勢參考時通知：疊印台用它重畫付印鈕（換了姿勢就是另一張圖）。 */
export function onPoseChange(fn) {
  listeners.add(fn);
}

/** 送去印的那一份（每張成品記下來）。沒選回 null。 */
export function currentPose() {
  if (!state) return null;
  return { name: state.name, strength: state.strength, end: 1, ...(state.kind === "skeleton" ? { skeleton: true } : {}) };
}

const levelName = (s) => (POSE_LEVELS.find(([v]) => Math.abs(v - s) < 0.01) || POSE_LEVELS[2])[1];

/** 圖（網址或檔案）→ 縮到 MAX_SIDE 以內的 JPEG dataURL，外加一張給按鈕用的小縮圖。 */
async function shrink(source) {
  const blob = source instanceof Blob ? source : await fetch(source, { cache: "force-cache" }).then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`讀不到圖（${r.status}）`))));
  const bmp = await createImageBitmap(blob);
  const draw = (side, q) => {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * k));
    c.height = Math.max(1, Math.round(bmp.height * k));
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  };
  const out = { image: draw(MAX_SIDE, 0.92), thumb: draw(160, 0.8), ratio: bmp.width / bmp.height };
  bmp.close?.();
  return out;
}

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `伺服器回 ${r.status}`);
  return j;
}

/**
 * 規則裡那顆鈕：有選就是小縮圖＋「中」，沒選是「不用」。wf()：現在選的工作流（自訂的不套用）。
 * recent()：這個房間最近印好的 [{ src, full }]。
 */
export function poseButton({ recent = () => [], wf = () => "", rating = () => "general", size = () => ({ w: 1024, h: 1024 }) } = {}) {
  const b = el("button", { class: "btn btn-small pose-btn pressable", type: "button", "aria-haspopup": "dialog" });
  const paint = () => {
    // 規則重畫時舊的那顆被換掉了：不再跟著更新（也不留在 listeners 裡）。
    if (b._painted && !b.isConnected) return void listeners.delete(paint);
    b._painted = true;
    const custom = !!wf();
    b.replaceChildren(
      ...[
        state ? el("img", { class: "pose-btn-thumb", src: state.thumb, alt: "" }) : null,
        el("span", {}, state ? `${state.kind === "skeleton" ? "自己擺的" : "照這張"}・${levelName(state.strength)}` : "不用"),
        state && custom ? el("small", { class: "pose-btn-warn" }, "自訂工作流不套用") : null,
      ].filter(Boolean)
    );
    b.dataset.on = state ? "true" : "false";
    b.title = state ? "姿勢參考：人物照這張圖的姿勢擺（點一下換或拿掉）" : "姿勢參考：挑一張圖，人物照它的姿勢擺";
  };
  paint();
  listeners.add(paint);
  b.addEventListener("click", () => openPosePicker({ recent, rating, size }));
  return b;
}

export function openPosePicker({ recent = () => [], rating = () => "general", size = () => ({ w: 1024, h: 1024 }) } = {}) {
  let busy = false;
  const now = el("div", { class: "pose-now" });
  const levels = el("div", { class: "segmented", role: "radiogroup", "aria-label": "照著擺的強度" });
  const status = el("p", { class: "pose-status", role: "status", "aria-live": "polite" });

  function paintNow() {
    now.replaceChildren(
      state && state.kind === "skeleton"
        ? el("div", { class: "pose-pair" }, el("figure", {}, el("img", { src: state.thumb, alt: "你擺的姿勢" }), el("figcaption", {}, "你擺的姿勢")))
        : state
        ? el(
            "div",
            { class: "pose-pair" },
            el("figure", {}, el("img", { src: state.thumb, alt: "參考圖" }), el("figcaption", {}, "參考圖")),
            el(
              "figure",
              {},
              state.skeleton
                ? el("img", {
                    src: state.skeleton,
                    alt: "抓到的骨架",
                    // 骨架預覽是 ComfyUI 的暫存圖：ComfyUI 重開就沒了，重抓一次。
                    onerror: () => {
                      if (!state || state.kind === "skeleton") return;
                      state = { ...state, skeleton: null };
                      paintNow();
                      skeleton();
                    },
                  })
                : el("span", { class: "pose-wait" }, state.skeletonFailed ? "骨架沒抓到" : "抓骨架中…"),
              el("figcaption", {}, "抓到的骨架")
            )
          )
        : el("p", { class: "pose-empty" }, "還沒選。從下面挑一張，或上傳一張照片。")
    );
    levels.replaceChildren(
      ...POSE_LEVELS.map(([v, label]) =>
        el(
          "button",
          {
            type: "button",
            role: "radio",
            "aria-checked": state && Math.abs(state.strength - v) < 0.01 ? "true" : "false",
            disabled: !state,
            onclick: (e) => {
              if (!state) return;
              state = { ...state, strength: v };
              changed();
              paintNow();
              seat(levels.querySelector('[aria-checked="true"]') || e.currentTarget);
            },
          },
          label
        )
      )
    );
    clear.hidden = !state;
    design.textContent = state?.kind === "skeleton" ? "改這個姿勢" : "打開姿勢編輯器";
    fromRef.hidden = !state || state.kind === "skeleton";
  }

  async function skeleton() {
    const name = state?.name;
    if (!name) return;
    try {
      const j = await post("/api/pose/preview", { name });
      if (state?.name !== name) return;
      state = { ...state, skeleton: j.image, skeletonFailed: false };
    } catch (err) {
      if (state?.name !== name) return;
      state = { ...state, skeleton: null, skeletonFailed: true };
      status.textContent = `骨架預覽沒做成：${err.message}（還是可以照用，印出來看看）`;
    }
    changed();
    paintNow();
  }

  async function choose(source, from) {
    if (busy) return refuse(from);
    busy = true;
    status.textContent = "處理參考圖…";
    try {
      const { image, thumb } = await shrink(source);
      const { name } = await post("/api/pose/upload", { image });
      state = { name, thumb, strength: state?.strength ?? DEFAULT_LEVEL, skeleton: null };
      changed();
      paintNow();
      status.textContent = "好了：之後印的都照這個姿勢。";
      skeleton();
    } catch (err) {
      refuse(from);
      status.textContent = `用不了這張：${err.message}`;
    } finally {
      busy = false;
    }
  }

  // 自己擺：編輯器畫的骨架直接傳上去（PNG），不必再抓骨架。
  const design = el("button", { class: "btn btn-small btn-primary pressable", type: "button" }, "打開姿勢編輯器");
  const saveDrawn = async ({ image, thumb, draft }) => {
        if (busy) return;
        busy = true;
        status.textContent = "存姿勢…";
        try {
          const { name } = await post("/api/pose/upload", { image });
          state = { name, thumb, strength: state?.strength ?? DEFAULT_LEVEL, kind: "skeleton", skeleton: thumb, draft };
          changed();
          paintNow();
          status.textContent = "好了：之後印的都照你擺的姿勢。";
        } catch (err) {
          status.textContent = `存不了這個姿勢：${err.message}`;
        } finally {
          busy = false;
        }
  };
  design.addEventListener("click", () => openPoseEditor({ size: size(), draft: state?.kind === "skeleton" ? state.draft : null, onDone: saveDrawn }));
  // 從參考圖開始：伺服器抓骨架座標，放進編輯器接著改，原圖墊在底下。
  const fromRef = el("button", { class: "btn btn-small pressable", type: "button", title: "把這張參考圖抓到的骨架放進編輯器，自己再調" }, "拿這張的骨架來改");
  fromRef.addEventListener("click", async () => {
    if (busy || !state || state.kind === "skeleton") return refuse(fromRef);
    busy = true;
    const { w, h } = size();
    const file = state.name.split("/").pop();
    const underlay = `/api/image?${new URLSearchParams({ filename: file, subfolder: "danbooru_pose", type: "input" })}`;
    status.textContent = "抓骨架中…（第一次會久一點）";
    try {
      const j = await post("/api/pose/keypoints", { name: state.name, w, h });
      status.textContent = j.people?.length ? `抓到 ${j.people.length} 個人，拖點來改。` : "沒抓到人：從站姿開始，對著底圖擺。";
      openPoseEditor({ size: { w, h }, initial: j.people, underlay, onDone: saveDrawn });
    } catch (err) {
      refuse(fromRef);
      status.textContent = `抓不到骨架：${err.message}`;
    } finally {
      busy = false;
    }
  });
  const file = el("input", { type: "file", accept: "image/*", class: "pose-file", "aria-label": "上傳一張圖當姿勢參考" });
  file.addEventListener("change", () => {
    const f = file.files?.[0];
    if (f) choose(f, upload);
    file.value = "";
  });
  const upload = el("button", { class: "btn btn-small pressable", type: "button", onclick: () => file.click() }, "上傳一張");
  const clear = el(
    "button",
    {
      class: "btn btn-small pressable",
      type: "button",
      onclick: () => {
        state = null;
        changed();
        paintNow();
        status.textContent = "拿掉了：之後印的不照姿勢。";
      },
    },
    "不用姿勢"
  );

  const grid = (items) =>
    el(
      "div",
      { class: "pose-grid" },
      items.map((it) => {
        const btn = el("button", { class: "pose-pick pressable", type: "button", title: "照這張的姿勢" }, el("img", { src: it.src, alt: "", loading: "lazy", decoding: "async" }));
        btn.addEventListener("click", () => choose(it.full || it.src, btn));
        return btn;
      })
    );
  const mine = recent().slice(0, 18);
  const albumBox = el("div", {}, el("p", { class: "pose-empty" }, "讀取作品冊…"));
  const rank = { general: 0, sensitive: 1, explicit: 2 };
  fetch("/api/recipes", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((j) => {
      const works = (j.items || [])
        .filter((w) => (rank[w.rating] ?? 2) <= rank[rating()] && (w.thumbnail?.file || w.image?.file))
        .slice(0, 24)
        .map((w) => ({ src: `/api/recipes/files/${encodeURIComponent((w.thumbnail || w.image).file)}`, full: w.image?.file ? `/api/recipes/files/${encodeURIComponent(w.image.file)}` : null }));
      albumBox.replaceChildren(works.length ? grid(works) : el("p", { class: "pose-empty" }, "作品冊裡還沒有（這一級分級看得到的）作品。"));
    })
    .catch(() => albumBox.replaceChildren(el("p", { class: "pose-empty" }, "讀不到作品冊。")));

  const body = el(
    "div",
    { class: "pose-sheet" },
    el("p", { class: "pose-note" }, "人物會照參考圖的姿勢擺；臉、衣服、場景還是照牌。只套在內建工作流。"),
    now,
    el("div", { class: "pose-row" }, el("span", { class: "rule-label" }, "強度"), levels, clear),
    status,
    el("section", {}, el("h3", {}, "自己擺"), el("div", { class: "pose-row" }, design, fromRef, el("small", { class: "pose-hint" }, "拖骨架擺姿勢，有起手式可以套；可以擺 2～3 個人。選了參考圖，可以拿它的骨架來改"))),
    el("section", {}, el("h3", {}, "上傳"), el("div", { class: "pose-row" }, upload, file, el("small", { class: "pose-hint" }, "照片、截圖都可以；網頁會先縮小再傳"))),
    el("section", {}, el("h3", {}, "最近印的"), mine.length ? grid(mine) : el("p", { class: "pose-empty" }, "這裡還沒有印好的。")),
    el("section", {}, el("h3", {}, "作品冊"), albumBox)
  );
  paintNow();
  openSheet("姿勢參考", body, { wide: true });
  if (state && state.kind !== "skeleton" && !state.skeleton && !state.skeletonFailed) skeleton();
  if (!reducedMotion()) [...body.querySelectorAll(".pose-pick")].slice(0, 12).forEach((n, i) => enter(n, { delay: DUR.micro + i * 20 }));
}


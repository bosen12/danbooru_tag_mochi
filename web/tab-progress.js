/**
 * 分頁上的出圖進度：標題（分頁在背景時）＋小圖示上的一圈進度環（一直都在）。
 *
 * 生圖一張十幾秒，人通常會先切去別的分頁。以前只能切回來看；現在分頁列上就看得到：
 * 圈圈一路畫滿、畫好了打一個勾、壞了一個紅點。切回來看到了，勾和紅點就收掉。
 *
 * 小圖示是在 canvas 上畫的：先畫這個房間自己的圖示，再疊一圈進度 —— 所以每個房間
 * 還是認得出是誰。canvas 用不了（隱私模式、舊瀏覽器）就只改標題。
 *
 *   const tab = tabProgress();        // 預設讀 <link rel="icon"> 和 document.title
 *   tab.run(0.4, "還有 2 張");         // 0..1
 *   tab.done("3 張好了");
 *   tab.fail("印壞了");
 *   tab.clear();
 */
export function tabProgress({ base = document.title } = {}) {
  let link = document.querySelector('link[rel~="icon"]');
  const baseHref = link ? link.getAttribute("href") : null;
  const baseType = link ? link.getAttribute("type") : null;

  // 換圖示時換一個新的 <link>，不要改原本那個的 href：Chrome 在 href 改回原值時不會重抓，
  // 而是退回去要 /favicon.ico（404，主控台一條紅字）。換新元素它就乖乖照著新的載。
  function setIcon(href, type) {
    if (!link || link.getAttribute("href") === href) return;
    const next = link.cloneNode(false);
    next.setAttribute("href", href);
    if (type) next.setAttribute("type", type);
    else next.removeAttribute("type");
    link.replaceWith(next);
    link = next;
  }
  const logo = new Image();
  let logoReady = false;
  if (baseHref) {
    logo.onload = () => {
      logoReady = true;
      paintIcon();
    };
    logo.src = baseHref;
  }
  let state = "idle"; // idle | run | done | fail
  let p = 0;
  let note = "";
  let lastKey = "";

  const accent = () => cssVar("--color-accent", "#c8553d");
  const ok = () => cssVar("--color-ok", "#3f9b5a");
  const danger = () => cssVar("--color-danger", "#c0392b");

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function paintTitle() {
    let t = base;
    if (document.hidden) {
      if (state === "run") t = `${Math.round(p * 100)}%${note ? " " + note : ""} · ${base}`;
      else if (state === "done") t = `${note || "好了"} · ${base}`;
      else if (state === "fail") t = `${note || "失敗"} · ${base}`;
    }
    if (document.title !== t) document.title = t;
  }

  function paintIcon() {
    if (!link) return;
    // 同一格百分比不重畫：toDataURL 一次幾毫秒，進度事件一秒好幾則。
    const key = state + ":" + (state === "run" ? Math.round(p * 40) : "");
    if (key === lastKey) return;
    lastKey = key;
    if (state === "idle") {
      setIcon(baseHref, baseType);
      return;
    }
    try {
      const S = 64;
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const g = c.getContext("2d");
      if (logoReady) {
        // 圖示縮小一點放中間，外面留一圈給進度環。
        g.drawImage(logo, 10, 10, S - 20, S - 20);
      }
      g.lineCap = "round";
      if (state === "run") {
        g.lineWidth = 7;
        g.strokeStyle = "rgba(128,128,128,.35)";
        g.beginPath();
        g.arc(S / 2, S / 2, S / 2 - 5, 0, Math.PI * 2);
        g.stroke();
        g.strokeStyle = accent();
        g.beginPath();
        g.arc(S / 2, S / 2, S / 2 - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.03, p));
        g.stroke();
      } else {
        // 右下角一顆章：好了是綠底白勾，壞了是紅點。
        const r = 15;
        const cx = S - r - 1;
        const cy = S - r - 1;
        g.fillStyle = state === "done" ? ok() : danger();
        g.beginPath();
        g.arc(cx, cy, r, 0, Math.PI * 2);
        g.fill();
        if (state === "done") {
          g.strokeStyle = "#fff";
          g.lineWidth = 5;
          g.beginPath();
          g.moveTo(cx - 7, cy);
          g.lineTo(cx - 2, cy + 5);
          g.lineTo(cx + 7, cy - 6);
          g.stroke();
        }
      }
      setIcon(c.toDataURL("image/png"), "image/png");
    } catch {
      /* canvas 用不了就只改標題 */
    }
  }

  function paint() {
    paintTitle();
    paintIcon();
  }

  document.addEventListener("visibilitychange", () => {
    // 看到了就不必再提醒「好了／壞了」；還在畫的照樣顯示進度。
    if (!document.hidden && (state === "done" || state === "fail")) {
      state = "idle";
      note = "";
    }
    paint();
  });

  return {
    run(progress, more = "") {
      state = "run";
      p = Math.max(0, Math.min(1, Number(progress) || 0));
      note = more;
      paint();
    },
    done(msg = "") {
      // 分頁就在前面、人看著的話不必留一個勾在那裡。
      state = document.hidden ? "done" : "idle";
      note = msg;
      paint();
    },
    fail(msg = "") {
      state = document.hidden ? "fail" : "idle";
      note = msg;
      paint();
    },
    clear() {
      state = "idle";
      note = "";
      paint();
    },
  };
}

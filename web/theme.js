/* 淺色／深色（web6 各房間、介紹頁）。在 <head> 一開始就跑（跟 language.js 一樣，不是 module）：
 * 第一個畫面就是對的顏色，不會先黑一下再變白。
 *
 *   深色（預設，墨池原本的樣子）、淺色（宣紙）、跟系統（照作業系統的淺／深）。存在 mochi.theme.v1，各頁、各分頁共用。
 *   <html data-theme="light|dark">：tokens.css 照它換一套顏色；color-scheme 讓捲軸、輸入框跟著換。
 *   頂欄語言地球旁邊一顆切換（圖示＋透明的原生下拉選單，跟語言那顆同一種做法），切了馬上換、不必重新整理。
 *   第一排擠不下的寬度（手機等）改放在工具列聲音鈕後面，見 fit()。
 * 影片頁（介紹影片、使用教學）不載這支：它們是電影，永遠深色。 */
(() => {
  const KEY = "mochi.theme.v1";
  const CHOICES = ["dark", "light", "auto"];
  const mq = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;
  const pref = () => {
    try {
      const v = localStorage.getItem(KEY);
      return CHOICES.includes(v) ? v : "dark";
    } catch {
      return "dark";
    }
  };
  const resolve = (p = pref()) => (p === "auto" ? (mq?.matches ? "light" : "dark") : p);
  const META = { dark: "#0f1217", light: "#f4f1ea" };

  function apply() {
    const t = resolve();
    const root = document.documentElement;
    if (root.dataset.theme !== t) root.dataset.theme = t;
    root.dataset.themePref = pref();
    root.style.colorScheme = t;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && meta.content !== META[t]) meta.content = META[t];
    const picker = document.getElementById("theme-select");
    if (picker && picker.value !== pref()) picker.value = pref();
    const label = picker?.parentElement;
    if (label) label.dataset.pref = pref();
  }

  function set(v) {
    if (!CHOICES.includes(v)) return;
    const root = document.documentElement;
    // 換的那一下整頁顏色淡過去（不是一格跳）；減少動態的照舊直接換。
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!calm) {
      root.classList.add("theme-shifting");
      setTimeout(() => root.classList.remove("theme-shifting"), 450);
    }
    try {
      localStorage.setItem(KEY, v);
    } catch {}
    apply();
    dispatchEvent(new CustomEvent("mochi:themechange", { detail: { pref: v, theme: resolve(v) } }));
  }

  apply();
  mq?.addEventListener?.("change", () => pref() === "auto" && apply());
  // 別的分頁換了：跟著換。
  addEventListener("storage", (e) => e.key === KEY && apply());
  globalThis.MochiTheme = { pref, resolve, set };

  const ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none"/></svg>';

  /** 頂欄的切換：放在語言地球的左邊（語言那顆是 i18n.js 畫的，可能晚一點才出來）。 */
  function mount() {
    if (document.getElementById("theme-select")) return;
    const host = document.querySelector(".mast-primary");
    if (!host) return;
    const en = document.documentElement.lang === "en";
    const label = document.createElement("label");
    label.className = "theme-picker";
    label.dataset.noI18n = "";
    label.innerHTML = ICON;
    const select = document.createElement("select");
    select.id = "theme-select";
    select.setAttribute("aria-label", en ? "Appearance" : "外觀");
    select.title = en ? "Appearance: dark, light, or follow the system" : "外觀：深色、淺色，或跟著系統";
    select.style.fontFamily = '"Segoe UI", "Microsoft JhengHei", sans-serif';
    for (const [value, zh, enText] of [["dark", "深色", "Dark"], ["light", "淺色", "Light"], ["auto", "跟系統", "System"]]) {
      const o = document.createElement("option");
      o.value = value;
      o.textContent = en ? enText : zh;
      select.append(o);
    }
    select.value = pref();
    label.dataset.pref = pref();
    select.addEventListener("change", () => set(select.value));
    label.append(select);
    const place = () => {
      const lang = host.querySelector(".language-picker");
      if (lang) host.insertBefore(label, lang);
      else if (!label.isConnected) host.append(label);
      return !!lang;
    };
    // 工具列、語言、英文翻譯都是後來才放齊的：載完、字型好了再量一次；視窗大小變了也重量。
    const refit = () => fit(host, label);
    let timer = 0;
    addEventListener("resize", () => {
      clearTimeout(timer);
      // 換寬度時頂欄的工具列也在重排（佔位的空白跟著縮放）：量兩次，第二次是排好之後。
      timer = setTimeout(() => (refit(), (timer = setTimeout(refit, 700))), 150);
    });
    addEventListener("load", () => setTimeout(refit, 300), { once: true });
    setTimeout(refit, 1800);
    document.fonts?.ready.then(refit);
    if (place()) return refit();
    const mo = new MutationObserver(() => place() && (mo.disconnect(), refit()));
    mo.observe(host, { childList: true });
    setTimeout(() => mo.disconnect(), 8000);
  }

  /** 頂欄第一排在手機和幾個中間寬度剛好擠滿，多一顆就把語言地球擠到下一行。照順序試，第一個放得下的就用：
   *   1. 語言地球旁邊（平常）
   *   2. 工具列聲音鈕的後面，長得跟旁邊的工具鈕一樣（各房間有工具列）
   *   3. 語言地球旁邊縮成沒有框的小圖示
   *   4. 都放不下：房間裡照舊放地球旁邊（工具列整排換到第二排，跟 1366 寬平常的樣子一樣）；
   *      介紹頁沒有工具列（只有手機寬度會這樣）：先收起來，到房間裡或寬一點再切。
   *  放得下＝整條頂欄沒有變高、沒有多出左右捲動。 */
  function fit(host, label) {
    const lang = host.querySelector(".language-picker");
    const sound = document.getElementById("sound-btn");
    const mast = host.closest(".mast") || host.parentElement;
    if (!lang || !mast || !label.isConnected) return;
    const height = () => mast.getBoundingClientRect().height;
    const scrolling = () => [document.documentElement, ...mast.querySelectorAll(".mast-controls")].filter((c) => c.scrollWidth > c.clientWidth + 1).length;
    const focused = label.contains(document.activeElement);
    const at = (slot) => {
      label.classList.toggle("is-tool", slot === "tool");
      label.classList.toggle("ghost", slot === "tool");
      label.classList.toggle("icon-btn", slot === "tool");
      label.classList.toggle("is-compact", slot === "compact");
      label.style.display = slot === "none" ? "none" : "";
      if (slot === "tool") {
        if (sound.nextElementSibling !== label) sound.after(label);
      } else if (slot === "none") {
        // 放到最後面（不是緊貼在地球前面）：「.theme-picker + .language-picker」那 6px 才不會留著。
        if (host.lastElementChild !== label) host.append(label);
      } else if (label.nextElementSibling !== lang) host.insertBefore(label, lang);
    };
    at("none");
    const base = height();
    const baseScroll = scrolling();
    const slot = ["beside", sound && "tool", "compact"].filter(Boolean).find((s) => (at(s), height() <= base + 1 && scrolling() <= baseScroll)) || (sound ? "beside" : "none");
    at(slot);
    label.dataset.slot = slot;
    if (focused) label.querySelector("select")?.focus();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => (apply(), mount()), { once: true });
  else (apply(), mount());
})();

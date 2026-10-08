/* Loaded before first paint on every page. No engine or UI dependencies. */
(() => {
  const key = "mochi.language.v1";
  let memory;
  function preference() {
    if (memory !== undefined) return memory;
    let value;
    try { value = localStorage.getItem(key); } catch { /* Private browser storage may be blocked. */ }
    if (value === "en" || value === "zh-Hant") return value;
    try { value = sessionStorage.getItem(key); } catch { /* Try the current history entry next. */ }
    if (value === "en" || value === "zh-Hant" || value === "auto") return value;
    try { value = history.state?.mochiLanguage; } catch { /* Browser language remains available. */ }
    return ["en", "zh-Hant", "auto"].includes(value) ? value : "auto";
  }
  function resolve() {
    const saved = preference();
    if (saved === "en" || saved === "zh-Hant") return saved;
    for (const locale of navigator.languages || [navigator.language || "en"]) {
      if (/^zh(?:-|$)/i.test(locale)) return "zh-Hant";
      if (/^en(?:-|$)/i.test(locale)) return "en";
    }
    return "en";
  }
  function set(value) {
    if (!["auto", "en", "zh-Hant"].includes(value)) return;
    memory = value;
    let stored = false;
    try {
      if (value === "auto") localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      stored = true;
    } catch { /* Use tab storage when persistent storage is unavailable. */ }
    try {
      if (stored) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    } catch { /* The history entry also survives a page reload. */ }
    try {
      const state = { ...history.state };
      if (stored) delete state.mochiLanguage;
      else state.mochiLanguage = value;
      history.replaceState(state, "");
    } catch { /* Detection still works without optional browser storage. */ }
  }
  globalThis.MochiLanguage = { resolve, preference, set };
  document.documentElement.lang = resolve();
  document.documentElement.dataset.languagePending = "";
  // A failed module request must never leave the workbench invisible.
  if (typeof setTimeout === "function") setTimeout(() => delete document.documentElement.dataset.languagePending, 4000);
})();

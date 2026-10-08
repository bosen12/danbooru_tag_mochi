// 開彈窗時鎖住背景捲動。
//
// 原本這件事在三個檔案裡各寫一次 `document.body.style.overflow = "hidden"`，
// 而且各自維護一份「還有沒有別的彈窗開著」的選擇器清單 —— telegram 那份漏了
// shortcuts 與 discord，discord 那份漏了 shortcuts，lora.js 則完全沒鎖，
// 但它的彈窗又出現在別人的清單裡。
//
// 更根本的是那樣鎖不到東西。boot.css 給 html 設了 overflow-x: clip，所以 html 的
// overflow 不是 visible，body 的 overflow 就不會再往視窗傳遞（那條傳遞規則只在
// html 是 visible 時成立）。結果 body 只是自己變成一個捲動容器 —— 背景照捲，
// 而且 .rail 的 position: sticky 參考對象被換成 body（scrollTop 恆為 0），
// 黏性當場失效：捲到 900 再開彈窗，左欄會往上跳 900px，關掉又跳回來。
//
// 鎖在真正的捲動元素（html）上，兩件事同時解決。實測 .rail 的 y：
//   未鎖 82 / body:hidden -817.6 / html:hidden 82
//
// 用集合而不是計數器：開兩次、關兩次、關到一半又被別的路徑關掉，都不會把
// 深度算錯而永遠解不開鎖。
//
// ---
//
// 第二件事：彈窗開著時把背景關出 tab 序。
//
// 七個疊層（大圖／LoRA／塔羅／底模／工作流／作品冊／TG／DC／快捷鍵）都寫了
// aria-modal="true"，也都在自己關著的時候把自己設成 inert。可是**背後**的
// .mast／.shell／.dock 從來沒有人動過 —— 它們的 z-index 是 8／auto／9，彈窗是
// 140 以上，畫面上完全被蓋住，點也點不到（遮罩擋著），但 Tab 走得進去。
// 於是鍵盤使用者在彈窗裡按幾下 Tab 就掉到一個看不見的地方，而且 Esc 關的是
// 彈窗，焦點回不來。aria-modal 只管螢幕閱讀器的虛擬游標，管不到 tab 序。
//
// 修在這裡而不是在七個彈窗裡各寫一次，理由跟這個檔案當初誕生的理由一模一樣：
// 那七個地方唯一共用的東西就是這兩個函式，而且它們傳進來的 key 正好都是彈窗
// 自己的 element id —— 誰是前景、誰是背景，這裡分得出來。
//
// 用 forced 記住「是我設的」：關著的彈窗本來就是 inert，解鎖時不分青紅皂白清一遍，
// 會把它們放回 tab 序，那是把一個洞換成另一個洞。
const openKeys = new Set();
let saved = null;
const forced = new Set();

// 這些東西被蓋住也還要有效，不能一起關掉：aria-live 播報區、跨層的 toast、
// 以及掛在 body 上的權重彈窗、新手導覽。
// "tour"：新手導覽（web6 的 tour.js）的小視窗，導覽到彈窗裡的步驟時要按得到。
const NEVER_INERT = new Set(["live", "lora-toast", "w-pop", "tour"]);

function syncBackgroundInert() {
  const kids = document.body && document.body.children ? [...document.body.children] : [];
  if (!openKeys.size) {
    for (const el of forced) el.inert = false;
    forced.clear();
    return;
  }
  for (const el of kids) {
    if (el.tagName === "SCRIPT") continue;
    if (el.id && (openKeys.has(el.id) || NEVER_INERT.has(el.id))) {
      // 疊了第二層之後又關掉它：下面那層重新變成前景，要放出來。
      if (forced.has(el)) {
        el.inert = false;
        forced.delete(el);
      }
      continue;
    }
    if (el.inert) continue;
    el.inert = true;
    forced.add(el);
  }
}

export function lockScroll(key) {
  if (!key) return;
  if (!openKeys.size) saved = document.documentElement.style.overflow;
  openKeys.add(key);
  document.documentElement.style.overflow = "hidden";
  syncBackgroundInert();
}

export function unlockScroll(key) {
  if (!key || !openKeys.has(key)) return;
  openKeys.delete(key);
  syncBackgroundInert();
  if (openKeys.size) return;
  document.documentElement.style.overflow = saved || "";
  saved = null;
}

// 測試用：目前有幾個東西押著這把鎖。
export function scrollLockCount() {
  return openKeys.size;
}

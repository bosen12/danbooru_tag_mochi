/**
 * 疊印台的「版」（畫面上的卡池）：你放上來的牌、誰帶上誰、它們彼此的關係。純資料，不碰 DOM。
 *
 * 零 import（跟字鋪的 pool.js 同一個做法）：engine 的 applyPin、contradictions、ACT_PLACE
 * 由呼叫端傳進來，所以瀏覽器和 node 測試（scripts/test_fuse.mjs）用的是同一份，
 * 也不會另長一套抽牌規則 —— 同格互斥、時代衝突、附帶全部是 engine 說了算。
 *
 *   bed = { pins: [tag…]（放上來的順序）, carried: { tag: 帶它上來的那張 } }
 */

/** 六個套版，也是卡池的六列，由上而下：罩色在最上面，底色在最下面，跟真的疊印一樣。 */
export const REGISTERS = ["style", "pose", "wear", "look", "cast", "scene"];
export const REGISTER_ROLE = {
  style: "罩色",
  pose: "姿勢",
  wear: "服裝",
  look: "長相",
  cast: "人物",
  scene: "底色",
};

export function emptyBed() {
  return { pins: [], carried: {} };
}

/**
 * 份量（weights.js）跟著牌走：只留還在版上的、不是 1 的。一張都沒調過就不帶這個欄位
 * （版的形狀跟以前一樣）。
 */
function keepWeights(weights, pins) {
  const out = {};
  for (const [t, w] of Object.entries(weights || {})) {
    const n = Number(w);
    if (pins.has(t) && Number.isFinite(n) && n !== 1 && n >= 0.5 && n <= 1.5) out[t] = n;
  }
  return Object.keys(out).length ? { weights: out } : {};
}

/** 讀回存檔，或付印時記下的版。舊存檔多一個 lead（以前的主版），這裡直接丟掉。 */
export function sanitizeBed(raw, has) {
  if (!raw || !Array.isArray(raw.pins)) return emptyBed();
  const pins = [...new Set(raw.pins.filter((t) => typeof t === "string" && has(t)))];
  const set = new Set(pins);
  const carried = {};
  for (const [t, from] of Object.entries(raw.carried || {})) if (set.has(t) && set.has(from)) carried[t] = from;
  return { pins, carried, ...keepWeights(raw.weights, set) };
}

function erasOf(item) {
  const e = item && item.era;
  return !e || !e.length || e.includes("any") ? null : e;
}

function eraClash(a, b) {
  const x = erasOf(a);
  const y = erasOf(b);
  return !!(x && y && !x.some((e) => y.includes(e)));
}

/**
 * 放一張牌上版。回傳新的版和這一步造成的事件：
 *   place   放上來的那張
 *   carry   被它帶上來的（詞庫的 implies／bind）
 *   replace 被它擠下去的（同一格只留一張，或時代對不上）
 */
export function placeCard(bed, tag, { lex, applyPin }) {
  if (bed.pins.includes(tag)) return { bed, events: [] };
  const prev = new Set(bed.pins);
  const { pinned } = applyPin(lex, prev, new Set(), tag);
  const item = lex.byTag.get(tag);
  const removed = bed.pins.filter((t) => !pinned.has(t));
  const added = [...pinned].filter((t) => !prev.has(t) && t !== tag);
  const events = [{ kind: "place", tag }];
  // why：people＝沒有人物跟人物的牌互斥（不是同一格），era＝時代對不上，slot＝同一格只留一張。
  for (const t of removed) events.push({ kind: "replace", out: t, by: tag, why: tag === "no humans" || t === "no humans" ? "people" : eraClash(item, lex.byTag.get(t)) ? "era" : "slot" });
  for (const t of added) events.push({ kind: "carry", tag: t, from: tag });
  const carried = {};
  for (const [t, from] of Object.entries(bed.carried)) if (pinned.has(t) && pinned.has(from)) carried[t] = from;
  for (const t of added) carried[t] = tag;
  delete carried[tag];
  const pins = [...bed.pins.filter((t) => pinned.has(t)), tag, ...added];
  return { bed: { pins, carried, ...keepWeights(bed.weights, new Set(pins)) }, events };
}

/** 拿掉一張。被它帶上來的牌一起拿掉（它們本來就是跟著它來的）。 */
export function removeCard(bed, tag) {
  if (!bed.pins.includes(tag)) return { bed, events: [] };
  const drop = new Set([tag]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [t, from] of Object.entries(bed.carried)) {
      if (drop.has(from) && !drop.has(t)) {
        drop.add(t);
        grew = true;
      }
    }
  }
  const pins = bed.pins.filter((t) => !drop.has(t));
  const carried = {};
  for (const [t, from] of Object.entries(bed.carried)) if (!drop.has(t) && !drop.has(from)) carried[t] = from;
  return {
    bed: { pins, carried, ...keepWeights(bed.weights, new Set(pins)) },
    events: [{ kind: "remove", tag, tags: [...drop].filter((t) => bed.pins.includes(t)) }],
  };
}

/**
 * 版上的牌彼此的關係，在卡池裡畫成校對記號：
 *   carry 附帶：A 把 B 帶上來
 *   echo  呼應：活動配上它的地點（engine 的 ACT_PLACE）
 *   clash 相剋：同時成立不了（engine 的 contradictions：晝夜、室內外、全裸配衣服…）
 */
export function relationsOf(bed, { lex, contradictions, actPlace }) {
  const has = new Set(bed.pins);
  const out = [];
  const seen = new Set();
  const push = (kind, a, b) => {
    if (!a || !b || a === b || !has.has(a) || !has.has(b)) return;
    const key = kind + "|" + [a, b].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, a, b });
  };
  for (const [t, from] of Object.entries(bed.carried)) push("carry", from, t);
  for (const a of bed.pins) {
    const places = actPlace[a];
    if (!places) continue;
    for (const b of bed.pins) if (places.has(b)) push("echo", a, b);
  }
  // 釘選不是抽完的卡司：釘 1girl＋口交不算相剋（抽的時候會補一個男生）。
  for (const [kind, x, y] of contradictions(lex, bed.pins, { pins: true })) {
    let a = x;
    let b = y;
    if (kind === "nude_garment") {
      a = has.has("completely nude") ? "completely nude" : "nude";
      b = ["dress", "sundress", "jeans"].find((t) => has.has(t));
    }
    push("clash", a, b);
  }
  return out;
}

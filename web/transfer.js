import { peekTab, TAB_FUSE, TAB_POOL } from "./store.js";
import { el, openSheet } from "./ui.js";
import { english, t } from "./i18n.js";

function destination(room) {
  const fuse = room === "fuse";
  const saved = peekTab(fuse ? TAB_FUSE : TAB_POOL);
  const state = fuse ? saved?.bed : saved;
  const tags = fuse ? state?.pins : state?.tags;
  return { tags: Array.isArray(tags) ? tags.filter(tag => typeof tag === "string") : [], weights: state?.weights || {} };
}

function paint(node) {
  const room = node.dataset.transferRoom;
  const count = destination(room).tags.length;
  const label = room === "fuse" ? `替換疊印台的 ${count} 張牌` : `替換合成池的 ${count} 張牌`;
  node.textContent = count ? (node.dataset.base ? t(node.dataset.base) + " · " : "") + t(label) :
    t(node.dataset.base || (room === "fuse" ? "加入疊印台" : "加入合成池"));
}

// 保留作品冊「照這張再印」等操作名稱，同時讓按鈕說清楚目的地。
export function transferLabel(room, base = "") {
  const node = el("span", { dataset: { transferRoom: room, base } });
  paint(node);
  return node;
}

const refresh = () => document.querySelectorAll("[data-transfer-room]").forEach(paint);
addEventListener("pageshow", refresh);
document.addEventListener("prerenderingchange", refresh);

// 目的地有會被移除的牌或改寫的份量才多一步。取消、Esc 都不會留下交接便條。
export function reviewTransfer(room, tags, weights, zh, proceed, { merge = false } = {}) {
  const old = destination(room);
  const next = new Set(tags);
  const lost = old.tags.filter(tag => !next.has(tag));
  const changed = old.tags.filter(tag => next.has(tag) && (old.weights[tag] ?? 1) !== (weights[tag] ?? 1));
  if (!lost.length && !changed.length) return proceed();
  const name = tag => english && !tag.startsWith("custom:") ? tag : zh(tag);
  const list = values => el("span", { "data-no-i18n": "" }, values.join(english ? ", " : "、"));
  const body = el("div", { class: "sheet-body" },
    lost.length > 0 && el("p", {}, el("b", {}, "會拿下的牌"), " · ", list(lost.map(name))),
    changed.length > 0 && el("p", {}, el("b", {}, "份量變更"), " · ", list(changed.map(tag => `${name(tag)} ${old.weights[tag] ?? 1} → ${weights[tag] ?? 1}`)))
  );
  const title = merge ? "加入合成池時會換牌" : room === "fuse" ? "替換疊印台的選牌" : "替換合成池的選牌";
  const sheet = openSheet(title, body, {
    foot: [
      el("button", { type: "button", class: "btn btn-small", onclick: () => sheet.close() }, "取消"),
      el("button", { type: "button", class: "btn btn-small btn-primary", onclick: () => { sheet.close(); proceed(); } }, merge ? "確認加入" : "確認替換"),
    ],
  });
}

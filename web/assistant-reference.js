/** 成品引用、作品冊查詢與牌的來歷。只讀配方；寫入仍走 assistant-tools.js。 */
import { el } from "./ui.js";
import { applyPin, mutexSiblings, parseWeighted } from "./engine.js";
import { sourceLabel } from "./trace-copy.js";
import { tagsOfPositive } from "./usage.js";
import { HARD_BANNED } from "./card-art.js";

const RANK = { general: 0, sensitive: 1, explicit: 2 };
const BANNED = new Set(HARD_BANNED);
const SHOT_DRAG = "application/x-mochi-assistant-shot";
const ROUTE = "/api/recipes";
export const REFERENCE_PREFIX = "［引用作品］";
export const REFERENCE_SOURCE = {
  pin: "釘選",
  random: "隨機抽取",
  implies: "附帶",
  bind: "綁定帶入",
  group: "群組帶入",
  unknown: "來源未記錄",
};

function recipeImage(work) {
  const file = work.thumbnail?.file || work.image?.file;
  return typeof file === "string" && file ? `${ROUTE}/files/${encodeURIComponent(file)}?w=480` : null;
}

function visibleRating(ctx) {
  const { rating, ratingFree } = ctx.state().settings;
  return ratingFree ? 2 : RANK[rating] ?? 0;
}

function makeReference(ctx, work, kind) {
  const mine = new Set(work.mine || work.pinned || []);
  const drawn = new Map((work.drawn || []).filter(Boolean).map((entry) => typeof entry === "string" ? [entry, "random"] : [entry.tag, entry.src]));
  const trace = work.trace?.kept || work.traceSummary?.kept || [];
  const events = new Map(trace.map((entry) => [entry.tag, entry]));
  const { lex } = ctx.referenceRules();
  const weighted = new Map(String(work.positive || "").split(",").map((part) => {
    const { tag, weight } = parseWeighted(part.replace(/\\([()])/g, "$1"));
    return [tag, weight];
  }));
  for (const part of String(work.positiveWeighted || "").split(",")) {
    const { tag, weight } = parseWeighted(part.replace(/\\([()])/g, "$1"));
    if (tag && weight !== 1) weighted.set(tag, weight);
  }
  const tags = new Set(kind === "shot"
    ? [...mine, ...drawn.keys()]
    : [...weighted.keys()].some(Boolean) ? weighted.keys() : mine);
  const cards = [];
  for (const tag of tags) {
    const item = lex.byTag.get(tag);
    if (!item || BANNED.has(tag)) continue;
    const event = events.get(tag);
    cards.push({
      tag,
      section: item.section,
      weight: work.weights?.[tag] ?? weighted.get(tag) ?? 1,
      source: event?.source || (mine.has(tag) ? "pin" : drawn.get(tag) || "unknown"),
      ...(event?.parent ? { parent: event.parent } : {}),
    });
  }
  return {
    kind,
    id: work.id,
    name: work.name,
    thumbnail: kind === "shot" ? work.thumbnail : recipeImage(work),
    seed: work.seed ?? null,
    checkpoint: work.ckpt ?? work.checkpoint ?? null,
    loras: structuredClone(work.loras || []),
    width: work.width ?? null,
    height: work.height ?? null,
    era: work.era || null,
    cards,
    groups: structuredClone(work.groups || {}),
    groupIds: structuredClone(work.groupIds || {}),
  };
}

export function referenceFromShot(ctx, id) {
  const shot = ctx.referenceShot(id);
  return shot && makeReference(ctx, shot, "shot");
}

async function recipeJson(path, signal) {
  const response = await fetch(path, { cache: "no-store", signal });
  if (!response.ok) throw new Error(String(response.status));
  const data = await response.json();
  if (data?.ok === false) throw new Error("recipes");
  return data;
}

export async function referenceFromAlbum(ctx, id, signal) {
  const { recipe } = await recipeJson(`${ROUTE}/${encodeURIComponent(id)}`, signal);
  return recipe?.id === id && (RANK[recipe.rating] ?? 2) <= visibleRating(ctx) ? makeReference(ctx, recipe, "album") : null;
}

function localDate(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const two = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

export async function findReferences(ctx, { from, to, favorite, tags, limit }, signal) {
  const { items } = await recipeJson(ROUTE, signal);
  const rating = visibleRating(ctx);
  const works = [];
  for (const work of items || []) {
    if (!work?.id || (RANK[work.rating] ?? 2) > rating) continue;
    const day = localDate(work.createdAt);
    if (from && day < from || to && (!day || day > to)) continue;
    // 作品冊收藏會複製原圖進來。匯入的純配方也列在作品冊，但沒有收藏圖。
    const saved = !!work.image?.file;
    if (favorite != null && favorite !== saved) continue;
    const listed = tagsOfPositive(work.positive);
    const present = new Set(listed.length ? listed : work.pinned || []);
    if (!tags.every((tag) => present.has(tag))) continue;
    works.push({ id: work.id, name: work.name, createdAt: work.createdAt, favorite: saved, thumbnail: recipeImage(work) });
  }
  const time = (work) => Date.parse(work.createdAt) || 0;
  works.sort((a, b) => time(b) - time(a) || a.id.localeCompare(b.id));
  return { total: works.length, works: works.slice(0, limit) };
}

export function traceReference(ctx, tag, reference) {
  const { lex, pinOptions, groups, owners } = ctx.referenceRules();
  const item = lex.byTag.get(tag);
  if (!item) return null;
  const state = ctx.state();
  const cards = reference ? reference.cards : state.pool.map(({ tag }) => ({ tag, source: "pin" }));
  const byTag = new Map(cards.map((card) => [card.tag, card]));
  const card = byTag.get(tag);
  const present = new Set(byTag.keys());
  const afterRemoval = new Set(present);
  afterRemoval.delete(tag);
  for (const bound of item.bind || []) afterRemoval.delete(bound);
  const bans = new Set(reference ? [] : state.bans);
  const paths = [];
  function follow(parent) {
    const seen = new Set([parent]);
    const pending = [[{ tag: parent }]];
    for (let i = 0; i < pending.length; i++) {
      const path = pending[i];
      const rule = lex.byTag.get(path.at(-1).tag);
      for (const [via, list] of [["bind", rule?.bind], ["implies", rule?.implies]]) {
        for (const child of list || []) {
          if (seen.has(child) || BANNED.has(child)) continue;
          const chain = [...path, { tag: child, via }];
          if (child === tag) return chain;
          seen.add(child);
          pending.push(chain);
        }
      }
    }
    return null;
  }
  if (card?.parent && card.parent !== tag && !BANNED.has(card.parent)) {
    paths.push([{ tag: card.parent }, { tag, via: card.source }]);
  }
  const returnFrom = [];
  for (const parent of afterRemoval) {
    if (!card || BANNED.has(parent)) continue;
    const path = follow(parent);
    if (!path) continue;
    const readds = !bans.has(tag) && applyPin(lex, afterRemoval, bans, parent, pinOptions).pinned.has(tag);
    if (readds) returnFrom.push(parent);
    const historical = reference && ["implies", "bind"].includes(card.source);
    if ((readds || historical) && !card.parent && paths.length < 4) paths.push(path);
  }
  const directOwner = !reference && owners?.get(tag);
  const groupIds = (reference ? reference.groupIds?.[item.section] : state.settings.groups?.[item.section]?.ids) || [];
  const matchingGroups = (groups || []).filter((g) => groupIds.includes(g.id) && g.tags?.includes(tag));
  const recordedGroups = reference?.groups?.[item.section] || [];
  const names = reference
    ? (matchingGroups.length ? matchingGroups.map((g) => recordedGroups[groupIds.indexOf(g.id)] || g.name) : recordedGroups)
    : matchingGroups.map((g) => g.name);
  const groupNames = card?.source === "group" || !reference ? [...new Set(names)] : [];
  const implied = card && paths.length > 0 && (!reference || ["pin", "unknown", "implies", "bind"].includes(card.source));
  const source = !card ? "unknown" : implied && ["pin", "unknown"].includes(card.source) ? paths[0].at(-1).via : card.source;
  return {
    tag,
    present: !!card,
    source,
    inferred: !!card && (!reference || implied && !card.parent || card.source === "unknown"),
    paths: card && implied ? paths : [],
    groups: groupNames,
    ...(directOwner ? { customOwner: state.pool.find((p) => p.tag === directOwner)?.zh || directOwner } : {}),
    mutex: mutexSiblings(lex, tag).slice(0, 24),
    wouldReturn: returnFrom.length > 0,
    returnFrom,
    returnOn: "reapply",
  };
}

export function referenceSourceLabel(source) {
  return REFERENCE_SOURCE[source] || sourceLabel(source) || REFERENCE_SOURCE.unknown;
}

export function referenceInfo(ref) {
  return ref?.kind === "work" ? ref.work : null;
}

/** 只在實驗功能開著時觀察成品牆。圖片原生拖曳，這裡只放這一張的編號。 */
export function watchShotReferences({ ctx, isOpen, accept }) {
  const wall = document.getElementById("wall");
  if (!wall) return () => {};
  const imageOf = (shot) => shot.querySelector(".shot-frame > img:not(.shot-under)");
  const sync = () => {
    for (const shot of wall.querySelectorAll(".shot")) {
      const button = shot.querySelector(".ai-shot-ref");
      const image = imageOf(shot);
      if (shot.dataset.status !== "done" || shot.dataset.gone || !image) {
        button?.remove();
        continue;
      }
      if (!button) shot.querySelector(".shot-actions")?.append(el(
        "button", { class: "btn btn-small btn-ghost ai-shot-ref", type: "button" }, "交給助手"
      ));
    }
  };
  const events = new AbortController();
  const { signal } = events;
  const observer = new MutationObserver((records) => {
    const changed = records.some(({ target, type }) =>
      type === "attributes" ? target.matches(".shot") : target === wall || target.matches(".shot-frame"));
    if (changed) sync();
  });
  observer.observe(wall, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-status", "data-gone"] });
  wall.addEventListener("click", (e) => {
    const button = e.target.closest?.(".ai-shot-ref");
    const shot = button?.closest(".shot");
    if (shot) accept(referenceFromShot(ctx, shot.dataset.id));
  }, { signal });
  wall.addEventListener("dragstart", (e) => {
    if (!isOpen() || !e.dataTransfer) return;
    const shot = e.target.closest?.(".shot");
    if (!shot || shot.dataset.status !== "done" || shot.dataset.gone || imageOf(shot) !== e.target) return;
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(SHOT_DRAG, shot.dataset.id);
  }, { signal });
  sync();
  return () => {
    events.abort();
    observer.disconnect();
    wall.querySelectorAll(".ai-shot-ref").forEach((button) => button.remove());
  };
}

export function bindReferenceDrop(input, { ctx, isOpen, accept, signal }) {
  const accepts = (event) => isOpen() && event.dataTransfer?.types.includes(SHOT_DRAG);
  input.addEventListener("dragover", (event) => {
    if (!accepts(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    input.dataset.workDrop = "true";
  }, { signal });
  input.addEventListener("dragleave", () => delete input.dataset.workDrop, { signal });
  input.addEventListener("drop", (event) => {
    delete input.dataset.workDrop;
    if (!accepts(event)) return;
    event.preventDefault();
    accept(referenceFromShot(ctx, event.dataTransfer.getData(SHOT_DRAG)));
  }, { signal });
  signal.addEventListener("abort", () => delete input.dataset.workDrop, { once: true });
}
